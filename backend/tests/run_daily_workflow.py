"""Isolated PostgreSQL + real HTTP acceptance test. Never uses DATABASE_URL from the caller.

Run with --pg-bin pointing to existing PostgreSQL binaries. The private config path is
written to a TEMP pointer for the browser suite; credentials never enter test reports.
The environment stays alive until its private STOP file is created (or 45 minutes).
"""
import asyncio
import csv
import io
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPCookieProcessor
from http.cookiejar import CookieJar
from uuid import uuid4

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
OUT = ROOT / "docs/screenshots/parity-phase-3"
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(name, actual, expected=True):
    if actual != expected:
        raise AssertionError(f"{name}: expected {expected!r}, received {actual!r}")
    checks.append(name)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, origin):
        self.origin = origin
        self.opener = build_opener(HTTPCookieProcessor(CookieJar()))
        self.csrf = ""

    def call(self, method, path, data=None, expected=200, csrf=True):
        headers = {"Content-Type": "application/json"}
        if csrf and self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        req = Request(self.origin + "/api/v1" + path, data=json.dumps(data).encode() if data is not None else None,
                      headers=headers, method=method)
        try:
            response = self.opener.open(req, timeout=20)
        except HTTPError as error:
            response = error
        raw = response.read()
        body = json.loads(raw) if raw else None
        check(f"HTTP {method} {path.split('?')[0]} -> {expected}", response.status, expected)
        return body

    def login(self, credentials):
        self.call("POST", "/auth/login", credentials)
        self.csrf = self.call("GET", "/auth/csrf")["csrf_token"]
        return self


def fixtures():
    text = (ROOT / "docs/parity-fixtures-phase-1.md").read_text(encoding="utf-8")
    raw = list(csv.DictReader(io.StringIO(re.search(r"```csv\n(.*?)```", text, re.S)[1])))
    profiles, specialties = {}, {}
    keys = {row["id"] for row in raw}
    for line in text.splitlines():
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if cells[0] in {"A10", "A11", "A12", "B6", "B5"}:
            profiles[cells[0]] = list(map(int, cells[1:]))
        if cells[0] in keys and len(cells) == 3:
            specialties[cells[0]] = dict((k, int(v)) for k, v in re.findall(r"(\w+)=([0-9]+)", cells[1]))
    return raw, profiles, specialties


async def seed(database_url, credentials):
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select
    from app.models import User, UserGlobalRole, Ward, ShiftType
    from app.security import hash_password, normalize_username
    engine = create_async_engine(database_url.replace("postgresql://", "postgresql+asyncpg://"))
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        user = User(username=credentials["username"], username_normalized=normalize_username(credentials["username"]),
                    password_hash=hash_password(credentials["password"]))
        db.add(user)
        await db.flush()
        db.add(UserGlobalRole(user_id=user.id, role_code="system_admin"))
        for ward in await db.scalars(select(Ward)):
            ward.is_active = ward.legacy_code in {"10", "11"}
            if ward.is_active:
                ward.name = "หอสมมติ " + ("A" if ward.legacy_code == "10" else "B")
        for shift in await db.scalars(select(ShiftType)):
            shift.id += 70  # Ensure primary shift keys differ from legacy 1/2/3.
        await db.commit()
    await engine.dispose()


async def legacy_news(database_url):
    import asyncpg
    db = await asyncpg.connect(database_url)
    try:
        # Reproduce the pre-0006 schema even though old migration 0001 uses current metadata.
        await db.execute("ALTER TABLE announcements DROP COLUMN IF EXISTS updated_by CASCADE")
        await db.execute("ALTER TABLE announcements DROP COLUMN IF EXISTS publisher_username")
        await db.execute("INSERT INTO announcements(id,title,body,published,version) VALUES($1,$2,$3,true,1)",
                         uuid4(), "ข่าวจำลองก่อนเพิ่มผู้ประกาศ", "ไม่ทราบผู้ประกาศเดิม")
    finally:
        await db.close()


