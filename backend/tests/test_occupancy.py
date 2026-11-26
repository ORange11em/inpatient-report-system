"""Unit tests for the temporary legacy monthly occupancy formula."""

import unittest
from datetime import date
from uuid import uuid4

from app.occupancy import (
    EntryRow,
    compute_month,
    compute_total_series,
    compute_ward_series,
    compute_year_summary,
    fiscal_year_months,
)

WARD_A = uuid4()
WARD_B = uuid4()


def make_row(
    ward_id=WARD_A,
    legacy_code="01",
    day=1,
    shift_id=1,
    display_order=1,
    bed=50,
    pt_on=0,
    **counts,
):
    values = dict(
        pt_in=0, pt_move=0, pt_home=0, pt_move_b=0,
        pt_send=0, pt_dead=0, pt_non_voluntary=0, pt_ad=0,
    )
    values.update(counts)
    return EntryRow(
        ward_id=ward_id,
        legacy_ward_code=legacy_code,
        service_date=date(2026, 2, day),
        shift_id=shift_id,
        display_order=display_order,
        amount_bed=bed,
        pt_on=pt_on,
        **values,
    )


def full_february_2026():
    """28 days x 3 shifts: night on=10 ad=2 bed=50, morning in=1, evening home=1."""
    rows = []
    for day in range(1, 29):
        rows.append(make_row(day=day, shift_id=1, display_order=1, pt_on=10, pt_ad=2))
        rows.append(make_row(day=day, shift_id=2, display_order=2, pt_in=1))
        rows.append(make_row(day=day, shift_id=3, display_order=3, pt_home=1))
    return rows


class TestFiscalMonths(unittest.TestCase):
    def test_month_list(self):
        months = fiscal_year_months(2026)
        self.assertEqual(len(months), 12)
        self.assertEqual(months[0], (2025, 10))
        self.assertEqual(months[-1], (2026, 9))

    def test_previous_year(self):
        months = fiscal_year_months(2025)
        self.assertEqual(months[0], (2024, 10))
        self.assertEqual(months[-1], (2025, 9))


class TestComputeMonth(unittest.TestCase):
    def test_complete_month_aggregates(self):
        rows = full_february_2026()
        result = compute_month(rows, 2026, 2, night_shift_ids={1}, shift_count=3)
        self.assertEqual(result.num_day, 28)
        self.assertEqual(result.num_record, 84)
        self.assertEqual(result.num_all_record, 84)
        self.assertTrue(result.complete)
        self.assertEqual(result.on_pt, 280)          # night rows only
        self.assertEqual(result.in_pt, 28)           # morning rows only
        self.assertEqual(result.home_pt, 28)         # evening rows only
        self.assertEqual(result.ad_pt, 56)           # night rows only
        self.assertEqual(result.result_pt, 280)      # 280 + 28 + 0 - 28
        self.assertEqual(result.patient_day, 336)    # 280 + 56
        self.assertEqual(result.avg_sleep, 12.0)     # 336 / 28
        self.assertEqual(result.amount_bed, 50)
        self.assertEqual(result.bed_rate, 24.0)      # 12 * 100 / 50

    def test_on_pt_counts_night_shift_only(self):
        rows = [
            make_row(day=1, shift_id=1, display_order=1, pt_on=10),
            make_row(day=1, shift_id=2, display_order=2, pt_on=999),
        ]
        result = compute_month(rows, 2026, 2, night_shift_ids={1}, shift_count=3)
        self.assertEqual(result.on_pt, 10)

    def test_amount_bed_uses_last_row(self):
        rows = [
            make_row(day=1, shift_id=1, display_order=1, bed=50),
            make_row(day=1, shift_id=3, display_order=3, bed=60),
        ]
        result = compute_month(rows, 2026, 2, night_shift_ids={1}, shift_count=3)
        self.assertEqual(result.amount_bed, 60)

    def test_incomplete_month_flags_complete_false_but_keeps_rate(self):
        rows = full_february_2026()[:-1]  # one row missing
        result = compute_month(rows, 2026, 2, night_shift_ids={1}, shift_count=3)
        self.assertEqual(result.num_record, 83)
        self.assertFalse(result.complete)
        self.assertIsNotNone(result.bed_rate)

    def test_missing_bed_yields_no_rate(self):
        rows = [make_row(day=1, shift_id=1, bed=None, pt_on=10)]
        result = compute_month(rows, 2026, 2, night_shift_ids={1}, shift_count=3)
        self.assertIsNone(result.amount_bed)
        self.assertIsNone(result.bed_rate)

    def test_no_rows_zero_summary(self):
        result = compute_month([], 2026, 2, night_shift_ids={1}, shift_count=3)
        self.assertEqual(result.num_record, 0)
        self.assertFalse(result.complete)
        self.assertEqual(result.patient_day, 0)
        self.assertIsNone(result.bed_rate)


class TestYearSummary(unittest.TestCase):
    def test_summary_divides_by_months_with_data(self):
        feb = compute_month(full_february_2026(), 2026, 2, {1}, 3)
        jan = compute_month([], 2026, 1, {1}, 3)
        summary = compute_year_summary([jan, feb])
        self.assertEqual(summary.num_month, 1)
        self.assertEqual(summary.sum_record, 84)
        self.assertEqual(summary.sum_all_record, (31 + 28) * 3)
        self.assertFalse(summary.complete)
        self.assertEqual(summary.average, 24.0)


class TestWardSeries(unittest.TestCase):
    def test_series_matches_months(self):
        rows = full_february_2026()
        months = [(2026, 1), (2026, 2)]
        results, summary = compute_ward_series(rows, months, {1}, 3)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].to_dict()["month"], "2026-01")
        self.assertEqual(results[1].bed_rate, 24.0)
        # January still contributes 31 days of expected shifts.
        self.assertEqual(summary.sum_record, 84)
        self.assertEqual(summary.sum_all_record, (31 + 28) * 3)
        self.assertFalse(summary.complete)


class TestTotalSeries(unittest.TestCase):
    def test_total_excludes_legacy_12_from_bed_denominator(self):
        rows = [
            make_row(ward_id=WARD_A, legacy_code="01", day=1, shift_id=1, pt_on=10, bed=50),
            make_row(ward_id=WARD_B, legacy_code="12", day=1, shift_id=1, pt_on=10, bed=100),
        ]
        months = [(2026, 2)]
        results, summary = compute_total_series(rows, months, {1}, 3, ward_count=2)
        result = results[0]
        # numerator includes both wards; denominator excludes ward B
        self.assertEqual(result.on_pt, 20)
        self.assertEqual(result.amount_bed, 50)
        self.assertEqual(result.avg_sleep, round(20 / 28, 4))
        self.assertEqual(result.bed_rate, round(result.avg_sleep * 100 / 50, 2))
        # completeness gate uses ward multiplier
        self.assertEqual(result.num_all_record, 28 * 3 * 2)
        self.assertFalse(result.complete)
        self.assertEqual(summary.num_month, 1)

    def test_per_ward_series_keeps_excluded_ward_bed(self):
        rows = [
            make_row(ward_id=WARD_B, legacy_code="12", day=1, shift_id=1, pt_on=10, bed=100),
        ]
        results, _ = compute_ward_series(rows, [(2026, 2)], {1}, 3)
        self.assertEqual(results[0].amount_bed, 100)


if __name__ == "__main__":
    unittest.main()
