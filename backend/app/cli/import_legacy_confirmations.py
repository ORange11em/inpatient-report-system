"""Import data_confirm history without fabricating an actor or timestamp."""
import argparse
import asyncio
import csv
import hashlib
import ipaddress
import json
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory
from app.models import (
    DailyEntry, LegacyConfirmationRecord, LegacyImportIssue, MigrationBatch,
    ShiftType, User, UserGlobalRole, Ward,
)
from app.cli.import_legacy import SOURCE_SYSTEM


def parse_args():
    parser = argparse.ArgumentParser(description="Dry-run or import normalized data_confirm.csv history.")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--account-map", type=Path, help="CSV columns: legacy_account_id,target_username")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--actor-username", help="Existing system-admin import operator; not treated as confirmer")
    return parser.parse_args()


def read_csv(path, required):
    raw = path.read_bytes()
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError("source CSV missing required headers: " + ", ".join(sorted(missing)))
        return hashlib.sha256(raw).hexdigest(), list(reader)


def parse_optional_date(raw):
    value = (raw or "").strip()
    if not value:
        return None
    return date.fromisoformat(value)


def parse_optional_datetime(raw):
    value = (raw or "").strip()
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        # MySQL DATETIME stores no zone; preserve its wall-clock value as naive.
        return parsed
    return parsed


