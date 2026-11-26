"""Read-only, aggregate reconciliation for one legacy data_all import batch."""
import argparse
import asyncio
import hashlib
import ipaddress
import json
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from sqlalchemy import select

from app.config import get_settings
from app.db import get_session_factory
from app.models import DailyEntry, LegacyKeyMap, MigrationBatch, ShiftType, Ward
from app.schemas import COUNTER_FIELDS
from app.cli.import_legacy import (
    SOURCE_SYSTEM,
    SOURCE_TABLE,
    business_key_hash,
    load_source,
    parse_source_row,
)


def parse_args():
    parser = argparse.ArgumentParser(description="Read-only count and total comparison for one import batch.")
    parser.add_argument("--source", required=True, type=Path, help="Same normalized CSV copy used for import")
    parser.add_argument("--batch-id", required=True, type=UUID, help="migration_batch_id reported by importer")
    return parser.parse_args()


def ensure_local_dev_database():
    settings = get_settings()
    if settings.app_env.lower() not in {"development", "test"}:
        raise RuntimeError("reconciliation is allowed only when APP_ENV is development or test")
    parsed = urlsplit(settings.async_database_url())
    hostname = parsed.hostname or ""
    try:
        loopback = hostname.lower() == "localhost" or ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        loopback = False
    if not loopback:
        raise RuntimeError("reconciliation refuses non-loopback database hosts")


async def reconcile(source_path: Path, batch_id: UUID):
    ensure_local_dev_database()
    source_checksum, rows = load_source(source_path)
    factory = get_session_factory()
    async with factory() as db:
        batch = await db.get(MigrationBatch, batch_id)
        if not batch or batch.source_system != SOURCE_SYSTEM or batch.state not in {"completed", "completed_with_errors"}:
            raise RuntimeError("completed import batch was not found")
        if batch.source_checksum != source_checksum:
            raise RuntimeError("source checksum differs from the selected import batch")

        batch_maps = (
            await db.execute(
                select(LegacyKeyMap).where(
                    LegacyKeyMap.migration_batch_id == batch_id,
                    LegacyKeyMap.source_system == SOURCE_SYSTEM,
                    LegacyKeyMap.source_table == SOURCE_TABLE,
                    LegacyKeyMap.target_table == "daily_entries",
                )
            )
        ).scalars().all()
        maps_by_hash = {item.source_key_hash: item for item in batch_maps}
        used_hashes = set()
        errors = Counter()
        skips = Counter()
        occurrences = Counter()
        parsed_rows = []

        for row in rows:
            try:
                ward_code, service_date, legacy_shift_id, values = parse_source_row(row)
                source_hash = business_key_hash(ward_code, service_date, legacy_shift_id)
                occurrences[source_hash] += 1
                source_status = "confirmed" if (row.get("i_status") or "").strip() == "1" else "unconfirmed"
                parsed_rows.append((source_hash, ward_code, service_date, legacy_shift_id, values, source_status))
            except ValueError as exc:
                errors[str(exc)] += 1

        duplicate_hashes = {key for key, count in occurrences.items() if count > 1}
        source_totals = {field: 0 for field in (*COUNTER_FIELDS, "amount_bed")}
        target_totals = {field: 0 for field in (*COUNTER_FIELDS, "amount_bed")}
        comparable_source_rows = 0
        matched_rows = 0
        mismatched_rows = 0
        mismatch_fields = Counter()
        source_only = 0
        target_only_or_stale = 0

        for source_hash, ward_code, service_date, legacy_shift_id, values, source_status in parsed_rows:
            if source_hash in duplicate_hashes:
                errors["duplicate_source_business_key"] += 1
                continue
            comparable_source_rows += 1
            for field in COUNTER_FIELDS:
                source_totals[field] += int(values[field])
            if values["amount_bed"] is not None:
                source_totals["amount_bed"] += int(values["amount_bed"])

            crosswalk = maps_by_hash.get(source_hash)
            if not crosswalk:
                source_only += 1
                skips["source_key_not_in_batch_crosswalk"] += 1
                continue
            used_hashes.add(source_hash)
            ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
            shift = await db.scalar(select(ShiftType).where(ShiftType.legacy_shift_id == legacy_shift_id))
            if not ward or not shift:
                errors["source_mapping_missing_during_reconciliation"] += 1
                continue
            target = await db.get(DailyEntry, crosswalk.target_id)
            if not target:
                errors["crosswalk_target_missing"] += 1
                continue

            matched_rows += 1
            row_mismatch = target.status != source_status
            if row_mismatch:
                mismatch_fields["status"] += 1
            for field in COUNTER_FIELDS:
                source_value = int(values[field])
                target_value = int(getattr(target, field))
                target_totals[field] += target_value
                if source_value != target_value:
                    mismatch_fields[field] += 1
                    row_mismatch = True
            source_beds = values["amount_bed"]
            target_beds = target.amount_bed
            if source_beds is not None:
                target_totals["amount_bed"] += int(target_beds or 0)
                if int(source_beds) != int(target_beds or 0):
                    mismatch_fields["amount_bed"] += 1
                    row_mismatch = True
            elif target_beds is not None:
                target_totals["amount_bed"] += int(target_beds)
                mismatch_fields["amount_bed"] += 1
                row_mismatch = True
            if row_mismatch:
                mismatched_rows += 1

        target_only_or_stale = len(set(maps_by_hash) - used_hashes)
        summary = {
            "mode": "read_only_reconciliation",
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
            "occupancy": {
                "status": "not_comparable",
                "reason": "batch_reconciliation_compares_source_fields_only",
            },
            "personal_data_in_report": False,
            "match_status": "match" if not (source_only or target_only_or_stale or mismatched_rows or errors) else "mismatch_or_unresolved",
        }
        await db.rollback()
        return summary


async def main():
    args = parse_args()
    try:
        summary = await reconcile(args.source, args.batch_id)
    except RuntimeError as exc:
        print(json.dumps({"status": "aborted", "reason": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        # Suppress database-driver details, which can include credentials or host information.
        print(json.dumps({"status": "aborted", "reason": "database_or_internal_error_details_suppressed"}), file=sys.stderr)
        raise SystemExit(2) from None
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    if summary["match_status"] != "match":
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
