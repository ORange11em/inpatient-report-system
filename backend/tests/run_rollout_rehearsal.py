"""Synthetic rollout evidence; creates its own loopback cluster, never uses caller DB.

Rehearses all 6 legacy operational tables (data_all, data_confirm, data_split_patient,
pressure, readmit, tb_news) plus reconciliation, idempotency, real HTTP reports/news,
and backup/restore/rollback. No production or patient data.
// TODO: เชื่อม API — hospital export and owner acceptance remain separate gates.
"""
import argparse
import asyncio
from collections import Counter, defaultdict
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
from uuid import UUID

import run_daily_workflow as shared
from run_legacy_confirmation_rehearsal import write_csv

BACKEND = Path(__file__).resolve().parents[1]
OUT = BACKEND.parent / "docs/rollout/rehearsal-result.json"


def fixture_rows():
    from app.schemas import COUNTER_FIELDS
    raw, profiles, _ = shared.fixtures()
    rows = []
    for row in raw:
        values = dict.fromkeys(COUNTER_FIELDS, 0)
        for key, value in row.items():
            if key.endswith(("_pt", "_nb")):
                suffix, group = key.rsplit("_", 1)
                values[group + "_" + suffix] = int(value)
        values.update(zip(("patient_type" + str(i) for i in (5, 4, 3, 2, 1)), profiles[row["profile"]]))
        values.update(em_hn=1, em_rn=2, em_tn=1, em_pn=1, em_aid=1)
        rows.append(dict(values, **{k: row[k] for k in ("ward", "idate", "wage_type_id", "amount_bed", "i_status")}))
    return rows


def supplement_fixtures():
    from app.cli.import_legacy_supplements import SPLIT_FIELDS
    raw, _, specialty_values = shared.fixtures()
    split_rows = []
    for row in raw:
        if row["wage_type_id"] == "3":
            values = {k: "0" for k in SPLIT_FIELDS}
            for k, v in specialty_values[row["id"]].items():
                values[k] = str(v)
            split_rows.append({"ward": row["ward"], "idate": row["idate"], **values})

    pressure_rows = [
        {"ward": "10", "idate": "2026-10-31", "do_pressure": "0", "risk_pressure": "5"},
        {"ward": "10", "idate": "2026-11-01", "do_pressure": "1", "risk_pressure": "10"},
        {"ward": "10", "idate": "2026-11-02", "do_pressure": "2", "risk_pressure": "50"},
        {"ward": "11", "idate": "2026-11-01", "do_pressure": "0", "risk_pressure": "0"},
    ]
    readmit_rows = [
        {"ward": "10", "month1": "2026-10", "idate": "2026-10-31", "readmit_amount": "1", "discharge_amount": "20"},
        {"ward": "11", "month1": "2026-10", "idate": "2026-10-31", "readmit_amount": "0", "discharge_amount": "10"},
        {"ward": "10", "month1": "2026-11", "idate": "2026-11-02", "readmit_amount": "2", "discharge_amount": "40"},
        {"ward": "11", "month1": "2026-11", "idate": "2026-11-01", "readmit_amount": "1", "discharge_amount": "10"},
    ]
    news_rows = [
        {
            "id": "1",
            "title_news": "แจ้งทดสอบระบบ",
            "detail_news": "ใช้ข้อมูลสมมติเท่านั้น",
            "status_news": "1",
            "date_news": "2026-11-01",
            "time_news": "09:00:00",
            "user_update": "synthetic-a",
        },
        {
            "id": "2",
            "title_news": "ร่างประกาศทดสอบ",
            "detail_news": "ร่างประกาศสำหรับผู้ดูแลระบบ",
            "status_news": "0",
            "date_news": "2026-11-02",
            "time_news": "10:30:00",
            "user_update": "orphan-news-user",
        },
    ]
    return split_rows, pressure_rows, readmit_rows, news_rows


