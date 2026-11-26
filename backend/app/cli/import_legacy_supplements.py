"""Safely import normalized legacy supplemental CSV exports (data_split_patient, pressure, readmit, tb_news)."""
import argparse
import asyncio
import csv
import hashlib
import json
import re
import sys
import uuid
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.cli.import_legacy import SOURCE_SYSTEM, check_local_development_target, find_actor
from app.db import get_session_factory
from app.models import (
    Announcement,
    DailyEntry,
    LegacyImportIssue,
    LegacyKeyMap,
    MigrationBatch,
    PressureDaily,
    ReadmissionMonthly,
    ShiftType,
    SpecialtyCount,
    User,
    Ward,
)
from app.schemas import SPECIALTY_CODES

BANGKOK_TZ = timezone(timedelta(hours=7))

SPLIT_FIELDS: tuple[str, ...] = tuple(
    f"{code}_{category}" for category in ("n", "s") for code in SPECIALTY_CODES
)

SUPPORTED_TABLES = ("data_split_patient", "pressure", "readmit", "tb_news")

REQUIRED_HEADERS_BY_TABLE: dict[str, set[str]] = {
    "data_split_patient": {"ward", "idate", *SPLIT_FIELDS},
    "pressure": {"ward", "idate", "do_pressure", "risk_pressure"},
    "readmit": {"ward", "month1", "idate", "readmit_amount", "discharge_amount"},
    "tb_news": {"id", "title_news", "detail_news", "status_news", "date_news", "time_news", "user_update"},
}

TARGET_TABLE_BY_SOURCE: dict[str, str] = {
    "data_split_patient": "specialty_counts",
    "pressure": "pressure_daily",
    "readmit": "readmission_monthly",
    "tb_news": "announcements",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Dry-run or import a normalized legacy supplemental CSV (data_split_patient, pressure, readmit, tb_news)."
    )
    parser.add_argument(
        "--table",
        required=True,
        choices=SUPPORTED_TABLES,
        help="Legacy supplemental source table name",
    )
    parser.add_argument(
        "--source",
        required=True,
        type=Path,
        help="Path to a read-only normalized CSV copy for the selected table",
    )
    parser.add_argument(
        "--account-map",
        type=Path,
        help="Optional CSV mapping legacy_account_id,target_username (used by tb_news)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write valid rows and import issues to the development/test database",
    )
    parser.add_argument(
        "--actor-username",
        help="Existing active system-admin username; required with --apply (never forged as news publisher)",
    )
    return parser.parse_args()


def load_csv_with_headers(path: Path, required_headers: set[str]) -> tuple[str, list[dict[str, str]], set[str]]:
    if not path.is_file():
        raise RuntimeError("source CSV file was not found")
    raw_bytes = path.read_bytes()
    checksum = hashlib.sha256(raw_bytes).hexdigest()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = sorted(required_headers - headers)
        if missing:
            raise RuntimeError("source CSV is missing required columns: " + ", ".join(missing))
        rows = list(reader)
    return checksum, rows, headers


def load_account_map(map_path: Path | None) -> dict[str, str]:
    if not map_path:
        return {}
    _, mappings, headers = load_csv_with_headers(map_path, {"legacy_account_id", "target_username"})
    forbidden = {"pass_login", "password", "password_hash"} & {h.strip().lower() for h in headers}
    if forbidden:
        raise RuntimeError("account_map_must_not_contain_credentials")
    actor_map: dict[str, str] = {}
    for item in mappings:
        legacy_id = (item.get("legacy_account_id") or "").strip()
        username = (item.get("target_username") or "").strip().casefold()
        if legacy_id and username:
            if legacy_id in actor_map:
                raise RuntimeError("account map contains duplicate legacy_account_id")
            actor_map[legacy_id] = username
    return actor_map


