"""Safely import legacy `account` CSV exports without importing passwords."""
import argparse
import asyncio
import csv
import hashlib
import json
import secrets
import string
import sys
import uuid
from collections import Counter
from pathlib import Path

from sqlalchemy import select

from app.cli.import_legacy import SOURCE_SYSTEM, _transaction, check_local_development_target, find_actor
from app.db import get_session_factory
from app.models import (
    LegacyImportIssue,
    LegacyKeyMap,
    MigrationBatch,
    User,
    UserGlobalRole,
    UserWardRole,
    Ward,
)
from app.security import hash_password, normalize_username, validate_password_policy


SOURCE_TABLE = "account"
TARGET_TABLE = "users"
REQUIRED_HEADERS = {"id", "user_login", "user_name", "ward"}
FORBIDDEN_CREDENTIAL_HEADERS = {"pass_login", "password", "password_hash"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Dry-run or import legacy account CSV exports (without credential columns)."
    )
    parser.add_argument("--source", required=True, type=Path, help="Path to normalized account.csv (id,user_login,user_name,ward)")
    parser.add_argument("--apply", action="store_true", help="Write valid accounts and roles to the development database")
    parser.add_argument("--actor-username", help="Existing active system-admin username; required with --apply")
    parser.add_argument(
        "--write-account-map",
        type=Path,
        help="Optional output CSV path for legacy_account_id,target_username mappings",
    )
    return parser.parse_args()


def load_account_source(path: Path) -> tuple[str, list[dict[str, str]]]:
    if not path.is_file():
        raise RuntimeError("source CSV file was not found")
    raw_bytes = path.read_bytes()
    checksum = hashlib.sha256(raw_bytes).hexdigest()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = list(reader.fieldnames or [])
        lowered = {h.strip().lower() for h in headers}
        if FORBIDDEN_CREDENTIAL_HEADERS & lowered:
            raise RuntimeError("source_csv_must_not_contain_credentials")
        missing = sorted(REQUIRED_HEADERS - set(headers))
        if missing:
            raise RuntimeError("source CSV is missing required columns: " + ", ".join(missing))
        rows = list(reader)
    return checksum, rows


def parse_account_row(row: dict[str, str]) -> dict[str, str | bool | None]:
    legacy_id = (row.get("id") or "").strip()
    username = (row.get("user_login") or "").strip()
    if len(username) < 3 or len(username) > 80:
        raise ValueError("invalid_username")
    username_normalized = normalize_username(username)
    full_name = (row.get("user_name") or "").strip() or None
    ward_code = (row.get("ward") or "").strip()
    is_admin = ward_code == "00"
    return {
        "legacy_id": legacy_id,
        "username": username,
        "username_normalized": username_normalized,
        "full_name": full_name,
        "ward_code": ward_code,
        "is_admin": is_admin,
        "role_code": "system_admin" if is_admin else "ward_recorder",
    }


def account_key_hash(username_normalized: str) -> str:
    key = f"{SOURCE_SYSTEM}|{SOURCE_TABLE}|{username_normalized}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def safe_account_row_hash(row: dict[str, str], ordinal: int) -> str:
    canonical = json.dumps(
        {k: (row.get(k) or "").strip() for k in sorted(row) if k.strip().lower() not in FORBIDDEN_CREDENTIAL_HEADERS},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(f"{SOURCE_SYSTEM}|{SOURCE_TABLE}|row|{canonical}|{ordinal}".encode("utf-8")).hexdigest()


def generate_placeholder_password() -> str:
    specials = "!@#$%^&*"
    alphabet = string.ascii_letters + string.digits + specials
    chars = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(specials),
        *[secrets.choice(alphabet) for _ in range(20)],
    ]
    secrets.SystemRandom().shuffle(chars)
    return validate_password_policy("".join(chars))


def add_account_map_entries(
    account_map: dict[str, str],
    legacy_id: str,
    user_login: str,
    target_username: str,
) -> None:
    if user_login:
        account_map.setdefault(user_login, target_username)
    if legacy_id:
        account_map.setdefault(legacy_id, target_username)


def write_account_map(path: Path, account_map: dict[str, str]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["legacy_account_id", "target_username"])
        for legacy_account_id, target_username in account_map.items():
            writer.writerow([legacy_account_id, target_username])
    return len(account_map)


async def _record_issues(db, batch_id: uuid.UUID, issues: list[tuple[str, str]]) -> None:
    seen_in_batch: set[tuple[str, str]] = set()
    for row_hash, reason in issues:
        if (row_hash, reason) in seen_in_batch:
            continue
        seen_in_batch.add((row_hash, reason))
        found = await db.scalar(
            select(LegacyImportIssue.id).where(
                LegacyImportIssue.source_table == SOURCE_TABLE,
                LegacyImportIssue.source_row_hash == row_hash,
                LegacyImportIssue.reason_code == reason,
            )
        )
        if not found:
            db.add(
                LegacyImportIssue(
                    migration_batch_id=batch_id,
                    source_table=SOURCE_TABLE,
                    source_row_hash=row_hash,
                    reason_code=reason,
                )
            )


