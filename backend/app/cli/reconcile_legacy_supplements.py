"""Read-only, aggregate reconciliation for legacy supplemental import batches (data_split_patient, pressure, readmit, tb_news)."""
import argparse
import asyncio
import json
import sys
from collections import Counter
from datetime import timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.cli.import_legacy import SOURCE_SYSTEM
from app.cli.import_legacy_supplements import (
    REQUIRED_HEADERS_BY_TABLE,
    SPLIT_FIELDS,
    SUPPORTED_TABLES,
    TARGET_TABLE_BY_SOURCE,
    composite_target_uuid,
    load_account_map,
    load_csv_with_headers,
    parse_news_row,
    parse_pressure_row,
    parse_readmit_row,
    parse_split_row,
    supplement_business_key_hash,
)
from app.cli.reconcile_legacy import ensure_local_dev_database
from app.db import get_session_factory
from app.models import (
    Announcement,
    DailyEntry,
    LegacyKeyMap,
    MigrationBatch,
    PressureDaily,
    ReadmissionMonthly,
    SpecialtyCount,
    User,
    Ward,
)
from app.schemas import SPECIALTY_CODES


def parse_args():
    parser = argparse.ArgumentParser(description="Read-only count and total comparison for one supplemental import batch.")
    parser.add_argument("--table", required=True, choices=SUPPORTED_TABLES, help="Supplemental source table name")
    parser.add_argument("--source", required=True, type=Path, help="Same normalized CSV copy used for import")
    parser.add_argument("--batch-id", required=True, type=UUID, help="migration_batch_id reported by importer")
    parser.add_argument("--account-map", type=Path, help="Same account-map CSV used for tb_news import (optional)")
    return parser.parse_args()