def safe_row_hash(source_table: str, row: dict[str, str], ordinal: int) -> str:
    canonical = json.dumps(
        {k: (row.get(k) or "").strip() for k in sorted(row)},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(f"{SOURCE_SYSTEM}|{source_table}|row|{canonical}|{ordinal}".encode("utf-8")).hexdigest()


def supplement_business_key_hash(source_table: str, *parts: object) -> str:
    joined = "|".join(str(part) for part in parts)
    key = f"{SOURCE_SYSTEM}|{source_table}|{joined}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def composite_target_uuid(target_table: str, ward_id: uuid.UUID, key_date: date) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_OID, f"{target_table}|{ward_id}|{key_date.isoformat()}")


def _is_null_token(raw: str) -> bool:
    return raw == "" or raw in {r"\N", "NULL", "null"}


def _parse_iso_date(raw_date: str, missing_code: str = "date_not_iso_gregorian") -> date:
    if _is_null_token(raw_date) or raw_date == "0000-00-00":
        raise ValueError(missing_code)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
        raise ValueError("date_not_iso_gregorian")
    try:
        return date.fromisoformat(raw_date)
    except ValueError:
        raise ValueError("invalid_calendar_date") from None


def _parse_nonnegative_int(raw_val: str, blank_code: str, invalid_code: str) -> int:
    if _is_null_token(raw_val):
        raise ValueError(blank_code)
    if not raw_val.isdecimal() or int(raw_val) > 2147483647:
        raise ValueError(invalid_code)
    return int(raw_val)


def parse_split_row(row: dict[str, str]) -> tuple[str, date, dict[tuple[str, str], int]]:
    ward_code = (row.get("ward") or "").strip()
    raw_date = (row.get("idate") or "").strip()
    if _is_null_token(ward_code):
        raise ValueError("missing_ward_code")
    service_date = _parse_iso_date(raw_date)
    counts: dict[tuple[str, str], int] = {}
    for code in SPECIALTY_CODES:
        for category in ("n", "s"):
            field = f"{code}_{category}"
            raw_val = (row.get(field) or "").strip()
            counts[(code, category)] = _parse_nonnegative_int(
                raw_val,
                "blank_specialty_count_field",
                "invalid_specialty_count_field",
            )
    return ward_code, service_date, counts


def parse_pressure_row(row: dict[str, str]) -> tuple[str, date, int, int]:
    ward_code = (row.get("ward") or "").strip()
    raw_date = (row.get("idate") or "").strip()
    if _is_null_token(ward_code):
        raise ValueError("missing_ward_code")
    service_date = _parse_iso_date(raw_date)
    cases = _parse_nonnegative_int(
        (row.get("do_pressure") or "").strip(),
        "blank_pressure_field",
        "invalid_pressure_field",
    )
    risk_days = _parse_nonnegative_int(
        (row.get("risk_pressure") or "").strip(),
        "blank_pressure_field",
        "invalid_pressure_field",
    )
    return ward_code, service_date, cases, risk_days


def parse_readmit_row(row: dict[str, str]) -> tuple[str, date, date | None, int, int, list[str]]:
    ward_code = (row.get("ward") or "").strip()
    raw_month = (row.get("month1") or "").strip()
    raw_idate = (row.get("idate") or "").strip()
    if _is_null_token(ward_code):
        raise ValueError("missing_ward_code")
    if not re.fullmatch(r"\d{4}-\d{2}", raw_month):
        raise ValueError("invalid_reporting_month")
    try:
        reporting_month = date.fromisoformat(f"{raw_month}-01")
    except ValueError:
        raise ValueError("invalid_reporting_month") from None

    warnings: list[str] = []
    if _is_null_token(raw_idate) or raw_idate == "0000-00-00":
        source_idate = None
        warnings.append("readmit_idate_missing")
    else:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_idate):
            raise ValueError("invalid_readmit_idate")
        try:
            source_idate = date.fromisoformat(raw_idate)
        except ValueError:
            raise ValueError("invalid_readmit_idate") from None

    readmit_count = _parse_nonnegative_int(
        (row.get("readmit_amount") or "").strip(),
        "blank_readmit_field",
        "invalid_readmit_field",
    )
    discharge_count = _parse_nonnegative_int(
        (row.get("discharge_amount") or "").strip(),
        "blank_readmit_field",
        "invalid_readmit_field",
    )
    return ward_code, reporting_month, source_idate, readmit_count, discharge_count, warnings


