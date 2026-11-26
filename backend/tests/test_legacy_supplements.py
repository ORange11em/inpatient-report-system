from datetime import date, datetime
from pathlib import Path
import tempfile
import unittest
from uuid import uuid4

from app.cli.import_legacy_supplements import (
    BANGKOK_TZ,
    SPLIT_FIELDS,
    composite_target_uuid,
    load_account_map,
    parse_news_row,
    parse_pressure_row,
    parse_readmit_row,
    parse_split_row,
    safe_row_hash,
    supplement_business_key_hash,
)


class LegacySupplementImportUnitTests(unittest.TestCase):
    def test_split_patient_preserves_zeros_and_rejects_blanks(self):
        row = {"ward": "10", "idate": "2026-11-01", **{k: "0" for k in SPLIT_FIELDS}}
        row["med_n"] = "2"
        row["skin_s"] = "3"
        ward_code, service_date, counts = parse_split_row(row)
        self.assertEqual(ward_code, "10")
        self.assertEqual(service_date, date(2026, 11, 1))
        self.assertEqual(counts[("med", "n")], 2)
        self.assertEqual(counts[("skin", "s")], 3)
        self.assertEqual(counts[("obs", "n")], 0)

        for blank in ("", r"\N", "NULL"):
            bad = dict(row, med_n=blank)
            with self.assertRaisesRegex(ValueError, "^blank_specialty_count_field$"):
                parse_split_row(bad)

    def test_pressure_distinguishes_zero_zero_from_blank(self):
        ward_code, service_date, cases, risk = parse_pressure_row(
            {"ward": "11", "idate": "2026-11-01", "do_pressure": "0", "risk_pressure": "0"}
        )
        self.assertEqual((ward_code, service_date, cases, risk), ("11", date(2026, 11, 1), 0, 0))

        for field in ("do_pressure", "risk_pressure"):
            for blank in ("", r"\N"):
                bad = {"ward": "11", "idate": "2026-11-01", "do_pressure": "0", "risk_pressure": "0", field: blank}
                with self.assertRaisesRegex(ValueError, "^blank_pressure_field$"):
                    parse_pressure_row(bad)

    def test_readmit_maps_first_of_month_and_tracks_idate_provenance(self):
        ward_code, rep_month, source_idate, readmit_cnt, discharge_cnt, warnings = parse_readmit_row(
            {"ward": "10", "month1": "2026-11", "idate": "2026-11-02", "readmit_amount": "2", "discharge_amount": "40"}
        )
        self.assertEqual(ward_code, "10")
        self.assertEqual(rep_month, date(2026, 11, 1))
        self.assertEqual(source_idate, date(2026, 11, 2))
        self.assertEqual((readmit_cnt, discharge_cnt), (2, 40))
        self.assertEqual(warnings, [])

        _, _, missing_idate, _, _, warn_missing = parse_readmit_row(
            {"ward": "11", "month1": "2026-10", "idate": "", "readmit_amount": "0", "discharge_amount": "10"}
        )
        self.assertIsNone(missing_idate)
        self.assertEqual(warn_missing, ["readmit_idate_missing"])

        with self.assertRaisesRegex(ValueError, "^blank_readmit_field$"):
            parse_readmit_row(
                {"ward": "10", "month1": "2026-11", "idate": "2026-11-02", "readmit_amount": "", "discharge_amount": "40"}
            )

    def test_tb_news_preserves_date_time_status_and_missing_publisher(self):
        news_id, title, detail, published, created_at, legacy_user, warnings = parse_news_row(
            {
                "id": "1",
                "title_news": "แจ้งทดสอบระบบ",
                "detail_news": "ใช้ข้อมูลสมมติเท่านั้น",
                "status_news": "1",
                "date_news": "2026-11-01",
                "time_news": "09:30:00",
                "user_update": "synthetic-a",
            }
        )
        self.assertEqual(news_id, 1)
        self.assertEqual(title, "แจ้งทดสอบระบบ")
        self.assertEqual(detail, "ใช้ข้อมูลสมมติเท่านั้น")
        self.assertTrue(published)
        self.assertEqual(created_at, datetime(2026, 11, 1, 9, 30, 0, tzinfo=BANGKOK_TZ))
        self.assertEqual(legacy_user, "synthetic-a")
        self.assertEqual(warnings, [])

        # Missing publisher and time are flagged as provenance warnings, not fabricated
        _, _, _, draft_pub, draft_dt, draft_user, draft_warnings = parse_news_row(
            {
                "id": "2",
                "title_news": "ร่างประกาศทดสอบ",
                "detail_news": "เนื้อหาร่าง",
                "status_news": "0",
                "date_news": "2026-11-02",
                "time_news": "",
                "user_update": "",
            }
        )
        self.assertFalse(draft_pub)
        self.assertEqual(draft_dt, datetime(2026, 11, 2, 0, 0, 0, tzinfo=BANGKOK_TZ))
        self.assertIsNone(draft_user)
        self.assertEqual(set(draft_warnings), {"news_time_missing", "news_publisher_missing"})

        # Missing date_news is rejected so current date is never fabricated
        with self.assertRaisesRegex(ValueError, "^news_date_missing$"):
            parse_news_row(
                {
                    "id": "3",
                    "title_news": "ข่าวไม่มีวันที่",
                    "detail_news": "เนื้อหา",
                    "status_news": "1",
                    "date_news": "",
                    "time_news": "08:00:00",
                    "user_update": "admin",
                }
            )

    def test_account_map_rejects_credential_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad_map = Path(tmp) / "account.csv"
            bad_map.write_text("legacy_account_id,target_username,pass_login\n1,admin,secret\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "account_map_must_not_contain_credentials"):
                load_account_map(bad_map)

            good_map = Path(tmp) / "account_map.csv"
            good_map.write_text("legacy_account_id,target_username\nsynthetic-a,Admin_User\n", encoding="utf-8")
            self.assertEqual(load_account_map(good_map), {"synthetic-a": "admin_user"})

    def test_deterministic_hashes_and_target_uuids(self):
        w_id = uuid4()
        d = date(2026, 11, 1)
        self.assertEqual(
            composite_target_uuid("pressure_daily", w_id, d),
            composite_target_uuid("pressure_daily", w_id, d),
        )
        self.assertNotEqual(
            composite_target_uuid("pressure_daily", w_id, d),
            composite_target_uuid("readmission_monthly", w_id, d),
        )
        row = {"ward": "10", "idate": "2026-11-01", "do_pressure": "1", "risk_pressure": "10"}
        self.assertEqual(safe_row_hash("pressure", row, 1), safe_row_hash("pressure", row, 1))
        self.assertNotEqual(safe_row_hash("pressure", row, 1), safe_row_hash("pressure", row, 2))
        self.assertEqual(
            supplement_business_key_hash("pressure", "10", "2026-11-01"),
            supplement_business_key_hash("pressure", "10", "2026-11-01"),
        )


if __name__ == "__main__":
    unittest.main()
