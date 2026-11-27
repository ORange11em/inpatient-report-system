import csv
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
from types import SimpleNamespace as NS
import unittest
from uuid import uuid4

from app.cli.import_legacy import (
    BANGKOK_TZ,
    load_account_map,
    parse_last_date,
    resolve_entry_actor_id,
)
from app.cli.import_legacy_accounts import (
    add_account_map_entries,
    generate_placeholder_password,
    load_account_source,
    parse_account_row,
    write_account_map,
)
from app.security import hash_password, validate_password_policy, verify_password


class LegacyAccountImportTests(unittest.TestCase):
    def test_rejects_account_csv_containing_credential_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            for col in ("pass_login", "PASS_LOGIN", "password", "password_hash"):
                csv_path = Path(tmp) / f"bad_{col}.csv"
                csv_path.write_text(
                    f"id,user_login,user_name,ward,{col}\n1,nurse_a,พยาบาล สมมติ,10,dummy\n",
                    encoding="utf-8",
                )
                with self.assertRaisesRegex(RuntimeError, "^source_csv_must_not_contain_credentials$"):
                    load_account_source(csv_path)

    def test_parses_admin_ward_00_vs_regular_ward_and_validates_username(self):
        admin_row = parse_account_row(
            {"id": "1", "user_login": "Admin01", "user_name": " ผู้ดูแล สมมติ ", "ward": "00"}
        )
        self.assertEqual(admin_row["username"], "Admin01")
        self.assertEqual(admin_row["username_normalized"], "admin01")
        self.assertEqual(admin_row["full_name"], "ผู้ดูแล สมมติ")
        self.assertTrue(admin_row["is_admin"])
        self.assertEqual(admin_row["role_code"], "system_admin")

        ward_row = parse_account_row(
            {"id": "2", "user_login": "ward10a", "user_name": "   ", "ward": "10"}
        )
        self.assertEqual(ward_row["username"], "ward10a")
        self.assertIsNone(ward_row["full_name"])
        self.assertFalse(ward_row["is_admin"])
        self.assertEqual(ward_row["ward_code"], "10")
        self.assertEqual(ward_row["role_code"], "ward_recorder")

        for bad_login in ("ab", " " * 5, "x" * 81):
            with self.assertRaisesRegex(ValueError, "^invalid_username$"):
                parse_account_row({"id": "3", "user_login": bad_login, "user_name": "", "ward": "10"})

        placeholder = generate_placeholder_password()
        self.assertEqual(validate_password_policy(placeholder), placeholder)
        encoded = hash_password(placeholder)
        self.assertTrue(verify_password(placeholder, encoded))

    def test_writes_account_map_with_login_and_id_without_duplicates(self):
        account_map: dict[str, str] = {}
        add_account_map_entries(account_map, "1", "nurse_a", "nurse_a")
        add_account_map_entries(account_map, "", "nurse_b", "nurse_b")
        add_account_map_entries(account_map, "nurse_c", "nurse_c", "nurse_c")

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "account-map.csv"
            count = write_account_map(out_path, account_map)
            self.assertEqual(count, 4)

            with out_path.open("r", encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(
                rows,
                [
                    {"legacy_account_id": "nurse_a", "target_username": "nurse_a"},
                    {"legacy_account_id": "1", "target_username": "nurse_a"},
                    {"legacy_account_id": "nurse_b", "target_username": "nurse_b"},
                    {"legacy_account_id": "nurse_c", "target_username": "nurse_c"},
                ],
            )
            loaded = load_account_map(out_path)
            self.assertEqual(loaded["1"], "nurse_a")
            self.assertEqual(loaded["nurse_a"], "nurse_a")
            self.assertEqual(loaded["nurse_b"], "nurse_b")
            self.assertEqual(loaded["nurse_c"], "nurse_c")

    def test_import_legacy_parses_last_date_and_resolves_user_update(self):
        self.assertEqual(
            parse_last_date("2026-11-19 14:30:05"),
            datetime(2026, 11, 19, 14, 30, 5, tzinfo=BANGKOK_TZ),
        )
        self.assertEqual(
            parse_last_date("2026-11-19T07:30:05Z"),
            datetime(2026, 11, 19, 7, 30, 5, tzinfo=timezone.utc),
        )
        self.assertEqual(
            parse_last_date("2026-11-19T14:30:05+07:00"),
            datetime(2026, 11, 19, 14, 30, 5, tzinfo=timezone(timedelta(hours=7))),
        )
        for empty in (None, "", "   ", r"\N", "NULL", "0000-00-00 00:00:00", "invalid"):
            self.assertIsNone(parse_last_date(empty))

        fallback_id = uuid4()
        mapped_id = uuid4()
        resolved = {"nurse_a": NS(id=mapped_id), "unlinked": None}
        self.assertEqual(resolve_entry_actor_id({"user_update": "nurse_a"}, resolved, fallback_id), mapped_id)
        self.assertEqual(resolve_entry_actor_id({"user_update": "unlinked"}, resolved, fallback_id), fallback_id)
        self.assertEqual(resolve_entry_actor_id({"user_update": ""}, resolved, fallback_id), fallback_id)
        self.assertEqual(resolve_entry_actor_id({}, {}, fallback_id), fallback_id)

        with tempfile.TemporaryDirectory() as tmp:
            bad_map = Path(tmp) / "bad-map.csv"
            bad_map.write_text("legacy_account_id,target_username,pass_login\n1,nurse_a,x\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "^account_map_must_not_contain_credentials$"):
                load_account_map(bad_map)


if __name__ == "__main__":
    unittest.main()