def parse_news_row(row: dict[str, str]) -> tuple[int, str, str, bool, datetime, str | None, list[str]]:
    raw_id = (row.get("id") or "").strip()
    if _is_null_token(raw_id) or not raw_id.isdecimal() or int(raw_id) <= 0:
        raise ValueError("invalid_news_id")
    legacy_id = int(raw_id)

    title = (row.get("title_news") or "").strip()
    if _is_null_token(title):
        raise ValueError("blank_news_title")
    if len(title) > 240:
        raise ValueError("news_title_too_long")

    detail = (row.get("detail_news") or "").strip()
    if _is_null_token(detail):
        raise ValueError("blank_news_detail")

    raw_status = (row.get("status_news") or "").strip()
    if raw_status not in {"0", "1"}:
        raise ValueError("invalid_news_status")
    published = raw_status == "1"

    raw_date = (row.get("date_news") or "").strip()
    news_date = _parse_iso_date(raw_date, missing_code="news_date_missing")

    warnings: list[str] = []
    raw_time = (row.get("time_news") or "").strip()
    if _is_null_token(raw_time):
        news_time = time(0, 0, 0)
        warnings.append("news_time_missing")
    else:
        if not re.fullmatch(r"\d{2}:\d{2}(:\d{2})?", raw_time):
            raise ValueError("invalid_news_time")
        try:
            news_time = time.fromisoformat(raw_time)
        except ValueError:
            raise ValueError("invalid_news_time") from None

    created_at = datetime.combine(news_date, news_time, tzinfo=BANGKOK_TZ)
    raw_user = (row.get("user_update") or "").strip()
    legacy_user = None if _is_null_token(raw_user) else raw_user
    if legacy_user is None:
        warnings.append("news_publisher_missing")
    return legacy_id, title, detail, published, created_at, legacy_user, warnings


async def _record_issues(db, batch_id: uuid.UUID, source_table: str, issues: list[tuple[str, str]]) -> None:
    seen_in_batch: set[tuple[str, str]] = set()
    for row_hash, reason in issues:
        if (row_hash, reason) in seen_in_batch:
            continue
        seen_in_batch.add((row_hash, reason))
        found = await db.scalar(
            select(LegacyImportIssue.id).where(
                LegacyImportIssue.source_table == source_table,
                LegacyImportIssue.source_row_hash == row_hash,
                LegacyImportIssue.reason_code == reason,
            )
        )
        if not found:
            db.add(
                LegacyImportIssue(
                    migration_batch_id=batch_id,
                    source_table=source_table,
                    source_row_hash=row_hash,
                    reason_code=reason,
                )
            )


