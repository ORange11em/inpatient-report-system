"""Isolated PostgreSQL rehearsal for legacy daily rows + confirmation history."""
import argparse
import asyncio
import csv
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
from uuid import uuid4

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def write_csv(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


async def seed(database_url):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy import select
    from app.models import ShiftType, User, UserGlobalRole, Ward
    from app.security import hash_password, normalize_username
    engine = create_async_engine(database_url.replace("postgresql://", "postgresql+asyncpg://"))
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        user = User(username="phase5_admin", username_normalized=normalize_username("phase5_admin"),
                    password_hash=hash_password(secrets.token_urlsafe(32)))
        db.add(user)
        await db.flush()
        ward = await db.scalar(select(Ward).where(Ward.legacy_code == "10"))
        shift = await db.scalar(select(ShiftType).where(ShiftType.legacy_shift_id == 1))
        assert ward and shift
        ward.is_active = True
        ward.report_group = 1
        db.add(UserGlobalRole(user_id=user.id, role_code="system_admin"))
        await db.commit()
        result = (str(user.id), str(ward.id))
    await engine.dispose()
    return result


async def verify(database_url, source_path, map_path, ward_id):
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from app.cli.import_legacy_confirmations import run as import_confirmations
    from app.cli.import_legacy import perform as import_daily
    from app.models import DailyEntry, LegacyConfirmationRecord, LegacyImportIssue
    from app.models import User
    from app.api import daily_report, entry_events
    from app.db import get_session_factory
    from app.config import get_settings

    get_settings.cache_clear()
    get_session_factory.cache_clear()
    os.environ["DATABASE_URL"] = database_url
    daily_path = source_path.parent / "data_all.csv"
    from app.schemas import COUNTER_FIELDS
    fields = ["ward", "idate", "wage_type_id", "amount_bed", *COUNTER_FIELDS, "i_status"]
    daily = {name: "0" for name in fields}
    daily.update(ward="10", idate="2026-11-01", wage_type_id="1", amount_bed="20", pt_on="10", pt_in="2", em_hn="1", em_rn="2", i_status="1")
    write_csv(daily_path, fields, [daily])
    result = await import_daily(daily_path, True, "phase5_admin")
    assert result["rows_seen"] == 1 and result["rows_imported"] == 1 and result["rows_failed"] == 0
    factory = get_session_factory()
    async with factory() as db:
        entry_id = await db.scalar(select(DailyEntry.id).where(DailyEntry.service_date == __import__("datetime").date(2026, 11, 1)))
    assert entry_id is not None, f"synthetic data_all import did not persist: {result}"
    dry = await import_confirmations(source_path, map_path, False, None)
    assert dry["counts"]["rows_seen"] == 3 and dry["counts"]["rows_would_import"] == 3
    assert dry["counts"]["account_mapped"] == 1 and dry["counts"]["account_unmapped"] == 1
    assert dry["counts"]["timestamp_missing"] == 1 and dry["counts"].get("entry_missing", 0) == 0
    applied = await import_confirmations(source_path, map_path, True, "phase5_admin")
    assert applied["counts"]["rows_imported"] == 3 and applied["counts"]["rows_skipped"] == 0
    rerun = await import_confirmations(source_path, map_path, True, "phase5_admin")
    assert rerun["counts"]["rows_imported"] == 0 and rerun["counts"]["rows_skipped"] == 3

    async with factory() as db:
        count = await db.scalar(select(func.count()).select_from(LegacyConfirmationRecord))
        issues = await db.scalar(select(func.count()).select_from(LegacyImportIssue))
        current = await db.get(DailyEntry, entry_id)
        assert count == 3 and issues == 2
        assert current.status == "confirmed" and current.pt_on == 10
        user = await db.scalar(select(User).where(User.username_normalized == "phase5_admin"))
        report = await daily_report(current.service_date, db, (user, None), ward_id, None)
        assert len(report.entries) == 1 and report.entries[0].pt_on == 10
        activity = await entry_events(entry_id, db, (user, None))
        legacy_activity = [event for event in activity if event.action_code == "legacy_confirmed"]
        assert len(legacy_activity) == 3
        assert sum(event.actor_username is None for event in legacy_activity) == 2
        assert sum(event.occurred_at is None for event in legacy_activity) == 1
        events = (await db.scalars(select(LegacyConfirmationRecord).where(LegacyConfirmationRecord.entry_id == entry_id))).all()
        assert sum(event.actor_id is not None for event in events) == 1
        assert sum(event.confirmed_at is None for event in events) == 1
        assert sum(event.actor_id is None for event in events) == 2
    engine = create_async_engine(database_url.replace("postgresql://", "postgresql+asyncpg://"))
    await engine.dispose()
    return {"data_all": result, "daily_report_after_import": {"rows": len(report.entries), "pt_on": report.entries[0].pt_on},
            "legacy_activity_after_import": {"events": len(legacy_activity),
                                             "missing_actor": sum(event.actor_username is None for event in legacy_activity),
                                             "missing_timestamp": sum(event.occurred_at is None for event in legacy_activity)},
            "data_confirm_dry_run": dry, "data_confirm_apply": applied,
            "data_confirm_rerun": rerun, "history_rows_after_rerun": count, "exception_rows_after_rerun": issues,
            "current_status_unchanged": current.status}


async def find_entry(database_url):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from app.models import DailyEntry
    engine = create_async_engine(database_url.replace("postgresql://", "postgresql+asyncpg://"))
    async with async_sessionmaker(engine)() as db:
        entry_id = await db.scalar(select(DailyEntry.id))
    await engine.dispose()
    return entry_id


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pg-bin", required=True)
    args = parser.parse_args()
    pg = Path(args.pg_bin).resolve()
    work = Path(tempfile.mkdtemp(prefix="inpatient-phase5-db-"))
    db_port = port()
    password = secrets.token_urlsafe(30)
    pwfile = work / "pg-password"
    pwfile.write_text(password, encoding="utf-8")
    database_url = f"postgresql://phase5_qa:{password}@127.0.0.1:{db_port}/phase5_qa"
    env = {**os.environ, "APP_ENV": "test", "DATABASE_URL": database_url,
           "DATABASE_SSL_REQUIRED": "false", "PGPASSWORD": password, "PYTHONIOENCODING": "utf-8"}
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    started = False
    with (work / "run.log").open("w", encoding="utf-8") as log:
        def call(command):
            subprocess.run(list(map(str, command)), cwd=BACKEND, env=env, check=True,
                           stdout=log, stderr=log, creationflags=flags)
        try:
            call([pg / "initdb.exe", "-D", work / "data", "-U", "phase5_qa", "--pwfile", pwfile,
                  "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"])
            call([pg / "pg_ctl.exe", "-D", work / "data", "-l", work / "postgres.log",
                  "-o", f"-h 127.0.0.1 -p {db_port}", "-w", "start"])
            started = True
            call([pg / "createdb.exe", "-h", "127.0.0.1", "-p", db_port, "-U", "phase5_qa", "phase5_qa"])
            call([sys.executable, "-m", "alembic", "upgrade", "head"])
            _, ward_id = asyncio.run(seed(database_url))
            source = work / "data_confirm.csv"
            write_csv(source, ["ward", "idate", "wage_type_id", "cdate", "cuser"], [
                dict(ward="10", idate="2026-11-01", wage_type_id="1", cdate="2026-11-01 08:15:00", cuser="r-a"),
                dict(ward="10", idate="2026-11-01", wage_type_id="1", cdate="", cuser=""),
                dict(ward="10", idate="2026-11-01", wage_type_id="1", cdate="2026-11-01 16:00:00", cuser="orphan-7"),
            ])
            account_map = work / "account-map.csv"
            write_csv(account_map, ["legacy_account_id", "target_username"], [dict(legacy_account_id="r-a", target_username="phase5_admin")])
            result = asyncio.run(verify(database_url, source, account_map, ward_id))
            print("PASS isolated PostgreSQL migration + data_all import + data_confirm dry-run/apply/rerun")
            print(result)
        finally:
            if started:
                call([pg / "pg_ctl.exe", "-D", work / "data", "-m", "fast", "-w", "stop"])


if __name__ == "__main__":
    main()
