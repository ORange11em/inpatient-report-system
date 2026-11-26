"""Safely import normalized data_all CSV exports into a local development database."""
import argparse
import asyncio
import csv
import hashlib
import ipaddress
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import select
from pydantic import Field, ValidationError

from app.config import get_settings
from app.db import get_session_factory
from app.models import (
    AuthSession,
    DailyEntry,
    LegacyKeyMap,
    MigrationBatch,
    ShiftType,
    SubmissionEvent,
    User,
    UserGlobalRole,
    Ward,
)
from app.schemas import COUNTER_FIELDS, DailyEntryCreate


class LegacyEntryInput(DailyEntryCreate):
    amount_bed: int | None = Field(default=None, gt=0, le=2147483647)


SOURCE_SYSTEM = "legacy_inpatient"
SOURCE_TABLE = "data_all"
REQUIRED_HEADERS = {"ward", "idate", "wage_type_id", "amount_bed", *COUNTER_FIELDS}


def parse_args():
    parser = argparse.ArgumentParser(description="Dry-run or import a normalized legacy data_all CSV.")
    parser.add_argument("--source", required=True, type=Path, help="Path to a read-only normalized data_all.csv copy")
    parser.add_argument("--apply", action="store_true", help="Write valid rows to the development database")
    parser.add_argument("--actor-username", help="Existing system-admin username; required with --apply")
    return parser.parse_args()


def check_local_development_target():
    settings = get_settings()
    if settings.app_env.lower() not in {"development", "test"}:
        raise RuntimeError("imports are allowed only when APP_ENV is development or test")
    parsed = urlsplit(settings.async_database_url())
    hostname = parsed.hostname or ""
    try:
        is_loopback = hostname.lower() == "localhost" or ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        is_loopback = False
    if not is_loopback:
        raise RuntimeError("import tool refuses non-loopback database hosts")
    return settings


def load_source(path: Path):
    if not path.is_file():
        raise RuntimeError("source CSV file was not found")
    raw_bytes = path.read_bytes()
    checksum = hashlib.sha256(raw_bytes).hexdigest()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = sorted(REQUIRED_HEADERS - headers)
        if missing:
            raise RuntimeError("source CSV is missing required columns: " + ", ".join(missing))
        rows = list(reader)
    return checksum, rows


def business_key_hash(ward_code: str, service_date: date, legacy_shift_id: int) -> str:
    key = f"{SOURCE_SYSTEM}|{SOURCE_TABLE}|{ward_code}|{service_date.isoformat()}|{legacy_shift_id}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def parse_source_row(row: dict[str, str]) -> tuple[str, date, int, dict]:
    ward_code = (row.get("ward") or "").strip()
    raw_date = (row.get("idate") or "").strip()
    raw_shift = (row.get("wage_type_id") or "").strip()
    if not ward_code:
        raise ValueError("missing_ward_code")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
        raise ValueError("date_not_iso_gregorian")
    try:
        service_date = date.fromisoformat(raw_date)
    except ValueError:
        raise ValueError("invalid_calendar_date") from None
    if not raw_shift.isdecimal() or int(raw_shift) <= 0:
        raise ValueError("invalid_legacy_shift_id")
    legacy_shift_id = int(raw_shift)

    values: dict[str, int | None] = {}
    raw_beds = (row.get("amount_bed") or "").strip()
    if raw_beds:
        if not raw_beds.isdecimal() or int(raw_beds) <= 0 or int(raw_beds) > 2147483647:
            raise ValueError("invalid_amount_bed")
        values["amount_bed"] = int(raw_beds)
    else:
        values["amount_bed"] = None

    for field in COUNTER_FIELDS:
        raw_value = (row.get(field) or "").strip()
        if not raw_value:
            raise ValueError("blank_count_field")
        if not raw_value.isdecimal() or int(raw_value) > 2147483647:
            raise ValueError("invalid_count_field")
        values[field] = int(raw_value)

    if (row.get("i_status") or "").strip() not in ("", "0", "1"):
        raise ValueError("invalid_legacy_confirmation_status")
    return ward_code, service_date, legacy_shift_id, values


async def find_actor(db, username: str | None):
    if not username:
        return None
    normalized = username.strip().casefold()
    query = (
        select(User)
        .join(UserGlobalRole, UserGlobalRole.user_id == User.id)
        .where(User.username_normalized == normalized, UserGlobalRole.role_code == "system_admin", User.is_active.is_(True))
    )
    return await db.scalar(query)