async def reconcile_table(
    table_name: str,
    source_path: Path,
    batch_id: UUID,
    account_map_path: Path | None = None,
) -> dict:
    if table_name not in SUPPORTED_TABLES:
        raise RuntimeError(f"unsupported supplemental table: {table_name}")
    ensure_local_dev_database()
    source_checksum, rows, _ = load_csv_with_headers(source_path, REQUIRED_HEADERS_BY_TABLE[table_name])
    actor_map = load_account_map(account_map_path) if table_name == "tb_news" else {}

    factory = get_session_factory()
    async with factory() as db:
        batch = await db.get(MigrationBatch, batch_id)
        if not batch or batch.source_system != SOURCE_SYSTEM or batch.state not in {"completed", "completed_with_errors"}:
            raise RuntimeError("completed import batch was not found")
        if batch.source_checksum != source_checksum:
            raise RuntimeError("source checksum differs from the selected import batch")

        target_table = TARGET_TABLE_BY_SOURCE[table_name]
        batch_maps = (
            await db.execute(
                select(LegacyKeyMap).where(
                    LegacyKeyMap.migration_batch_id == batch_id,
                    LegacyKeyMap.source_system == SOURCE_SYSTEM,
                    LegacyKeyMap.source_table == table_name,
                    LegacyKeyMap.target_table == target_table,
                )
            )
        ).scalars().all()
        maps_by_hash = {item.source_key_hash: item for item in batch_maps}

        resolved_actor: dict[str, User | None] = {}
        if actor_map:
            users = (await db.scalars(select(User).where(User.is_active.is_(True)))).all()
            users_by_name = {u.username_normalized: u for u in users}
            resolved_actor = {legacy: users_by_name.get(name) for legacy, name in actor_map.items()}

        used_hashes: set[str] = set()
        errors: Counter[str] = Counter()
        skips: Counter[str] = Counter()
        occurrences: Counter[str] = Counter()
        parsed_rows = []

        for row in rows:
            try:
                if table_name == "data_split_patient":
                    ward_code, service_date, counts = parse_split_row(row)
                    source_hash = supplement_business_key_hash(table_name, ward_code, service_date.isoformat(), 3)
                    occurrences[source_hash] += 1
                    parsed_rows.append((source_hash, ward_code, service_date, counts))
                elif table_name == "pressure":
                    ward_code, service_date, cases, risk_days = parse_pressure_row(row)
                    source_hash = supplement_business_key_hash(table_name, ward_code, service_date.isoformat())
                    occurrences[source_hash] += 1
                    parsed_rows.append((source_hash, ward_code, service_date, cases, risk_days))
                elif table_name == "readmit":
                    ward_code, reporting_month, source_idate, readmit_count, discharge_count, _ = parse_readmit_row(row)
                    source_hash = supplement_business_key_hash(table_name, ward_code, reporting_month.isoformat())
                    occurrences[source_hash] += 1
                    parsed_rows.append((source_hash, ward_code, reporting_month, source_idate, readmit_count, discharge_count))
                elif table_name == "tb_news":
                    legacy_id, title, detail, published, created_at, legacy_user, _ = parse_news_row(row)
                    source_hash = supplement_business_key_hash(table_name, legacy_id)
                    occurrences[source_hash] += 1
                    parsed_rows.append((source_hash, legacy_id, title, detail, published, created_at, legacy_user))
            except ValueError as exc:
                errors[str(exc)] += 1

        duplicate_hashes = {key for key, count in occurrences.items() if count > 1}
        if table_name == "data_split_patient":
            source_totals = {field: 0 for field in (*SPLIT_FIELDS, "normal_total", "special_total")}
            target_totals = {field: 0 for field in (*SPLIT_FIELDS, "normal_total", "special_total")}
        elif table_name == "pressure":
            source_totals = {"stage2_4_cases": 0, "at_risk_patient_days": 0, "zero_risk_rows": 0}
            target_totals = {"stage2_4_cases": 0, "at_risk_patient_days": 0, "zero_risk_rows": 0}
        elif table_name == "readmit":
            source_totals = {"readmit_count": 0, "discharge_count": 0, "provenance_idate_rows": 0}
            target_totals = {"readmit_count": 0, "discharge_count": 0, "provenance_idate_rows": 0}
        else:
            source_totals = {"published_rows": 0, "draft_rows": 0, "mapped_publisher_rows": 0, "unmapped_or_missing_publisher_rows": 0}
            target_totals = {"published_rows": 0, "draft_rows": 0, "mapped_publisher_rows": 0, "unmapped_or_missing_publisher_rows": 0}

        comparable_source_rows = 0
        matched_rows = 0
        mismatched_rows = 0
        mismatch_fields: Counter[str] = Counter()
        source_only = 0

        for parsed in parsed_rows:
            source_hash = parsed[0]
            if source_hash in duplicate_hashes:
                errors["duplicate_source_business_key"] += 1
                continue
            comparable_source_rows += 1
            crosswalk = maps_by_hash.get(source_hash)

            if table_name == "data_split_patient":
                _, ward_code, service_date, counts = parsed
                for code in SPECIALTY_CODES:
                    for cat in ("n", "s"):
                        field = f"{code}_{cat}"
                        source_totals[field] += counts[(code, cat)]
                source_totals["normal_total"] += sum(counts[(code, "n")] for code in SPECIALTY_CODES)
                source_totals["special_total"] += sum(counts[(code, "s")] for code in SPECIALTY_CODES)
                if not crosswalk:
                    source_only += 1
                    skips["source_key_not_in_batch_crosswalk"] += 1
                    continue
                used_hashes.add(source_hash)
                entry = await db.get(DailyEntry, crosswalk.target_id)
                if not entry:
                    errors["crosswalk_target_missing"] += 1
                    continue
                spec_rows = (
                    await db.scalars(select(SpecialtyCount).where(SpecialtyCount.entry_id == entry.id))
                ).all()
                target_map = {(item.specialty_code, item.category_code): item.count_value for item in spec_rows}
                matched_rows += 1
                row_mismatch = len(target_map) != len(counts)
                for code in SPECIALTY_CODES:
                    for cat in ("n", "s"):
                        field = f"{code}_{cat}"
                        t_val = int(target_map.get((code, cat), 0))
                        target_totals[field] += t_val
                        if (code, cat) not in target_map or t_val != counts[(code, cat)]:
                            mismatch_fields[field] += 1
                            row_mismatch = True
                target_totals["normal_total"] += sum(int(target_map.get((code, "n"), 0)) for code in SPECIALTY_CODES)
                target_totals["special_total"] += sum(int(target_map.get((code, "s"), 0)) for code in SPECIALTY_CODES)
                if row_mismatch:
                    mismatched_rows += 1

            elif table_name == "pressure":
                _, ward_code, service_date, cases, risk_days = parsed
                source_totals["stage2_4_cases"] += cases
                source_totals["at_risk_patient_days"] += risk_days
                if risk_days == 0:
                    source_totals["zero_risk_rows"] += 1
                if not crosswalk:
                    source_only += 1
                    skips["source_key_not_in_batch_crosswalk"] += 1
                    continue
                used_hashes.add(source_hash)
                ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                if not ward:
                    errors["source_mapping_missing_during_reconciliation"] += 1
                    continue
                target = await db.get(PressureDaily, (ward.id, service_date))
                if not target or crosswalk.target_id != composite_target_uuid("pressure_daily", ward.id, service_date):
                    errors["crosswalk_target_missing"] += 1
                    continue
                matched_rows += 1
                target_totals["stage2_4_cases"] += int(target.stage2_4_cases)
                target_totals["at_risk_patient_days"] += int(target.at_risk_patient_days)
                if target.at_risk_patient_days == 0:
                    target_totals["zero_risk_rows"] += 1
                row_mismatch = False
                if int(target.stage2_4_cases) != cases:
                    mismatch_fields["stage2_4_cases"] += 1
                    row_mismatch = True
                if int(target.at_risk_patient_days) != risk_days:
                    mismatch_fields["at_risk_patient_days"] += 1
                    row_mismatch = True
                if row_mismatch:
                    mismatched_rows += 1

            elif table_name == "readmit":
                _, ward_code, reporting_month, source_idate, readmit_count, discharge_count = parsed
                source_totals["readmit_count"] += readmit_count
                source_totals["discharge_count"] += discharge_count
                if source_idate is not None:
                    source_totals["provenance_idate_rows"] += 1
                if not crosswalk:
                    source_only += 1
                    skips["source_key_not_in_batch_crosswalk"] += 1
                    continue
                used_hashes.add(source_hash)
                ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                if not ward:
                    errors["source_mapping_missing_during_reconciliation"] += 1
                    continue
                target = await db.get(ReadmissionMonthly, (ward.id, reporting_month))
                if not target or crosswalk.target_id != composite_target_uuid("readmission_monthly", ward.id, reporting_month):
                    errors["crosswalk_target_missing"] += 1
                    continue
                matched_rows += 1
                target_totals["readmit_count"] += int(target.readmit_count)
                target_totals["discharge_count"] += int(target.discharge_count)
                row_mismatch = False
                if int(target.readmit_count) != readmit_count:
                    mismatch_fields["readmit_count"] += 1
                    row_mismatch = True
                if int(target.discharge_count) != discharge_count:
                    mismatch_fields["discharge_count"] += 1
                    row_mismatch = True
                if source_idate is not None:
                    target_date = target.updated_at.astimezone(timezone.utc).date() if target.updated_at else None
                    if target_date == source_idate:
                        target_totals["provenance_idate_rows"] += 1
                    else:
                        mismatch_fields["idate_provenance"] += 1
                        row_mismatch = True
                if row_mismatch:
                    mismatched_rows += 1

            elif table_name == "tb_news":
                _, legacy_id, title, detail, published, created_at, legacy_user = parsed
                mapped_user = resolved_actor.get(legacy_user) if legacy_user else None
                expected_publisher = mapped_user.username if mapped_user else None
                source_totals["published_rows" if published else "draft_rows"] += 1
                if expected_publisher:
                    source_totals["mapped_publisher_rows"] += 1
                else:
                    source_totals["unmapped_or_missing_publisher_rows"] += 1
                if not crosswalk:
                    source_only += 1
                    skips["source_key_not_in_batch_crosswalk"] += 1
                    continue
                used_hashes.add(source_hash)
                target = await db.get(Announcement, crosswalk.target_id)
                if not target:
                    errors["crosswalk_target_missing"] += 1
                    continue
                matched_rows += 1
                target_totals["published_rows" if target.published else "draft_rows"] += 1
                if target.publisher_username:
                    target_totals["mapped_publisher_rows"] += 1
                else:
                    target_totals["unmapped_or_missing_publisher_rows"] += 1
                row_mismatch = False
                if target.title != title:
                    mismatch_fields["title"] += 1
                    row_mismatch = True
                if target.body != detail:
                    mismatch_fields["body"] += 1
                    row_mismatch = True
                if bool(target.published) != published:
                    mismatch_fields["published"] += 1
                    row_mismatch = True
                if actor_map and target.publisher_username != expected_publisher:
                    mismatch_fields["publisher_username"] += 1
                    row_mismatch = True
                if row_mismatch:
                    mismatched_rows += 1

        target_only_or_stale = len(set(maps_by_hash) - used_hashes)
        summary = {
            "mode": "read_only_reconciliation",
            "source_table": table_name,
            "target_table": target_table,
            "migration_batch_id": str(batch_id),
            "source_checksum_sha256": source_checksum,
            "source_rows_seen": len(rows),
            "source_rows_comparable": comparable_source_rows,
            "target_rows_matched_by_crosswalk": matched_rows,
            "source_rows_without_batch_target": source_only,
            "batch_targets_without_current_source_row": target_only_or_stale,
            "rows_with_field_mismatch": mismatched_rows,
            "mismatch_field_counts": dict(mismatch_fields),
            "source_field_totals": source_totals,
            "target_field_totals_for_matched_rows": target_totals,
            "validation_error_counts": dict(errors),
            "skip_counts": dict(skips),
            "personal_data_in_report": False,
            "match_status": "match"
            if not (source_only or target_only_or_stale or mismatched_rows or errors)
            else "mismatch_or_unresolved",
        }
        await db.rollback()
        return summary


async def main():
    args = parse_args()
    try:
        summary = await reconcile_table(args.table, args.source, args.batch_id, args.account_map)
    except RuntimeError as exc:
        print(json.dumps({"status": "aborted", "reason": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(json.dumps({"status": "aborted", "reason": "database_or_internal_error_details_suppressed"}), file=sys.stderr)
        raise SystemExit(2) from None
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    if summary["match_status"] != "match":
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