async def snapshot(url):
    import asyncpg
    db = await asyncpg.connect(url)
    try:
        rows = await db.fetch("""SELECT w.legacy_code AS ward, e.*, s.legacy_shift_id AS legacy_shift
            FROM daily_entries e JOIN wards w ON w.id=e.ward_id
            JOIN shift_types s ON s.id=e.shift_type_id
            ORDER BY w.legacy_code,e.service_date,s.legacy_shift_id""")
        tables = (
            "daily_entries",
            "specialty_counts",
            "pressure_daily",
            "readmission_monthly",
            "announcements",
            "legacy_key_map",
            "submission_events",
            "legacy_confirmation_records",
            "legacy_import_issues",
            "migration_batches",
        )
        counts = {table: await db.fetchval("SELECT count(*) FROM " + table) for table in tables}
        history = await db.fetchrow("""SELECT count(*) AS events,
            count(*) FILTER (WHERE actor_id IS NULL) AS missing_actor,
            count(*) FILTER (WHERE confirmed_at IS NULL) AS missing_time,
            count(*) FILTER (WHERE entry_id IS NULL) AS missing_entry
            FROM legacy_confirmation_records""")
        return rows, counts, dict(history)
    finally:
        await db.close()


def compare_groups(source, target):
    """Independent grouping, not importer parsing or report calculation."""
    from app.schemas import COUNTER_FIELDS
    fields = [*COUNTER_FIELDS, "amount_bed"]
    source_rows = [dict(r, day=r["idate"], shift=int(r["wage_type_id"]),
                        status="confirmed" if r["i_status"] == "1" else "unconfirmed") for r in source]
    target_rows = [dict(r, day=r["service_date"].isoformat(), shift=r["legacy_shift"]) for r in target]

    def group(rows, level):
        groups = defaultdict(Counter)
        for row in rows:
            key = {"ward": (row["ward"],), "day": (row["ward"], row["day"]),
                   "shift": (row["ward"], row["day"], row["shift"]),
                   "month": (row["ward"], row["day"][:7])}[level]
            values = groups[key]
            values["rows"] += 1
            values[row["status"]] += 1
            for field in fields:
                value = row[field]
                values[field + "_nulls"] += value is None or value == ""
                if value is not None and value != "":
                    values[field] += int(value)
        return groups

    results = {}
    for level in ("ward", "day", "shift", "month"):
        left, right = group(source_rows, level), group(target_rows, level)
        assert dict(left) == dict(right), "source/target group mismatch: " + level
        results[level] = {"groups": len(left), "mismatches": 0,
                          "totals": [{"key": list(key), **values} for key, values in sorted(left.items())]}
    return results