async def perform(
    source_path: Path,
    apply_changes: bool = False,
    actor_username: str | None = None,
    write_account_map_path: Path | None = None,
) -> dict:
    check_local_development_target()
    checksum, rows = load_account_source(source_path)

    factory = get_session_factory()
    account_map: dict[str, str] = {}

    async with factory() as db:
        actor = await find_actor(db, actor_username)
        if apply_changes and not actor:
            raise RuntimeError("--apply requires an active system admin selected by --actor-username")

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
                "target_table": TARGET_TABLE,
                "source_checksum_sha256": checksum,
                "rows_seen": len(rows),
                "rows_would_import": 0,
                "rows_imported": 0,
                "rows_skipped": 0,
                "rows_failed": 0,
                "skip_reasons": Counter(),
                "error_reasons": Counter(),
                "account_map_entries": 0,
                "mapping": {
                    "username": "account.user_login -> users.username",
                    "full_name": "account.user_name -> users.full_name",
                    "admin_role": "account.ward == '00' -> user_global_roles(system_admin)",
                    "ward_role": "account.ward != '00' -> wards.legacy_code -> user_ward_roles(ward_recorder)",
                    "password": "random placeholder hashed only; never imported from legacy pass_login",
                },
            }

            issues: list[tuple[str, str]] = []
            ordinal_counts: Counter[str] = Counter()
            seen_usernames: dict[str, str] = {}

            for row in rows:
                canonical = json.dumps(
                    {k: (row.get(k) or "").strip() for k in sorted(row) if k.strip().lower() not in FORBIDDEN_CREDENTIAL_HEADERS},
                    ensure_ascii=False,
                    sort_keys=True,
                )
                ordinal_counts[canonical] += 1
                row_hash = safe_account_row_hash(row, ordinal_counts[canonical])

                try:
                    parsed = parse_account_row(row)
                except ValueError as exc:
                    reason = str(exc)
                    result["rows_failed"] += 1
                    result["error_reasons"][reason] += 1
                    issues.append((row_hash, reason))
                    continue

                legacy_id = str(parsed["legacy_id"] or "")
                username = str(parsed["username"])
                username_normalized = str(parsed["username_normalized"])
                full_name = parsed["full_name"]
                ward_code = str(parsed["ward_code"] or "")
                is_admin = bool(parsed["is_admin"])
                source_key_hash = account_key_hash(username_normalized)

                if username_normalized in seen_usernames:
                    result["rows_skipped"] += 1
                    result["skip_reasons"]["duplicate_username_in_source"] += 1
                    add_account_map_entries(account_map, legacy_id, username, seen_usernames[username_normalized])
                    continue

                prior_map = await db.scalar(
                    select(LegacyKeyMap).where(
                        LegacyKeyMap.source_system == SOURCE_SYSTEM,
                        LegacyKeyMap.source_table == SOURCE_TABLE,
                        LegacyKeyMap.source_key_hash == source_key_hash,
                    )
                )
                existing_user = await db.scalar(
                    select(User).where(User.username_normalized == username_normalized)
                )
                if existing_user or prior_map:
                    result["rows_skipped"] += 1
                    result["skip_reasons"]["already_imported_or_existing_user"] += 1
                    target_name = existing_user.username if existing_user else username
                    seen_usernames[username_normalized] = target_name
                    add_account_map_entries(account_map, legacy_id, username, target_name)
                    continue

                ward = None
                if not is_admin:
                    ward = await db.scalar(select(Ward).where(Ward.legacy_code == ward_code))
                    if not ward:
                        result["rows_failed"] += 1
                        result["error_reasons"]["ward_mapping_missing"] += 1
                        issues.append((row_hash, "ward_mapping_missing"))
                        continue

                if not apply_changes:
                    result["rows_would_import"] += 1
                    seen_usernames[username_normalized] = username
                    add_account_map_entries(account_map, legacy_id, username, username)
                    continue

                try:
                    async with db.begin_nested():
                        user = User(
                            username=username,
                            username_normalized=username_normalized,
                            full_name=full_name,
                            password_hash=hash_password(generate_placeholder_password()),
                            is_active=True,
                        )
                        db.add(user)
                        await db.flush()

                        if is_admin:
                            db.add(UserGlobalRole(user_id=user.id, role_code="system_admin"))
                        else:
                            db.add(UserWardRole(user_id=user.id, ward_id=ward.id, role_code="ward_recorder"))

                        db.add(
                            LegacyKeyMap(
                                source_system=SOURCE_SYSTEM,
                                source_table=SOURCE_TABLE,
                                source_key_hash=source_key_hash,
                                target_table=TARGET_TABLE,
                                target_id=user.id,
                                migration_batch_id=batch.id,
                            )
                        )
                except Exception:
                    result["rows_failed"] += 1
                    result["error_reasons"]["account_insert_failed"] += 1
                    issues.append((row_hash, "account_insert_failed"))
                    continue

                result["rows_imported"] += 1
                seen_usernames[username_normalized] = username
                add_account_map_entries(account_map, legacy_id, username, username)

            if batch:
                await _record_issues(db, batch.id, issues)
                batch.rows_imported = result["rows_imported"]
                batch.rows_rejected = result["rows_failed"]
                batch.rows_skipped = result["rows_skipped"]
                batch.rows_failed = result["rows_failed"]
                batch.state = "completed_with_errors" if result["rows_failed"] else "completed"
                await db.flush()

        if apply_changes:
            await db.commit()
        else:
            await db.rollback()

    if write_account_map_path:
        result["account_map_entries"] = write_account_map(write_account_map_path, account_map)
    else:
        result["account_map_entries"] = len(account_map)

    result["skip_reasons"] = dict(result["skip_reasons"])
    result["error_reasons"] = dict(result["error_reasons"])
    return result


async def main():
    args = parse_args()
    try:
        result = await perform(args.source, args.apply, args.actor_username, args.write_account_map)
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