async def perform_table(
    table_name: str,
    source_path: Path,
    apply_changes: bool = False,
    actor_username: str | None = None,
    account_map_path: Path | None = None,
) -> dict:
    if table_name not in SUPPORTED_TABLES:
        raise RuntimeError(f"unsupported supplemental table: {table_name}")
    check_local_development_target()
    checksum, rows, _ = load_csv_with_headers(source_path, REQUIRED_HEADERS_BY_TABLE[table_name])
    actor_map = load_account_map(account_map_path) if table_name == "tb_news" else {}

    factory = get_session_factory()
    async with factory() as db:
        actor = await find_actor(db, actor_username)
        if apply_changes and not actor:
            raise RuntimeError("--apply requires an active system admin selected by --actor-username")

        resolved_actor: dict[str, User | None] = {}
        if actor_map:
            users = (await db.scalars(select(User).where(User.is_active.is_(True)))).all()
            users_by_name = {u.username_normalized: u for u in users}
            resolved_actor = {legacy: users_by_name.get(name) for legacy, name in actor_map.items()}

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
                "source_table": table_name,
                "target_table": TARGET_TABLE_BY_SOURCE[table_name],
                "source_checksum_sha256": checksum,
                "source_date_range": {"min": None, "max": None},
                "rows_seen": len(rows),
                "rows_would_import": 0,
                "rows_imported": 0,
                "rows_skipped": 0,
                "rows_failed": 0,
                "skip_reasons": Counter(),
                "error_reasons": Counter(),
                "issue_reasons": Counter(),
            }

            source_dates: list[date] = []
            issues: list[tuple[str, str]] = []
            ordinal_counts: Counter[str] = Counter()
            key_occurrences: Counter[str] = Counter()

            for candidate in rows:
                try:
                    if table_name == "data_split_patient":
                        w_code, s_date, _ = parse_split_row(candidate)
                        key_occurrences[supplement_business_key_hash(table_name, w_code, s_date.isoformat(), 3)] += 1
                    elif table_name == "pressure":
                        w_code, s_date, _, _ = parse_pressure_row(candidate)
                        key_occurrences[supplement_business_key_hash(table_name, w_code, s_date.isoformat())] += 1
                    elif table_name == "readmit":
                        w_code, rep_month, _, _, _, _ = parse_readmit_row(candidate)
                        key_occurrences[supplement_business_key_hash(table_name, w_code, rep_month.isoformat())] += 1
                    elif table_name == "tb_news":
                        n_id, _, _, _, _, _, _ = parse_news_row(candidate)
                        key_occurrences[supplement_business_key_hash(table_name, n_id)] += 1
                except ValueError:
                    continue

            afternoon_shift = None
            if table_name == "data_split_patient":
                afternoon_shift = await db.scalar(select(ShiftType).where(ShiftType.legacy_shift_id == 3))

            for row in rows:
                canonical_row = json.dumps(row, ensure_ascii=False, sort_keys=True)
                ordinal_counts[canonical_row] += 1
                row_hash = safe_row_hash(table_name, row, ordinal_counts[canonical_row])

                try:
                    if table_name == "data_split_patient":
                        ward_code, service_date, counts = parse_split_row(row)
                        source_dates.append(service_date)
                        source_key_hash = supplement_business_key_hash(table_name, ward_code, service_date.isoformat(), 3)
                    elif table_name == "pressure":
                        ward_code, service_date, cases, risk_days = parse_pressure_row(row)
                        source_dates.append(service_date)
                        source_key_hash = supplement_business_key_hash(table_name, ward_code, service_date.isoformat())
                    elif table_name == "readmit":
                        ward_code, reporting_month, source_idate, readmit_count, discharge_count, row_warnings = parse_readmit_row(row)
                        source_dates.append(reporting_month)
                        source_key_hash = supplement_business_key_hash(table_name, ward_code, reporting_month.isoformat())
                    else:
                        legacy_id, title, detail, published, created_at, legacy_user, row_warnings = parse_news_row(row)
                        source_dates.append(created_at.date())
                        source_key_hash = supplement_business_key_hash(table_name, legacy_id)
                except ValueError as exc:
                    reason = str(exc)
                    result["rows_failed"] += 1
                    result["error_reasons"][reason] += 1
                    result["issue_reasons"][reason] += 1
                    issues.append((row_hash, reason))
                    continue

                if key_occurrences[source_key_hash] > 1:
                    reason = "duplicate_source_business_key"
                    result["rows_failed"] += 1
                    result["error_reasons"][reason] += 1
                    result["issue_reasons"][reason] += 1
                    issues.append((row_hash, reason))
                    continue

                prior_map = await db.scalar(
                    select(LegacyKeyMap).where(
                        LegacyKeyMap.source_system == SOURCE_SYSTEM,
                        LegacyKeyMap.source_table == table_name,
                        LegacyKeyMap.source_key_hash == source_key_hash,
                    )
                )
                if prior_map:
                    result["rows_skipped"] += 1
                    result["skip_reasons"]["already_imported_source_key"] += 1
                    continue

                if table_name == "data_split_patient":
                    ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                    if not ward or not ward.is_active:
                        reason = "ward_mapping_missing_or_inactive"
                        result["rows_failed"] += 1
                        result["error_reasons"][reason] += 1
                        result["issue_reasons"][reason] += 1
                        issues.append((row_hash, reason))
                        continue
                    if not afternoon_shift or not afternoon_shift.is_active:
                        reason = "shift_mapping_missing_or_inactive"
                        result["rows_failed"] += 1
                        result["error_reasons"][reason] += 1
                        result["issue_reasons"][reason] += 1
                        issues.append((row_hash, reason))
                        continue
                    afternoon_entry = await db.scalar(
                        select(DailyEntry).where(
                            DailyEntry.ward_id == ward.id,
                            DailyEntry.service_date == service_date,
                            DailyEntry.shift_type_id == afternoon_shift.id,
                        )
                    )
                    if not afternoon_entry:
                        reason = "afternoon_daily_entry_not_found"
                        result["rows_failed"] += 1
                        result["error_reasons"][reason] += 1
                        result["issue_reasons"][reason] += 1
                        issues.append((row_hash, reason))
                        continue
                    existing_spec = await db.scalar(
                        select(SpecialtyCount.entry_id).where(SpecialtyCount.entry_id == afternoon_entry.id).limit(1)
                    )
                    if existing_spec is not None:
                        result["rows_skipped"] += 1
                        result["skip_reasons"]["target_business_key_exists_without_crosswalk"] += 1
                        continue
                    if not apply_changes:
                        result["rows_would_import"] += 1
                        continue
                    for (spec_code, cat_code), val in counts.items():
                        db.add(
                            SpecialtyCount(
                                entry_id=afternoon_entry.id,
                                specialty_code=spec_code,
                                category_code=cat_code,
                                count_value=val,
                            )
                        )
                    db.add(
                        LegacyKeyMap(
                            source_system=SOURCE_SYSTEM,
                            source_table=table_name,
                            source_key_hash=source_key_hash,
                            target_table="specialty_counts",
                            target_id=afternoon_entry.id,
                            migration_batch_id=batch.id,
                        )
                    )
                    result["rows_imported"] += 1

                elif table_name == "pressure":
                    ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                    if not ward or not ward.is_active:
                        reason = "ward_mapping_missing_or_inactive"
                        result["rows_failed"] += 1
                        result["error_reasons"][reason] += 1
                        result["issue_reasons"][reason] += 1
                        issues.append((row_hash, reason))
                        continue
                    existing_pressure = await db.get(PressureDaily, (ward.id, service_date))
                    if existing_pressure is not None:
                        result["rows_skipped"] += 1
                        result["skip_reasons"]["target_business_key_exists_without_crosswalk"] += 1
                        continue
                    if not apply_changes:
                        result["rows_would_import"] += 1
                        continue
                    db.add(
                        PressureDaily(
                            ward_id=ward.id,
                            service_date=service_date,
                            stage2_4_cases=cases,
                            at_risk_patient_days=risk_days,
                            updated_by=actor.id,
                        )
                    )
                    db.add(
                        LegacyKeyMap(
                            source_system=SOURCE_SYSTEM,
                            source_table=table_name,
                            source_key_hash=source_key_hash,
                            target_table="pressure_daily",
                            target_id=composite_target_uuid("pressure_daily", ward.id, service_date),
                            migration_batch_id=batch.id,
                        )
                    )
                    result["rows_imported"] += 1

                elif table_name == "readmit":
                    ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                    if not ward or not ward.is_active:
                        reason = "ward_mapping_missing_or_inactive"
                        result["rows_failed"] += 1
                        result["error_reasons"][reason] += 1
                        result["issue_reasons"][reason] += 1
                        issues.append((row_hash, reason))
                        continue
                    existing_readmit = await db.get(ReadmissionMonthly, (ward.id, reporting_month))
                    if existing_readmit is not None:
                        result["rows_skipped"] += 1
                        result["skip_reasons"]["target_business_key_exists_without_crosswalk"] += 1
                        continue
                    for warn in row_warnings:
                        result["issue_reasons"][warn] += 1
                        issues.append((row_hash, warn))
                    if not apply_changes:
                        result["rows_would_import"] += 1
                        continue
                    item_kwargs = {
                        "ward_id": ward.id,
                        "reporting_month": reporting_month,
                        "readmit_count": readmit_count,
                        "discharge_count": discharge_count,
                        "updated_by": actor.id,
                    }
                    if source_idate is not None:
                        item_kwargs["updated_at"] = datetime.combine(source_idate, time.min, tzinfo=timezone.utc)
                    db.add(ReadmissionMonthly(**item_kwargs))
                    db.add(
                        LegacyKeyMap(
                            source_system=SOURCE_SYSTEM,
                            source_table=table_name,
                            source_key_hash=source_key_hash,
                            target_table="readmission_monthly",
                            target_id=composite_target_uuid("readmission_monthly", ward.id, reporting_month),
                            migration_batch_id=batch.id,
                        )
                    )
                    result["rows_imported"] += 1

                elif table_name == "tb_news":
                    mapped_user = resolved_actor.get(legacy_user) if legacy_user else None
                    for warn in row_warnings:
                        result["issue_reasons"][warn] += 1
                        issues.append((row_hash, warn))
                    if legacy_user and legacy_user not in resolved_actor:
                        result["issue_reasons"]["legacy_account_unmapped"] += 1
                        issues.append((row_hash, "legacy_account_unmapped"))
                    elif legacy_user and mapped_user is None:
                        result["issue_reasons"]["target_account_missing_or_inactive"] += 1
                        issues.append((row_hash, "target_account_missing_or_inactive"))

                    if not apply_changes:
                        result["rows_would_import"] += 1
                        continue

                    news_item = Announcement(
                        title=title,
                        body=detail,
                        published=published,
                        version=1,
                        created_at=created_at,
                        updated_by=mapped_user.id if mapped_user else None,
                        publisher_username=mapped_user.username if mapped_user else None,
                    )
                    db.add(news_item)
                    await db.flush()
                    db.add(
                        LegacyKeyMap(
                            source_system=SOURCE_SYSTEM,
                            source_table=table_name,
                            source_key_hash=source_key_hash,
                            target_table="announcements",
                            target_id=news_item.id,
                            migration_batch_id=batch.id,
                        )
                    )
                    result["rows_imported"] += 1

            result["source_date_range"] = {
                "min": min(source_dates).isoformat() if source_dates else None,
                "max": max(source_dates).isoformat() if source_dates else None,
            }

            if batch:
                await _record_issues(db, batch.id, table_name, issues)
                batch.rows_imported = result["rows_imported"]
                batch.rows_rejected = result["rows_failed"]
                batch.rows_skipped = result["rows_skipped"]
                batch.rows_failed = result["rows_failed"]
                batch.table_results = {
                    table_name: {
                        "rows_seen": result["rows_seen"],
                        "rows_imported": result["rows_imported"],
                        "rows_skipped": result["rows_skipped"],
                        "rows_failed": result["rows_failed"],
                        "issue_reasons": dict(result["issue_reasons"]),
                    }
                }
                batch.state = "completed_with_errors" if (result["rows_failed"] or issues) else "completed"
                await db.flush()

        if apply_changes:
            await db.commit()
        else:
            await db.rollback()

    result["skip_reasons"] = dict(result["skip_reasons"])
    result["error_reasons"] = dict(result["error_reasons"])
    result["issue_reasons"] = dict(result["issue_reasons"])
    return result