async def imports(url, source, history, account_map, split_path, pressure_path, readmit_path, news_path):
    from app.cli.import_legacy import perform
    from app.cli.import_legacy_confirmations import run
    from app.cli.import_legacy_supplements import perform_table
    from app.cli.reconcile_legacy import reconcile
    from app.cli.reconcile_legacy_supplements import reconcile_table

    before = await snapshot(url)
    dry = await perform(source, False, None)
    assert dry["rows_would_import"] == 13 and dry["rows_failed"] == 0
    assert (await snapshot(url))[1] == before[1], "dry-run wrote rows"
    applied = await perform(source, True, "rollout_admin")
    assert [applied[k] for k in ("rows_seen", "rows_imported", "rows_skipped", "rows_failed")] == [13, 13, 0, 0]
    reconciliation = await reconcile(source, UUID(applied["migration_batch_id"]))
    assert reconciliation["match_status"] == "match"

    confirmation_dry = await run(history, account_map, False, None)
    assert confirmation_dry["counts"]["rows_would_import"] == 3
    after_dry = await snapshot(url)
    assert after_dry[1]["legacy_confirmation_records"] == 0 and after_dry[1]["legacy_import_issues"] == 0
    confirmation_apply = await run(history, account_map, True, "rollout_admin")
    assert confirmation_apply["counts"]["rows_imported"] == 3

    # Supplemental 4 tables: dry-run -> apply -> reconcile
    supplements = {}
    for table_name, csv_path, expected_count, extra_map in (
        ("data_split_patient", split_path, 5, None),
        ("pressure", pressure_path, 4, None),
        ("readmit", readmit_path, 4, None),
        ("tb_news", news_path, 2, account_map),
    ):
        before_supp = (await snapshot(url))[1]
        s_dry = await perform_table(table_name, csv_path, False, None, extra_map)
        assert s_dry["rows_would_import"] == expected_count and s_dry["rows_failed"] == 0
        assert (await snapshot(url))[1] == before_supp, f"{table_name} dry-run mutated DB"
        s_apply = await perform_table(table_name, csv_path, True, "rollout_admin", extra_map)
        assert [s_apply[k] for k in ("rows_seen", "rows_imported", "rows_skipped", "rows_failed")] == [expected_count, expected_count, 0, 0]
        s_rec = await reconcile_table(table_name, csv_path, UUID(s_apply["migration_batch_id"]), extra_map)
        assert s_rec["match_status"] == "match"
        supplements[table_name] = {"dry_run": s_dry, "apply": s_apply, "reconciliation": s_rec}

    assert supplements["data_split_patient"]["reconciliation"]["target_field_totals_for_matched_rows"]["normal_total"] == 11
    assert supplements["data_split_patient"]["reconciliation"]["target_field_totals_for_matched_rows"]["special_total"] == 4
    assert supplements["pressure"]["reconciliation"]["target_field_totals_for_matched_rows"] == {
        "stage2_4_cases": 3,
        "at_risk_patient_days": 65,
        "zero_risk_rows": 1,
    }
    assert supplements["readmit"]["reconciliation"]["target_field_totals_for_matched_rows"] == {
        "readmit_count": 4,
        "discharge_count": 80,
        "provenance_idate_rows": 4,
    }
    assert supplements["tb_news"]["reconciliation"]["target_field_totals_for_matched_rows"] == {
        "published_rows": 1,
        "draft_rows": 1,
        "mapped_publisher_rows": 1,
        "unmapped_or_missing_publisher_rows": 1,
    }

    first = await snapshot(url)
    assert first[1]["specialty_counts"] == 5 * 26
    assert first[1]["pressure_daily"] == 4
    assert first[1]["readmission_monthly"] == 4
    assert first[1]["announcements"] == 2
    assert first[1]["legacy_import_issues"] == 3  # 2 from data_confirm + 1 unmapped news publisher

    # Repeat imports across all 6 tables must add 0 rows
    rerun = await perform(source, True, "rollout_admin")
    assert [rerun[k] for k in ("rows_imported", "rows_skipped", "rows_failed")] == [0, 13, 0]
    confirmation_rerun = await run(history, account_map, True, "rollout_admin")
    assert confirmation_rerun["counts"]["rows_imported"] == 0 and confirmation_rerun["counts"]["rows_skipped"] == 3
    for table_name, csv_path, expected_count, extra_map in (
        ("data_split_patient", split_path, 5, None),
        ("pressure", pressure_path, 4, None),
        ("readmit", readmit_path, 4, None),
        ("tb_news", news_path, 2, account_map),
    ):
        s_rerun = await perform_table(table_name, csv_path, True, "rollout_admin", extra_map)
        assert [s_rerun[k] for k in ("rows_imported", "rows_skipped", "rows_failed")] == [0, expected_count, 0]
        supplements[table_name]["rerun"] = s_rerun

    second = await snapshot(url)
    for table in first[1]:
        if table != "migration_batches":
            assert first[1][table] == second[1][table], "repeat import added rows: " + table
    assert first[2] == second[2] == dict(events=3, missing_actor=2, missing_time=1, missing_entry=0)
    groups = compare_groups(fixture_rows(), second[0])
    assert Counter(r["status"] for r in second[0]) == {"confirmed": 8, "unconfirmed": 5}

    # Extra edge files: blank values must NOT become zero, and issues are recorded in legacy_import_issues
    edge = source.parent / "invalid-data_all.csv"
    rows = []
    for day, patch in [("2026-12-01", {"pt_on": ""}), ("2026-12-02", {"ward": "missing"}),
                       ("2026-12-03", {"wage_type_id": "99"})]:
        rows.append(dict(fixture_rows()[0], idate=day, **patch))
    write_csv(edge, list(rows[0]), rows)
    rejected = await perform(edge, True, "rollout_admin")
    assert [rejected[k] for k in ("rows_seen", "rows_imported", "rows_skipped", "rows_failed")] == [3, 0, 0, 3]
    assert (await snapshot(url))[1]["daily_entries"] == 13

    bad_pressure = source.parent / "invalid-pressure.csv"
    write_csv(
        bad_pressure,
        ["ward", "idate", "do_pressure", "risk_pressure"],
        [
            {"ward": "10", "idate": "2026-12-01", "do_pressure": "", "risk_pressure": "10"},
            {"ward": "99", "idate": "2026-12-02", "do_pressure": "0", "risk_pressure": "5"},
        ],
    )
    rejected_pressure = await perform_table("pressure", bad_pressure, True, "rollout_admin")
    assert [rejected_pressure[k] for k in ("rows_seen", "rows_imported", "rows_skipped", "rows_failed")] == [2, 0, 0, 2]
    assert (await snapshot(url))[1]["pressure_daily"] == 4

    # A blank bed snapshot is supported and must stay NULL, tested in a separate month.
    nullable = source.parent / "null-bed.csv"
    row = dict(fixture_rows()[0], idate="2026-12-04", amount_bed="")
    write_csv(nullable, list(row), [row])
    null_result = await perform(nullable, True, "rollout_admin")
    assert null_result["rows_imported"] == 1
    final = await snapshot(url)
    null_row = next(r for r in final[0] if r["service_date"].isoformat() == "2026-12-04")
    assert null_row["amount_bed"] is None and null_row["nb_move"] == 0
    return {
        "before": before[1],
        "dry_run": dry,
        "apply": applied,
        "reconciliation": reconciliation,
        "confirmation_dry_run": confirmation_dry,
        "confirmation_apply": confirmation_apply,
        "supplements": supplements,
        "rerun": rerun,
        "confirmation_rerun": confirmation_rerun,
        "after_first": first[1],
        "after_repeat": second[1],
        "history": second[2],
        "groups": groups,
        "invalid_rows": rejected,
        "invalid_pressure_rows": rejected_pressure,
        "null_bed": null_result,
    }


