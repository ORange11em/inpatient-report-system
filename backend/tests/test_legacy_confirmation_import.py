import unittest
from datetime import date, datetime

from app.cli.import_legacy_confirmations import parse_optional_date, parse_optional_datetime, safe_row_hash


class LegacyConfirmationImportTests(unittest.TestCase):
    def test_blank_legacy_timestamp_stays_missing(self):
        self.assertIsNone(parse_optional_datetime(""))
        self.assertIsNone(parse_optional_date(""))

    def test_legacy_datetime_is_not_replaced_with_current_time(self):
        self.assertEqual(parse_optional_datetime("2020-01-02 03:04:05"), datetime(2020, 1, 2, 3, 4, 5))

    def test_duplicate_source_rows_have_stable_distinct_keys(self):
        row = {"ward": "10", "idate": "2020-01-02", "wage_type_id": "1", "cdate": "", "cuser": ""}
        self.assertEqual(safe_row_hash(row, 1), safe_row_hash(row, 1))
        self.assertNotEqual(safe_row_hash(row, 1), safe_row_hash(row, 2))

    def test_iso_date_only_contract(self):
        self.assertEqual(parse_optional_date("2020-02-29"), date(2020, 2, 29))
        with self.assertRaises(ValueError):
            parse_optional_date("2020-02-30")


if __name__ == "__main__":
    unittest.main()