def safe_row_hash(row, ordinal):
    canonical = json.dumps({k: (row.get(k) or "").strip() for k in sorted(row)}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(f"data_confirm|{canonical}|{ordinal}".encode()).hexdigest()


def assert_local_target():
    settings = get_settings()
    parsed = urlsplit(settings.async_database_url())
    host = parsed.hostname or ""
    try:
        loopback = host.lower() == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        loopback = False
    if settings.app_env.lower() not in {"development", "test"} or not loopback:
        raise RuntimeError("imports are allowed only on a loopback development or test database")


async def run(source_path, map_path, apply, operator_username):
    assert_local_target()
    checksum, rows = read_csv(source_path, {"ward", "idate", "wage_type_id", "cdate", "cuser"})
    actor_map = {}
    if map_path:
        _, mappings = read_csv(map_path, {"legacy_account_id", "target_username"})
        for item in mappings:
            legacy_id = (item.get("legacy_account_id") or "").strip()
            username = (item.get("target_username") or "").strip().casefold()
            if legacy_id and username:
                if legacy_id in actor_map:
                    raise RuntimeError("account map contains duplicate legacy_account_id")
                actor_map[legacy_id] = username

    factory = get_session_factory()
    async with factory() as db:
        operator = None
        if operator_username:
            operator = await db.scalar(select(User).join(UserGlobalRole, UserGlobalRole.user_id == User.id).where(
                User.username_normalized == operator_username.strip().casefold(),
                UserGlobalRole.role_code == "system_admin", User.is_active.is_(True),
            ))
        if apply and not operator:
            raise RuntimeError("--apply requires an active existing --actor-username")

        resolved_actor = {}
        if actor_map:
            users = (await db.scalars(select(User).where(User.is_active.is_(True)))).all()
            users_by_name = {u.username_normalized: u for u in users}
            resolved_actor = {legacy: users_by_name.get(name) for legacy, name in actor_map.items()}

        table_counts = Counter(rows_seen=len(rows), rows_imported=0, rows_skipped=0, rows_failed=0)
        source_dates = []
        issues = []
        prepared = []
        ordinal_counts = Counter()
        for row in rows:
            raw_user = (row.get("cuser") or "").strip() or None
            event_hash = hashlib.sha256(json.dumps(row, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            ordinal_counts[event_hash] += 1
            row_hash = safe_row_hash(row, ordinal_counts[event_hash])
            try:
                ward_code = (row.get("ward") or "").strip()
                service_date = parse_optional_date(row.get("idate"))
                raw_shift = (row.get("wage_type_id") or "").strip()
                if not ward_code or service_date is None or not raw_shift.isdecimal():
                    raise ValueError("invalid_ward_date_or_shift")
                source_dates.append(service_date)
                shift_id = int(raw_shift)
                ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                shift = await db.scalar(select(ShiftType).where(ShiftType.legacy_shift_id == shift_id))
                if not ward:
                    raise ValueError("ward_mapping_missing")
                if not shift:
                    raise ValueError("shift_mapping_missing")
                try:
                    stamp = parse_optional_datetime(row.get("cdate"))
                except ValueError:
                    raise ValueError("invalid_confirmation_timestamp") from None
                target_entry = await db.scalar(select(DailyEntry).where(
                    DailyEntry.ward_id == ward.id,
                    DailyEntry.service_date == service_date,
                    DailyEntry.shift_type_id == shift.id,
                ))
                mapped_user = resolved_actor.get(raw_user) if raw_user else None
                reason = None
                if raw_user and raw_user not in resolved_actor:
                    reason = "legacy_account_unmapped"
                elif raw_user and mapped_user is None:
                    reason = "target_account_missing_or_inactive"
                if not stamp:
                    issues.append((row_hash, "confirmation_time_missing"))
                if reason:
                    issues.append((row_hash, reason))
                if not target_entry:
                    issues.append((row_hash, "daily_entry_not_found"))
                prepared.append((row_hash, ward, shift_id, service_date, raw_user, mapped_user, stamp, target_entry))
            except (ValueError, TypeError):
                table_counts["rows_invalid"] += 1
                issues.append((row_hash, "invalid_ward_date_or_shift"))
                continue

        batch = None
        if apply:
            async with db.begin_nested() if db.in_transaction() else _transaction(db):
                batch = MigrationBatch(source_system=SOURCE_SYSTEM, source_checksum=checksum, state="running",
                    rows_seen=len(rows), rows_imported=0, rows_rejected=0, rows_skipped=0, rows_failed=0,
                    table_results={"data_confirm": {"rows_seen": len(rows)}} , created_by=operator.id)
                db.add(batch)
                await db.flush()
                for row_hash, ward, shift_id, service_date, raw_user, mapped_user, stamp, target_entry in prepared:
                    prior = await db.scalar(select(LegacyConfirmationRecord).where(LegacyConfirmationRecord.source_row_hash == row_hash))
                    if prior:
                        table_counts["rows_skipped"] += 1
                        continue
                    db.add(LegacyConfirmationRecord(source_row_hash=row_hash, migration_batch_id=batch.id,
                        entry_id=target_entry.id if target_entry else None, ward_id=ward.id if ward else None,
                        service_date=service_date, legacy_shift_id=shift_id, legacy_account_ref=raw_user,
                        actor_id=mapped_user.id if mapped_user else None, confirmed_at=stamp))
                    table_counts["rows_imported"] += 1
                for row_hash, reason in issues:
                    found = await db.scalar(select(LegacyImportIssue.id).where(
                        LegacyImportIssue.source_table == "data_confirm",
                        LegacyImportIssue.source_row_hash == row_hash,
                        LegacyImportIssue.reason_code == reason,
                    ))
                    if not found:
                        db.add(LegacyImportIssue(migration_batch_id=batch.id, source_table="data_confirm", source_row_hash=row_hash, reason_code=reason))
                table_counts["rows_failed"] = table_counts["rows_invalid"]
                table_counts["rows_skipped"] += 0
                table_counts["rows_seen"] = len(rows)
                batch.rows_imported = table_counts["rows_imported"]
                batch.rows_skipped = table_counts["rows_skipped"]
                batch.rows_failed = table_counts["rows_failed"]
                batch.rows_rejected = table_counts["rows_failed"]
                batch.table_results = {"data_confirm": dict(table_counts)}
                batch.state = "completed_with_errors" if issues or table_counts["rows_failed"] else "completed"
            await db.commit()
        else:
            for _, _, _, _, raw_user, mapped_user, stamp, target_entry in prepared:
                table_counts["rows_would_import"] += 1
                if raw_user and mapped_user:
                    table_counts["account_mapped"] += 1
                elif raw_user:
                    table_counts["account_unmapped"] += 1
                if stamp is None:
                    table_counts["timestamp_missing"] += 1
                if target_entry is None:
                    table_counts["entry_missing"] += 1
            table_counts["rows_seen"] = len(rows)
            await db.rollback()

    return {"mode": "apply" if apply else "dry_run", "source_table": "data_confirm", "checksum_sha256": checksum,
            "source_date_range": {"min": min(source_dates).isoformat() if source_dates else None,
                                  "max": max(source_dates).isoformat() if source_dates else None},
            "migration_batch_id": str(batch.id) if batch else None, "counts": dict(table_counts),
            "exception_counts": dict(Counter(reason for _, reason in issues))}


class _transaction:
    def __init__(self, db): self.db = db
    async def __aenter__(self): await self.db.begin(); return self.db
    async def __aexit__(self, exc_type, exc, tb):
        if exc_type: await self.db.rollback()
        elif self.db.in_transaction(): await self.db.commit()


async def main():
    args = parse_args()
    try:
        result = await run(args.source, args.account_map, args.apply, args.actor_username)
    except RuntimeError as exc:
        print(json.dumps({"status": "aborted", "reason": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(json.dumps({"status": "aborted", "reason": "database_or_source_error_details_suppressed"}), file=sys.stderr)
        raise SystemExit(2) from None
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