def http_report(origin, credentials, reader, create_reader=True):
    admin = shared.Client(origin).login(credentials)
    wards = {w["legacy_code"]: w for w in admin.call("GET", "/wards")}
    assert wards["10"].get("short_name") == "อช" and wards["11"].get("short_name") == "อญ"
    shifts = {s["legacy_shift_id"]: s["id"] for s in admin.call("GET", "/shifts")}
    assert all(shifts[n] != n for n in (1, 2, 3))
    if create_reader:
        created_reader = admin.call(
            "POST",
            "/admin/users",
            dict(
                **reader,
                full_name="พยาบาลทดสอบ อ่านรายงาน",
                ward_roles=[dict(ward_id=wards["10"]["id"], role_code="report_reader")],
            ),
            201,
        )
        assert created_reader.get("full_name") == "พยาบาลทดสอบ อ่านรายงาน"
    scoped = shared.Client(origin).login(reader)
    assert scoped.call("GET", "/auth/me").get("full_name") == "พยาบาลทดสอบ อ่านรายงาน"
    admin_users = {u["username"]: u for u in admin.call("GET", "/admin/users")}
    assert admin_users[reader["username"]].get("full_name") == "พยาบาลทดสอบ อ่านรายงาน"
    result = {}
    for label, client, expected in (("ward_A", scoped, 12), ("all_wards", admin, 18)):
        table = client.call("GET", "/reports/summary/daily-all?selected=2026-11-01&shift_type_id=" + str(shifts[1]))
        column = table["columns"].index("คงเหลือ PT")
        breakdown = sum(r[column] for r in table["rows"][:-1])
        total = table["rows"][-1][column]
        incorrectly_summed = sum(r[column] for r in table["rows"])
        assert breakdown == total == expected and incorrectly_summed == expected * 2
        result[label] = dict(breakdown=breakdown, grand_total=total, old_sum_all_rows=incorrectly_summed)
    scoped.call("GET", "/reports/summary/daily-all?selected=2026-11-01&ward_id=" + wards["11"]["id"], expected=403)

    # Verify imported supplemental tables in real HTTP reports and news endpoints
    spec = admin.call("GET", "/reports/summary/specialty?selected=2026-11-01&through=2026-11-01")
    med_col = spec["columns"].index("MED")
    sum_col = spec["columns"].index("รวมสาขา")
    spec_normal_total = next(r for r in spec["rows"] if r[:3] == ["รวมทุกหอที่เลือก", "รวม", "สามัญ"])
    spec_special_total = next(r for r in spec["rows"] if r[:3] == ["รวมทุกหอที่เลือก", "รวม", "พิเศษ"])
    assert spec_normal_total[med_col] == 6 and spec_normal_total[sum_col] == 9
    assert spec_special_total[sum_col] == 3

    pres = admin.call("GET", "/reports/summary/pressure?selected=2027-09-30")
    nov_col = pres["columns"].index("11/2569")
    year_col = pres["columns"].index("รวมปี")
    pres_a = next(r for r in pres["rows"] if r[0] == wards["10"]["name"])
    pres_b = next(r for r in pres["rows"] if r[0] == wards["11"]["name"])
    assert pres_a[nov_col] == 50 and pres_a[year_col] == 46.15
    assert pres_b[nov_col] is None

    pres_detail = admin.call("GET", "/reports/summary/pressure-detail?selected=2026-11-01&ward_id=" + wards["10"]["id"])
    assert len(pres_detail["rows"]) == 31 and pres_detail["rows"][-1][2:5] == [3, 60, 50]
    pres_detail_b = admin.call("GET", "/reports/summary/pressure-detail?selected=2026-11-01&ward_id=" + wards["11"]["id"])
    assert pres_detail_b["rows"][0][2:] == [0, 0, None, "บันทึกแล้ว"]

    readm = admin.call("GET", "/reports/summary/readmission?selected=2027-09-30")
    readm_nov = readm["columns"].index("11/2569")
    readm_year = readm["columns"].index("รวมปี")
    readm_a = next(r for r in readm["rows"] if r[0] == wards["10"]["name"])
    readm_b = next(r for r in readm["rows"] if r[0] == wards["11"]["name"])
    readm_total = readm["rows"][-1]
    assert readm_a[readm_nov] == 5 and readm_b[readm_nov] == 10 and readm_total[readm_nov] == 6
    assert readm_total[readm_year] == 5

    admin_news = admin.call("GET", "/news")
    reader_news = scoped.call("GET", "/news")
    assert len(admin_news) == 2 and len(reader_news) == 1
    assert reader_news[0]["title"] == "แจ้งทดสอบระบบ" and reader_news[0]["publisher_username"] == credentials["username"]
    draft_news = next(n for n in admin_news if not n["published"])
    assert draft_news["title"] == "ร่างประกาศทดสอบ" and draft_news["publisher_username"] is None

    result["supplemental_reports"] = {
        "specialty_nov_normal_med": spec_normal_total[med_col],
        "specialty_nov_normal_total": spec_normal_total[sum_col],
        "specialty_nov_special_total": spec_special_total[sum_col],
        "pressure_a_nov": pres_a[nov_col],
        "pressure_a_year": pres_a[year_col],
        "pressure_b_nov_null": pres_b[nov_col],
        "pressure_detail_a_nov_summary": pres_detail["rows"][-1][2:5],
        "pressure_detail_b_day1_zero": pres_detail_b["rows"][0][2:],
        "readmission_nov_a_b_total": [readm_a[readm_nov], readm_b[readm_nov], readm_total[readm_nov]],
        "readmission_year_total": readm_total[readm_year],
        "news_admin_count": len(admin_news),
        "news_reader_count": len(reader_news),
        "news_n1_publisher": reader_news[0]["publisher_username"],
        "news_n2_publisher": draft_news["publisher_username"],
    }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pg-bin", required=True)
    parser.add_argument("--with-browser", action="store_true")
    parser.add_argument("--ui-base-url", default="http://localhost:3000")
    args = parser.parse_args()
    pg = Path(args.pg_bin).resolve()
    work = Path(tempfile.mkdtemp(prefix="hospital-rollout-synthetic-"))
    password = secrets.token_urlsafe(32)
    pwfile = work / "password"
    pwfile.write_text(password, encoding="utf-8")
    port, api_port = shared.free_port(), shared.free_port()
    base_url = f"postgresql://rollout_qa:{password}@127.0.0.1:{port}/"
    url = base_url + "rollout_test"
    credentials = dict(username="rollout_admin", password="A1!" + secrets.token_urlsafe(24))
    reader = dict(username="rollout_reader", password="A1!" + secrets.token_urlsafe(24))
    env = {**os.environ, "APP_ENV": "test", "DATABASE_URL": url, "DATABASE_SSL_REQUIRED": "false",
           "PGPASSWORD": password, "PYTHONIOENCODING": "utf-8"}
    os.environ.update({key: env[key] for key in ("APP_ENV", "DATABASE_URL", "DATABASE_SSL_REQUIRED")})
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    started, server = False, None
    result = dict(synthetic_only=True, source="P1 v1: all 6 operational tables", production_access=False)
    with (work / "private.log").open("w", encoding="utf-8") as log:
        def call(cmd):
            process = subprocess.run(list(map(str, cmd)), cwd=BACKEND, env=env, stdout=log, stderr=log, creationflags=flags)
            if process.returncode:
                raise RuntimeError("Local rehearsal command failed; inspect private log, do not publish credentials")

        def pgcmd(name, *args):
            call([pg / (name + ".exe"), "-h", "127.0.0.1", "-p", port, "-U", "rollout_qa", *args])

        def backup(name):
            path = work / (name + ".dump")
            pgcmd("pg_dump", "--format=custom", "--file", path, "rollout_test")
            call([pg / "pg_restore.exe", "--list", path])
            return path, hashlib.sha256(path.read_bytes()).hexdigest()

        def start_api(database_url):
            process = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port)],
                                       cwd=BACKEND, env={**env, "DATABASE_URL": database_url}, stdout=log, stderr=log, creationflags=flags)
            from urllib.request import urlopen
            for _ in range(150):
                try:
                    with urlopen(f"http://127.0.0.1:{api_port}/healthz", timeout=1) as response:
                        if response.status == 200:
                            return process
                except OSError:
                    time.sleep(.1)
            process.terminate()
            process.wait(timeout=15)
            raise RuntimeError("Test HTTP service did not start")

        def browser_reports(stage):
            from urllib.parse import urlsplit
            assert urlsplit(args.ui_base_url).hostname in {"localhost", "127.0.0.1"}
            client = shared.Client(f"http://127.0.0.1:{api_port}").login(credentials)
            shifts = {s["legacy_shift_id"]: s["id"] for s in client.call("GET", "/shifts")}
            config = work / "browser.json"
            config.write_text(json.dumps(dict(origin=f"http://127.0.0.1:{api_port}", ui=args.ui_base_url,
                                              stage=stage, shift=shifts[1], credentials=dict(admin=credentials, reader=reader))), encoding="utf-8")
            output = OUT.parent / ("browser-" + stage + ".json")
            browser_env = {**env, "ROLLOUT_BROWSER_CONFIG": str(config), "ROLLOUT_BROWSER_OUTPUT": str(output)}
            process = subprocess.run(["node", str(BACKEND.parent / "frontend/tests/browser/rollout-import.cjs")],
                                     env=browser_env, cwd=BACKEND, stdout=log, stderr=log, creationflags=flags)
            if process.returncode:
                raise RuntimeError("Browser check failed; private log contains no published credentials")
            return json.loads(output.read_text(encoding="utf-8"))

        try:
            call([pg / "initdb.exe", "-D", work / "data", "-U", "rollout_qa", "--pwfile", pwfile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"])
            call([pg / "pg_ctl.exe", "-D", work / "data", "-l", work / "postgres.log", "-o", f"-h 127.0.0.1 -p {port}", "-w", "start"])
            started = True
            pgcmd("createdb", "rollout_test")
            call([sys.executable, "-m", "alembic", "upgrade", "head"])
            call([sys.executable, "-m", "alembic", "downgrade", "0007_legacy_history_and_issues"])
            call([sys.executable, "-m", "alembic", "upgrade", "head"])
            asyncio.run(shared.seed(url, credentials))
            pre, pre_hash = backup("before-import")
            from app.schemas import COUNTER_FIELDS
            from app.cli.import_legacy_supplements import SPLIT_FIELDS
            source = work / "data_all.csv"
            write_csv(source, ["ward", "idate", "wage_type_id", "amount_bed", *COUNTER_FIELDS, "i_status"], fixture_rows())
            history = work / "data_confirm.csv"
            write_csv(history, ["ward", "idate", "wage_type_id", "cdate", "cuser"], [
                dict(ward="10", idate="2026-11-01", wage_type_id="1", cdate="2026-11-01 08:15:00", cuser="synthetic-a"),
                dict(ward="10", idate="2026-11-01", wage_type_id="2", cdate="", cuser=""),
                dict(ward="11", idate="2026-11-01", wage_type_id="3", cdate="2026-11-01 16:00:00", cuser="synthetic-unmapped"),
            ])
            account_map = work / "account-map.csv"
            write_csv(account_map, ["legacy_account_id", "target_username"], [dict(legacy_account_id="synthetic-a", target_username=credentials["username"])])
            split_rows, pressure_rows, readmit_rows, news_rows = supplement_fixtures()
            split_path = work / "data_split_patient.csv"
            write_csv(split_path, ["ward", "idate", *SPLIT_FIELDS], split_rows)
            pressure_path = work / "pressure.csv"
            write_csv(pressure_path, ["ward", "idate", "do_pressure", "risk_pressure"], pressure_rows)
            readmit_path = work / "readmit.csv"
            write_csv(readmit_path, ["ward", "month1", "idate", "readmit_amount", "discharge_amount"], readmit_rows)
            news_path = work / "tb_news.csv"
            write_csv(news_path, ["id", "title_news", "detail_news", "status_news", "date_news", "time_news", "user_update"], news_rows)

            result["imports"] = asyncio.run(
                imports(url, source, history, account_map, split_path, pressure_path, readmit_path, news_path)
            )
            server = start_api(url)
            result["daily_all_investigation"] = http_report(f"http://127.0.0.1:{api_port}", credentials, reader)
            if args.with_browser:
                result["imported_browser"] = browser_reports("import")
            server.terminate()
            server.wait(timeout=15)
            server = None
            post, post_hash = backup("after-import")
            original = asyncio.run(snapshot(url))
            recovery_started = time.monotonic()
            pgcmd("createdb", "rollout_recovery")
            pgcmd("pg_restore", "--exit-on-error", "--no-owner", "--dbname=rollout_recovery", post)
            restored = asyncio.run(snapshot(base_url + "rollout_recovery"))
            assert original == restored, "restored data differs"
            server = start_api(base_url + "rollout_recovery")
            result["restored_http_reports"] = http_report(f"http://127.0.0.1:{api_port}", credentials, reader, False)
            if args.with_browser:
                result["recovered_browser"] = browser_reports("recovery")
            server.terminate()
            server.wait(timeout=15)
            server = None
            result["recovery"] = dict(passed=True, seconds=round(time.monotonic() - recovery_started, 2), counts=restored[1], backup_sha256=post_hash)
            pgcmd("createdb", "rollout_rollback")
            pgcmd("pg_restore", "--exit-on-error", "--no-owner", "--dbname=rollout_rollback", pre)
            rollback = asyncio.run(snapshot(base_url + "rollout_rollback"))
            assert all(n == 0 for n in rollback[1].values())
            result["rollback"] = dict(passed=True, counts=rollback[1], backup_sha256=pre_hash,
                                      scope="restore before-import snapshot to a new database; no post-cutover writes replayed")
            result["passed"] = True
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            print("PASS synthetic import/repeat/group totals across all 6 tables, HTTP reports/news, backup/restore/rollback. Evidence: docs/rollout/rehearsal-result.json", flush=True)
        finally:
            if server:
                server.terminate()
                server.wait(timeout=15)
            if started:
                call([pg / "pg_ctl.exe", "-D", work / "data", "-m", "fast", "-w", "stop"])


if __name__ == "__main__":
    main()