def exercise(origin, credentials):
    from app.schemas import COUNTER_FIELDS, SPECIALTY_CODES
    anon = Client(origin)
    anon.call("GET", "/entries", expected=401)
    anon.call("POST", "/auth/login", {"username": "not-present", "password": "synthetic-invalid"}, expected=401)
    admin = Client(origin).login(credentials["admin"])
    wards = {w["legacy_code"]: w for w in admin.call("GET", "/wards")}
    check("ward 10 short_name seeded from legacy reference", wards["10"].get("short_name"), "อช")
    check("ward 11 short_name seeded from legacy reference", wards["11"].get("short_name"), "อญ")
    shifts = {s["legacy_shift_id"]: s["id"] for s in admin.call("GET", "/shifts")}
    check("non-legacy primary shift IDs", all(shifts[n] != n for n in (1, 2, 3)))
    A, B = wards["10"]["id"], wards["11"]["id"]
    assignments = {
        "rec_a": [(A, "ward_recorder")], "rec_b": [(B, "ward_recorder")],
        "reader": [(A, "report_reader")], "multi": [(A, "report_reader"), (B, "report_reader")],
        "mixed": [(A, "ward_recorder"), (B, "report_reader")], "editor": [], "auditor": [],
    }
    for name, roles in assignments.items():
        payload = dict(**credentials[name], ward_roles=[dict(ward_id=w, role_code=r) for w, r in roles])
        if name == "rec_a":
            payload["full_name"] = "พยาบาลสมมติ หอ A"
        if name in {"editor", "auditor"}:
            payload["global_role"] = "system_admin" if name == "editor" else "auditor"
        admin.call("POST", "/admin/users", payload, 201)
    clients = {name: Client(origin).login(value) for name, value in credentials.items()}
    check("rec_a auth/me includes full_name", clients["rec_a"].call("GET", "/auth/me").get("full_name"), "พยาบาลสมมติ หอ A")
    check("rec_b auth/me full_name defaults to None", clients["rec_b"].call("GET", "/auth/me").get("full_name"), None)
    admin_users = {u["username"]: u for u in admin.call("GET", "/admin/users")}
    check("admin/users lists full_name", admin_users[credentials["rec_a"]["username"]].get("full_name"), "พยาบาลสมมติ หอ A")
    patched_rec_b = admin.call("PATCH", "/admin/users/" + str(admin_users[credentials["rec_b"]["username"]]["id"]), {"full_name": "พยาบาลสมมติ หอ B"})
    check("admin/users patch updates full_name", patched_rec_b.get("full_name"), "พยาบาลสมมติ หอ B")
    patched_rec_b_clear = admin.call("PATCH", "/admin/users/" + str(admin_users[credentials["rec_b"]["username"]]["id"]), {"full_name": ""})
    check("admin/users patch blank clears full_name to None", patched_rec_b_clear.get("full_name"), None)
    for name, count in [("rec_a", 1), ("rec_b", 1), ("reader", 1), ("multi", 2), ("mixed", 2), ("admin", 2), ("auditor", 0)]:
        check(name + " ward scope", len(clients[name].call("GET", "/wards")), count)
    old_news = admin.call("GET", "/news")[0]
    check("migration preserves unknown news publisher", old_news["publisher_username"], None)

    raw, profiles, specialty_values = fixtures()
    pressure = {"A1031E": (0, 5), "A1101E": (1, 10), "A1102E": (2, 50), "B1101E": (0, 0)}
    monthly = {("10", "10"): (1, 20), ("11", "10"): (0, 10), ("10", "11"): (2, 40), ("11", "11"): (1, 10)}
    entries = {}
    for row in raw:
        body = dict.fromkeys(COUNTER_FIELDS, 0)
        for key, value in row.items():
            if key.endswith(("_pt", "_nb")):
                suffix, group = key.rsplit("_", 1)
                body[group + "_" + suffix] = int(value)
        body.update(zip(("patient_type"+str(n) for n in (5, 4, 3, 2, 1)), profiles[row["profile"]]))
        body.update(em_hn=1, em_rn=2, em_tn=1, em_pn=1, em_aid=1,
                    ward_id=wards[row["ward"]]["id"], service_date=row["idate"],
                    shift_type_id=shifts[int(row["wage_type_id"])] , amount_bed=int(row["amount_bed"]))
        if row["wage_type_id"] == "3":
            values = specialty_values[row["id"]]
            body["specialties"] = [dict(specialty_code=c, category_code=g, count_value=values.get(c+"_"+g, 0)) for c in SPECIALTY_CODES for g in ("n", "s")]
            if row["id"] in pressure:
                body["pressure"] = dict(zip(("stage2_4_cases", "at_risk_patient_days"), pressure[row["id"]]))
        body["readmission"] = dict(zip(("readmit_count", "discharge_count"), monthly[row["ward"], row["idate"][5:7]]))
        client = clients["rec_a" if row["ward"] == "10" else "rec_b"]
        item = client.call("POST", "/entries", body, 201)
        for field in COUNTER_FIELDS:
            check("P1 " + row["id"] + " " + field, item[field], body[field])
        if "specialties" in body:
            check("P1 specialty " + row["id"], sorted(item["specialties"], key=str), sorted(body["specialties"], key=str))
        if row["i_status"] == "1":
            item = client.call("POST", "/entries/"+item["id"]+"/confirm", {"expected_version": item["version"]})
        entries[row["id"]] = item
    check("P1 rows", len(admin.call("GET", "/entries")), 13)
    check("P1 confirmed", len(admin.call("GET", "/entries?status=confirmed")), 8)
    check("P1 pending", admin.call("GET", "/entries/pending-count")["count"], 5)
    counts_path = "/entries/status-counts"
    check("history totals across wards", admin.call("GET", counts_path), {"all": 13, "unconfirmed": 5, "confirmed": 8})
    check("ward recorder totals", clients["rec_a"].call("GET", counts_path), {"all": 8, "unconfirmed": 3, "confirmed": 5})
    check("no assigned ward totals", clients["auditor"].call("GET", counts_path), {"all": 0, "unconfirmed": 0, "confirmed": 0})
    day_filter = "?" + urlencode(dict(ward_id=A, date_from="2026-11-01", date_to="2026-11-01"))
    day_rows = admin.call("GET", "/entries" + day_filter)
    check("ward and inclusive date totals", admin.call("GET", counts_path + day_filter),
          {"all": len(day_rows), "unconfirmed": sum(r["status"] == "unconfirmed" for r in day_rows),
           "confirmed": sum(r["status"] == "confirmed" for r in day_rows)})
    clients["rec_a"].call("GET", counts_path + "?ward_id=" + B, expected=403)
    admin.call("GET", counts_path + "?date_from=2026-11-02&date_to=2026-11-01", expected=422)
    anon.call("GET", counts_path, expected=401)
    for name, count in [("rec_a", 3), ("rec_b", 2), ("multi", 5), ("auditor", 0)]:
        check(name+" pending all dates", clients[name].call("GET", "/entries/pending-count")["count"], count)
    def form(client, ward, day, shift):
        return client.call("GET", "/entry-form?"+urlencode(dict(ward_id=ward, service_date=day, shift_type_id=shifts[shift])))
    backfill = form(clients["rec_a"], A, "2026-11-02", 2)
    check("same-date backfill source", [backfill[k] for k in ("pt_on", "nb_on", "amount_bed", "source_date", "source_shift_id")], [10, 1, 25, "2026-11-02", shifts[3]])
    empty = form(clients["rec_a"], A, "2026-10-30", 1)
    check("before first row has no fabricated beds", [empty["pt_on"], empty["amount_bed"]], [0, None])
    check("opening existing row preserves its identity", form(clients["rec_a"], A, "2026-11-01", 3)["entry"]["id"], entries["A1101E"]["id"])
    # Each role's report/entry/event scope, independently of UI hiding controls.
    for name, expected in [("rec_a", 12), ("reader", 12), ("multi", 18), ("mixed", 18), ("admin", 18)]:
        report = clients[name].call("GET", f"/reports/summary/daily-all?selected=2026-11-01&shift_type_id={shifts[1]}")
        total_column = report["columns"].index("คงเหลือ PT")
        check(name+" daily-all PT closing breakdown", sum(r[total_column] for r in report["rows"][:-1]), expected)
        check(name+" daily-all PT closing grand total", report["rows"][-1][total_column], expected)
    for name in ("rec_a", "reader", "auditor"):
        for suffix in ("", "/events"):
            clients[name].call("GET", "/entries/"+entries["B1101N"]["id"]+suffix, expected=403)
        clients[name].call("GET", "/reports/summary/daily-all?selected=2026-11-01&ward_id="+B, expected=403)
    for name in ("reader", "multi", "mixed"):
        clients[name].call("PATCH", "/entries/"+entries["B1101E"]["id"], {"expected_version": 1, "pt_in": 1}, 403)
        clients[name].call("POST", "/entries/"+entries["B1101E"]["id"]+"/confirm", {"expected_version": 1}, 403)
        clients[name].call("POST", "/entries/"+entries["A1101N"]["id"]+"/return", {"expected_version": 2, "reason": "ทดสอบ"}, 403)

    target = entries["A1101M"]
    lifecycle = []
    def remember(label, actor, item):
        lifecycle.append(dict(step=label, actor=credentials[actor]["username"], status=item["status"], version=item["version"]))
    remember("บันทึก", "rec_a", target)
    target = clients["rec_a"].call("POST", "/entries/"+target["id"]+"/confirm", {"expected_version": target["version"]})
    remember("ยืนยัน", "rec_a", target)
    check("updated ward totals after confirmation", clients["rec_a"].call("GET", counts_path), {"all": 8, "unconfirmed": 2, "confirmed": 6})
    clients["rec_a"].call("PATCH", "/entries/"+target["id"], {"expected_version": target["version"], "pt_in": 2}, 409)
    admin.call("POST", "/entries/"+target["id"]+"/return", {"expected_version": target["version"], "reason": "   "}, 422)
    target = admin.call("POST", "/entries/"+target["id"]+"/return", {"expected_version": target["version"], "reason": "  ตรวจยอดรับใหม่สมมติ  "})
    remember("ส่งกลับ", "admin", target)
    target = clients["rec_a"].call("PATCH", "/entries/"+target["id"], {"expected_version": target["version"], "pt_in": 2})
    remember("แก้ไขหลังส่งกลับ", "rec_a", target)
    clients["rec_a"].call("POST", "/entries/"+target["id"]+"/confirm", {"expected_version": 1}, 409)
    target = clients["rec_a"].call("POST", "/entries/"+target["id"]+"/confirm", {"expected_version": target["version"]})
    remember("ยืนยันซ้ำ", "rec_a", target)
    events = clients["rec_a"].call("GET", "/entries/"+target["id"]+"/events")
    check("cycle actions", [r["action_code"] for r in events], ["created", "confirmed", "returned", "updated", "confirmed"])
    check("cycle actors", [r["actor_username"] for r in events], [credentials[n]["username"] for n in ["rec_a", "rec_a", "admin", "rec_a", "rec_a"]])
    check("return reason retained and trimmed", events[2]["reason"], "ตรวจยอดรับใหม่สมมติ")
    check("confirmed after complete cycle", target["status"], "confirmed")
    check("post-cycle pending", admin.call("GET", "/entries/pending-count")["count"], 4)
    clients["rec_a"].call("PUT", f"/indicators/pressure/{A}/2026-11-01", {"stage2_4_cases": 9, "at_risk_patient_days": 10}, 409)

    zero = dict(ward_id=A, service_date="2026-12-01", shift_type_id=shifts[1], amount_bed=10)
    item = clients["rec_a"].call("POST", "/entries", zero, 201)
    check("zero counters accepted", [item[k] for k in COUNTER_FIELDS], [0]*len(COUNTER_FIELDS))
    check("omitted monthly values remain absent", form(clients["rec_a"], A, "2026-12-01", 1)["readmission"], None)
    clients["rec_a"].call("PATCH", "/entries/"+item["id"], {"expected_version": 1, "readmission": {"readmit_count": 0, "discharge_count": 0}})
    check("explicit monthly zeros round-trip", form(clients["rec_a"], A, "2026-12-01", 1)["readmission"], {"readmit_count": 0, "discharge_count": 0})
    for value in ("", None, 0):
        clients["rec_a"].call("POST", "/entries", {**zero, "service_date": "2026-12-02", "amount_bed": value}, 422)
    for value in ("", None, -1, 1.5, True):
        clients["rec_a"].call("POST", "/entries", {**zero, "service_date": "2026-12-02", "pt_on": value}, 422)
    for pair in ({"readmit_count": "", "discharge_count": 0}, {"readmit_count": 0}):
        clients["rec_a"].call("POST", "/entries", {**zero, "service_date": "2026-12-02", "readmission": pair}, 422)
    clients["rec_a"].call("POST", "/entries", zero, 409)
    clients["rec_a"].call("POST", "/entries", {**zero, "service_date": "2026-12-02", "pressure": {"stage2_4_cases": 0, "at_risk_patient_days": 0}}, 422)
    check("failed supplement write rolls back entry", form(clients["rec_a"], A, "2026-12-02", 1)["entry"], None)
    month_entry = entries["A1102N"]
    clients["rec_a"].call("PATCH", "/entries/"+month_entry["id"], {"expected_version": 1, "pt_in": 99, "readmission": {"readmit_count": 3, "discharge_count": 40}, "previous_readmission": {"readmit_count": 0, "discharge_count": 0}}, 409)
    check("monthly conflict rolls back shift", clients["rec_a"].call("GET", "/entries/"+month_entry["id"])["pt_in"], 0)
    check("monthly conflict rolls back event", len(clients["rec_a"].call("GET", "/entries/"+month_entry["id"]+"/events")), 1)
    all_specialties = [dict(specialty_code=c, category_code=g, count_value=i*2+j) for i,c in enumerate(SPECIALTY_CODES,1) for j,g in enumerate(("n", "s"))]
    item = clients["rec_a"].call("POST", "/entries", {**zero, "service_date": "2026-12-03", "shift_type_id": shifts[3], "specialties": all_specialties, "pressure": {"stage2_4_cases": 0, "at_risk_patient_days": 0}}, 201)
    check("all 13 specialties and both categories exact", sorted(item["specialties"], key=str), sorted(all_specialties, key=str))
    # News writer must come from the authenticated writer, never the reader or request body.
    news = admin.call("POST", "/news", {"title": "ข่าวทดสอบวงจร", "body": "ข้อมูลสมมติ", "published": False}, 201)
    check("draft publisher", news["publisher_username"], credentials["admin"]["username"])
    check("reader cannot see draft", any(n["id"] == news["id"] for n in clients["reader"].call("GET", "/news")), False)
    clients["reader"].call("POST", "/news", {"title": "ห้ามสร้าง", "body": "ทดสอบ"}, 403)
    admin.call("POST", "/news", {"title": "ปลอมผู้ประกาศ", "body": "ทดสอบ", "publisher_username": "forged"}, 422)
    news = clients["editor"].call("PUT", "/news/"+news["id"]+"?version=1", {"title": news["title"], "body": news["body"], "published": True})
    check("published editor matches legacy user_update", news["publisher_username"], credentials["editor"]["username"])
    reader_news = next(n for n in clients["reader"].call("GET", "/news") if n["id"] == news["id"])
    check("reader sees actual publisher", reader_news["publisher_username"], credentials["editor"]["username"])
    news = admin.call("PUT", "/news/"+news["id"]+"?version=2", {"title": "ข่าวทดสอบแก้ไข", "body": "แก้ไขแล้ว", "published": True})
    check("news update changes writer snapshot", news["publisher_username"], credentials["admin"]["username"])
    clients["reader"].call("DELETE", "/news/"+news["id"]+"?version=3", expected=403)
    admin.call("DELETE", "/news/"+news["id"]+"?version=3", expected=204)
    check("news deletion visible to reader", any(n["id"] == news["id"] for n in clients["reader"].call("GET", "/news")), False)
    clients["rec_a"].call("PATCH", "/entries/"+month_entry["id"], {"expected_version": 1, "pt_in": 1}, 403, csrf=False)
    role_matrix = []
    for index, name in enumerate(credentials):
        client = clients[name]
        readable = {"admin": {A, B}, "editor": {A, B}, "rec_a": {A}, "rec_b": {B}, "reader": {A}, "multi": {A, B}, "mixed": {A, B}, "auditor": set()}[name]
        writable = {"admin": {A, B}, "editor": {A, B}, "rec_a": {A}, "rec_b": {B}, "reader": set(), "multi": set(), "mixed": {A}, "auditor": set()}[name]
        for ward, label, sample in [(A, "A", entries["A1101N"]), (B, "B", entries["B1101N"])]:
            for suffix in ("", "/events"):
                client.call("GET", "/entries/"+sample["id"]+suffix, expected=200 if ward in readable else 403)
            item = client.call("POST", "/entries", {**zero, "ward_id": ward, "service_date": f"2027-01-{10+index:02d}"}, 201 if ward in writable else 403)
            if ward in writable:
                item = client.call("PATCH", "/entries/"+item["id"], {"expected_version": item["version"], "pt_in": 1})
                item = client.call("POST", "/entries/"+item["id"]+"/confirm", {"expected_version": item["version"]})
                client.call("PATCH", "/entries/"+item["id"], {"expected_version": item["version"], "pt_in": 2}, 409)
                if name not in {"admin", "editor"}:
                    client.call("POST", "/entries/"+item["id"]+"/return", {"expected_version": item["version"], "reason": "ทดสอบสิทธิ์"}, 403)
                (client if name in {"admin", "editor"} else admin).call("POST", "/entries/"+item["id"]+"/return", {"expected_version": item["version"], "reason": "ทดสอบสิทธิ์ข้ามหอ"})
            else:
                client.call("PATCH", "/entries/"+sample["id"], {"expected_version": sample["version"], "pt_in": 2}, 403)
                client.call("POST", "/entries/"+sample["id"]+"/confirm", {"expected_version": sample["version"]}, 403)
                client.call("POST", "/entries/"+sample["id"]+"/return", {"expected_version": sample["version"], "reason": "ทดสอบสิทธิ์"}, 403)
            role_matrix.append(dict(actor=credentials[name]["username"], ward=label, read=ward in readable, write_and_confirm=ward in writable, return_entry=name in {"admin", "editor"}))
    clients["rec_b"].call("POST", "/auth/logout", expected=204)
    clients["rec_b"].call("GET", "/entries", expected=401)
    result = dict(passed=True, assertion_count=len(checks), checks=checks, lifecycle=lifecycle, cycle_events=events, role_matrix=role_matrix,
                  migrations=["fresh empty database to head", "pre-0006 news row to head", "downgrade to 0005 and upgrade again"],
                  scope="fresh private PostgreSQL + real FastAPI HTTP; synthetic P1 fixture", ward_names={k:v["name"] for k,v in wards.items()})
    (OUT / "api-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return dict(wards=wards, shifts=shifts, entries=entries, api_cycle_entry=target, browser_cycle_entry=entries["A1102E"])


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pg-bin", required=True)
    args = parser.parse_args()
    pg = Path(args.pg_bin).resolve()
    work = Path(tempfile.mkdtemp(prefix="inpatient-parity-phase3-env-"))
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    pg_port, api_port = free_port(), free_port()
    password = secrets.token_urlsafe(32)
    pwfile = work / "pg-password"
    pwfile.write_text(password, encoding="utf-8")
    database_url = f"postgresql://phase3_qa:{password}@127.0.0.1:{pg_port}/parity_phase3"
    env = {**os.environ, "APP_ENV": "test", "DATABASE_URL": database_url, "DATABASE_SSL_REQUIRED": "false", "PGPASSWORD": password, "PYTHONIOENCODING": "utf-8"}
    credentials = {name: dict(username="phase3_"+name, password="T9!"+secrets.token_urlsafe(24)) for name in ("admin", "editor", "rec_a", "rec_b", "reader", "multi", "mixed", "auditor")}
    server = None
    started = False
    with (work/"infrastructure.log").open("w", encoding="utf-8") as log:
        def run(command):
            subprocess.run(list(map(str, command)), cwd=BACKEND, env=env, check=True, stdout=log, stderr=log, creationflags=flags)
        try:
            run([pg/"initdb.exe", "-D", work/"data", "-U", "phase3_qa", "--pwfile", pwfile, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"])
            run([pg/"pg_ctl.exe", "-D", work/"data", "-l", work/"postgres.log", "-o", f"-h 127.0.0.1 -p {pg_port}", "-w", "start"])
            started = True
            # Exercise a clean installation separately from upgrading rows predating 0006.
            run([pg/"createdb.exe", "-h", "127.0.0.1", "-p", pg_port, "-U", "phase3_qa", "parity_phase3_fresh"])
            fresh_env = {**env, "DATABASE_URL": database_url.replace("/parity_phase3", "/parity_phase3_fresh")}
            subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=fresh_env, check=True, stdout=log, stderr=log, creationflags=flags)
            run([pg/"createdb.exe", "-h", "127.0.0.1", "-p", pg_port, "-U", "phase3_qa", "parity_phase3"])
            run([sys.executable, "-m", "alembic", "upgrade", "0005_ward_report_groups"])
            asyncio.run(legacy_news(database_url))
            run([sys.executable, "-m", "alembic", "upgrade", "head"])
            run([sys.executable, "-m", "alembic", "downgrade", "0005_ward_report_groups"])
            run([sys.executable, "-m", "alembic", "upgrade", "head"])
            asyncio.run(seed(database_url, credentials["admin"]))
            server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port)], cwd=BACKEND, env=env, stdout=log, stderr=log, creationflags=flags)
            origin = f"http://127.0.0.1:{api_port}"
            for _ in range(100):
                try:
                    with build_opener().open(origin+"/healthz", timeout=1) as response:
                        if response.status == 200: break
                except OSError: time.sleep(.1)
            manifest = exercise(origin, credentials)
            config = dict(origin=origin, credentials=credentials, **manifest)
            private = work/"browser-config.json"
            private.write_text(json.dumps(config), encoding="utf-8")
            (Path(tempfile.gettempdir())/"inpatient-phase3-test-pointer.json").write_text(json.dumps(dict(config=str(private), stop=str(work/"STOP"))), encoding="utf-8")
            print(f"PASS {len(checks)} API assertions; fresh migration and upgrade/downgrade/upgrade passed. Private browser environment ready.", flush=True)
            until = time.monotonic() + 45*60
            while not (work/"STOP").exists() and time.monotonic() < until:
                time.sleep(.5)
        finally:
            if server is not None:
                server.terminate()
                server.wait(timeout=15)
            if started:
                run([pg/"pg_ctl.exe", "-D", work/"data", "-m", "fast", "-w", "stop"])
            print("Stopped only the private phase 3 API/PostgreSQL environment", flush=True)


if __name__ == "__main__":
    main()