async def import_data_split_patient(source_path: Path, apply_changes: bool = False, actor_username: str | None = None) -> dict:
    return await perform_table("data_split_patient", source_path, apply_changes=apply_changes, actor_username=actor_username)


async def import_pressure(source_path: Path, apply_changes: bool = False, actor_username: str | None = None) -> dict:
    return await perform_table("pressure", source_path, apply_changes=apply_changes, actor_username=actor_username)


async def import_readmit(source_path: Path, apply_changes: bool = False, actor_username: str | None = None) -> dict:
    return await perform_table("readmit", source_path, apply_changes=apply_changes, actor_username=actor_username)


async def import_tb_news(
    source_path: Path,
    account_map_path: Path | None = None,
    apply_changes: bool = False,
    actor_username: str | None = None,
) -> dict:
    return await perform_table(
        "tb_news",
        source_path,
        apply_changes=apply_changes,
        actor_username=actor_username,
        account_map_path=account_map_path,
    )


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
        result = await perform_table(
            args.table,
            args.source,
            apply_changes=args.apply,
            actor_username=args.actor_username,
            account_map_path=args.account_map,
        )
    except RuntimeError as exc:
        print(json.dumps({"status": "aborted", "reason": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(json.dumps({"status": "aborted", "reason": "database_or_internal_error_details_suppressed"}), file=sys.stderr)
        raise SystemExit(2) from None
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    if result["rows_failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