async def perform(source_path: Path, apply_changes: bool, actor_username: str | None):
    settings = check_local_development_target()
    checksum, rows = load_source(source_path)
    source_dates = []
    for candidate in rows:
        try:
            _, candidate_date, _, _ = parse_source_row(candidate)
            source_dates.append(candidate_date)
        except ValueError:
            continue
    date_range = {
        "min": min(source_dates).isoformat() if source_dates else None,
        "max": max(source_dates).isoformat() if source_dates else None,
    }
    factory = get_session_factory()
    async with factory() as db:
        actor = await find_actor(db, actor_username)
        if apply_changes and not actor:
            raise RuntimeError("--apply requires an active system admin selected by --actor-username")

        # Batch metadata is written only in apply mode; this transaction also owns imported rows.
        async with db.begin_nested() if db.in_transaction() else _transaction(db):
            batch = None
            if apply_changes:
                batch = MigrationBatch(
                    source_system=SOURCE_SYSTEM,
                    source_checksum=checksum,
                    state="running",
                    rows_seen=len(rows),
                    rows_imported=0,
                    rows_rejected=0,
                    rows_skipped=0,
                    rows_failed=0,
                    created_by=actor.id,
                )
                db.add(batch)
                await db.flush()

            result = {
                "mode": "apply" if apply_changes else "dry_run",
                "migration_batch_id": str(batch.id) if batch else None,
                "source_table": SOURCE_TABLE,
                "source_checksum_sha256": checksum,
                "source_date_range": date_range,
                "rows_seen": len(rows),
                "rows_would_import": 0,
                "rows_imported": 0,
                "rows_skipped": 0,
                "rows_failed": 0,
                "skip_reasons": Counter(),
                "error_reasons": Counter(),
                "mapping": {
                    "ward": "data_all.ward -> wards.legacy_code",
                    "date": "data_all.idate (Gregorian YYYY-MM-DD) -> daily_entries.service_date",
                    "shift": "data_all.wage_type_id -> shift_types.legacy_shift_id (must already be configured)",
                    "source_key": "SHA-256(source table + ward + date + legacy shift id) -> legacy_key_map",
                    "status": "0 or blank -> unconfirmed; 1 -> confirmed",
                },
            }

            key_occurrences = Counter()
            for candidate in rows:
                try:
                    candidate_ward, candidate_date, candidate_shift, _ = parse_source_row(candidate)
                except ValueError:
                    continue
                candidate_hash = business_key_hash(candidate_ward, candidate_date, candidate_shift)
                key_occurrences[candidate_hash] += 1

            for row in rows:
                try:
                    ward_code, service_date, legacy_shift_id, values = parse_source_row(row)
                except ValueError as exc:
                    result["rows_failed"] += 1
                    result["error_reasons"][str(exc)] += 1
                    continue
                source_key_hash = business_key_hash(ward_code, service_date, legacy_shift_id)
                if key_occurrences[source_key_hash] > 1:
                    result["rows_failed"] += 1
                    result["error_reasons"]["duplicate_source_business_key"] += 1
                    continue

                ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                shift = await db.scalar(select(ShiftType).where(ShiftType.legacy_shift_id == legacy_shift_id))
                if not ward or not ward.is_active:
                    result["rows_failed"] += 1
                    result["error_reasons"]["ward_mapping_missing_or_inactive"] += 1
                    continue
                if not shift or not shift.is_active:
                    result["rows_failed"] += 1
                    result["error_reasons"]["shift_mapping_missing_or_inactive"] += 1
                    continue

                prior_map = await db.scalar(
                    select(LegacyKeyMap).where(
                        LegacyKeyMap.source_system == SOURCE_SYSTEM,
                        LegacyKeyMap.source_table == SOURCE_TABLE,
                        LegacyKeyMap.source_key_hash == source_key_hash,
                    )
                )
                if prior_map:
                    result["rows_skipped"] += 1
                    result["skip_reasons"]["already_imported_source_key"] += 1
                    continue

                existing = await db.scalar(
                    select(DailyEntry).where(
                        DailyEntry.ward_id == ward.id,
                        DailyEntry.service_date == service_date,
                        DailyEntry.shift_type_id == shift.id,
                    )
                )
                if existing:
                    result["rows_skipped"] += 1
                    result["skip_reasons"]["target_business_key_exists_without_crosswalk"] += 1
                    continue

                try:
                    payload = LegacyEntryInput(
                        ward_id=ward.id,
                        service_date=service_date,
                        shift_type_id=shift.id,
                        **values,
                    )
                except ValidationError:
                    result["rows_failed"] += 1
                    result["error_reasons"]["server_schema_validation_error"] += 1
                    continue
                if not apply_changes:
                    result["rows_would_import"] += 1
                    continue

                entry = DailyEntry(
                    **payload.model_dump(include={"ward_id", "service_date", "shift_type_id", "amount_bed", *COUNTER_FIELDS}),
                    created_by=actor.id,
                    updated_by=actor.id,
                    status="confirmed" if (row.get("i_status") or "").strip() == "1" else "unconfirmed",
                )
                db.add(entry)
                await db.flush()
                db.add(LegacyKeyMap(
                    source_system=SOURCE_SYSTEM,
                    source_table=SOURCE_TABLE,
                    source_key_hash=source_key_hash,
                    target_table="daily_entries",
                    target_id=entry.id,
                    migration_batch_id=batch.id,
                ))
                db.add(SubmissionEvent(
                    entry_id=entry.id,
                    actor_id=actor.id,
                    action_code="created",
                    to_status=entry.status,
                    reason="legacy import batch " + str(batch.id),
                ))
                result["rows_imported"] += 1

            if batch:
                batch.rows_imported = result["rows_imported"]
                batch.rows_rejected = result["rows_failed"]
                batch.rows_skipped = result["rows_skipped"]
                batch.rows_failed = result["rows_failed"]
                batch.state = "completed_with_errors" if result["rows_failed"] else "completed"
                await db.flush()

        # Commit one complete apply transaction; dry-run always rolls back its read transaction.
        if apply_changes:
            await db.commit()
        else:
            await db.rollback()

    result["skip_reasons"] = dict(result["skip_reasons"])
    result["error_reasons"] = dict(result["error_reasons"])
    return result


class _transaction:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        await self.db.begin()
        return self.db

    async def __aexit__(self, exc_type, exc, tb):
        if exc_type:
            await self.db.rollback()
        elif self.db.in_transaction():
            await self.db.commit()


async def main():
    args = parse_args()
    try:
        result = await perform(args.source, args.apply, args.actor_username)
    except RuntimeError as exc:
        # RuntimeError messages above are hand-authored safe reasons; never echo driver exceptions.
        print(json.dumps({"status": "aborted", "reason": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        # Database/driver exceptions may contain connection strings or source details.
        print(json.dumps({"status": "aborted", "reason": "database_or_internal_error_details_suppressed"}), file=sys.stderr)
        raise SystemExit(2) from None
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    if result["rows_failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
