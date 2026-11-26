"""สูตรอัตราครองเตียงรายเดือนชั่วคราว เลียนแบบรายงานระบบเดิม (legacy PHP).

Reproduces the monthly bed-occupancy formula of the legacy PHP report
(inpatient/report/bed_rate_r.php) as a temporary calculation until the
formula and bed denominator are formally approved.  The API response carries
``formula_id`` so consumers can tell this temporary version apart from any
future approved formula.
"""

from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Sequence
from uuid import UUID

FORMULA_ID = "legacy_monthly_temporary_v1"

FORMULA_NOTE = (
    "สูตรชั่วคราวเลียนแบบรายงานรายเดือนของระบบเดิม (bed_rate_r.php) ยังไม่ผ่านการอนุมัติ: "
    "ยอดตั้งต้นใช้ on_pt ของเวรที่ตั้งค่า legacy_shift_id=1, รวมรับใหม่/รับย้ายและรายการจำหน่ายจากทุกเวร, "
    "คงเหลือ = ตั้งต้น + รับใหม่ + รับย้าย − (กลับบ้าน + ย้ายตึก + ส่งต่อ + เสียชีวิต + ไม่สมัครใจอยู่), "
    "patient_day = คงเหลือ + ad, เฉลี่ยต่อวัน = patient_day ÷ จำนวนวันเดือน, "
    "อัตราครองเตียง = เฉลี่ยต่อวัน × 100 ÷ จำนวนเตียง (ใช้ค่าจากรายการสุดท้ายของเดือน เรียงตามวันที่และลำดับเวร), "
    "แสดงเฉพาะเดือนที่บันทึกครบทุกเวรของทุกวัน และเฉลี่ยปีงบประมาณหารด้วยจำนวนเดือนที่มีข้อมูล"
)

# Ward codes excluded from the combined bed denominator in the legacy report
# (the comment in the legacy code names them ICU / labour room).
EXCLUDED_LEGACY_WARD_CODES = frozenset({"12", "13", "16"})


@dataclass(frozen=True)
class EntryRow:
    ward_id: UUID
    legacy_ward_code: str | None
    service_date: date
    shift_id: int
    display_order: int
    amount_bed: int | None
    pt_on: int
    pt_in: int
    pt_move: int
    pt_home: int
    pt_move_b: int
    pt_send: int
    pt_dead: int
    pt_non_voluntary: int
    pt_ad: int


@dataclass
class MonthResult:
    year: int
    month: int
    num_day: int
    num_record: int
    num_all_record: int
    complete: bool
    on_pt: int
    in_pt: int
    move_pt: int
    home_pt: int
    move_b_pt: int
    send_pt: int
    dead_pt: int
    non_voluntary_pt: int
    ad_pt: int
    result_pt: int
    patient_day: int
    avg_sleep: float
    amount_bed: int | None
    bed_rate: float | None

    def to_dict(self) -> dict:
        return {
            "month": f"{self.year:04d}-{self.month:02d}",
            "num_day": self.num_day,
            "num_record": self.num_record,
            "num_all_record": self.num_all_record,
            "complete": self.complete,
            "on_pt": self.on_pt,
            "in_pt": self.in_pt,
            "move_pt": self.move_pt,
            "home_pt": self.home_pt,
            "move_b_pt": self.move_b_pt,
            "send_pt": self.send_pt,
            "dead_pt": self.dead_pt,
            "non_voluntary_pt": self.non_voluntary_pt,
            "ad_pt": self.ad_pt,
            "result_pt": self.result_pt,
            "patient_day": self.patient_day,
            "avg_sleep": self.avg_sleep,
            "amount_bed": self.amount_bed,
            "bed_rate": self.bed_rate,
        }


@dataclass
class YearSummary:
    num_month: int
    sum_record: int
    sum_all_record: int
    complete: bool
    average: float | None

    def to_dict(self) -> dict:
        return {
            "num_month": self.num_month,
            "sum_record": self.sum_record,
            "sum_all_record": self.sum_all_record,
            "complete": self.complete,
            "average": self.average,
        }


def fiscal_year_months(fiscal_year_end: int) -> list[tuple[int, int]]:
    """Thai fiscal-year month list: Oct of year-1 through Sep of the end year."""
    start = fiscal_year_end - 1
    return [(start, month) for month in (10, 11, 12)] + [
        (fiscal_year_end, month) for month in range(1, 10)
    ]


def _month_key(year: int, month: int) -> tuple[int, int]:
    return (year, month)


def compute_month(
    rows: Sequence[EntryRow],
    year: int,
    month: int,
    night_shift_ids: set[int],
    shift_count: int,
) -> MonthResult:
    num_day = monthrange(year, month)[1]
    num_record = len(rows)
    num_all_record = num_day * shift_count
    complete = num_record == num_all_record

    on_pt = sum(row.pt_on for row in rows if row.shift_id in night_shift_ids)
    in_pt = sum(row.pt_in for row in rows)
    move_pt = sum(row.pt_move for row in rows)
    home_pt = sum(row.pt_home for row in rows)
    move_b_pt = sum(row.pt_move_b for row in rows)
    send_pt = sum(row.pt_send for row in rows)
    dead_pt = sum(row.pt_dead for row in rows)
    non_voluntary_pt = sum(row.pt_non_voluntary for row in rows)
    ad_pt = sum(row.pt_ad for row in rows)

    sum_paid_pt = home_pt + move_b_pt + send_pt + dead_pt + non_voluntary_pt
    result_pt = (on_pt + in_pt + move_pt) - sum_paid_pt
    patient_day = result_pt + ad_pt
    avg_sleep = round(patient_day / num_day, 4) if patient_day else 0.0

    # Legacy behaviour: the loop overwrites amount_bed on every row, so the
    # value of the last row (ordered by date then shift) wins.
    ordered = sorted(rows, key=lambda row: (row.service_date, row.display_order, row.shift_id))
    amount_bed = ordered[-1].amount_bed if ordered else None
    bed_rate = round(patient_day * 100 / (num_day * amount_bed), 2) if amount_bed else None

    return MonthResult(
        year=year,
        month=month,
        num_day=num_day,
        num_record=num_record,
        num_all_record=num_all_record,
        complete=complete,
        on_pt=on_pt,
        in_pt=in_pt,
        move_pt=move_pt,
        home_pt=home_pt,
        move_b_pt=move_b_pt,
        send_pt=send_pt,
        dead_pt=dead_pt,
        non_voluntary_pt=non_voluntary_pt,
        ad_pt=ad_pt,
        result_pt=result_pt,
        patient_day=patient_day,
        avg_sleep=avg_sleep,
        amount_bed=amount_bed,
        bed_rate=bed_rate,
    )


def compute_year_summary(months: Sequence[MonthResult]) -> YearSummary:
    num_month = sum(1 for month in months if month.num_record > 0)
    sum_record = sum(month.num_record for month in months)
    sum_all_record = sum(month.num_all_record for month in months)
    # The PHP report gates display separately and averages unrounded monthly rates.
    total_bed_rate = sum(m.patient_day * 100 / (m.num_day * m.amount_bed) for m in months if m.amount_bed)
    average = round(total_bed_rate / num_month, 2) if num_month else None
    return YearSummary(
        num_month=num_month,
        sum_record=sum_record,
        sum_all_record=sum_all_record,
        complete=sum_record == sum_all_record,
        average=average,
    )


def compute_ward_series(
    rows: Sequence[EntryRow],
    months: Sequence[tuple[int, int]],
    night_shift_ids: set[int],
    shift_count: int,
) -> tuple[list[MonthResult], YearSummary]:
    grouped: dict[tuple[int, int], list[EntryRow]] = defaultdict(list)
    for row in rows:
        grouped[_month_key(row.service_date.year, row.service_date.month)].append(row)
    results = [
        compute_month(grouped[_month_key(year, month)], year, month, night_shift_ids, shift_count)
        for year, month in months
    ]
    return results, compute_year_summary(results)


def compute_total_series(
    rows: Sequence[EntryRow],
    months: Sequence[tuple[int, int]],
    night_shift_ids: set[int],
    shift_count: int,
    ward_count: int,
    excluded_legacy_codes: frozenset[str] = EXCLUDED_LEGACY_WARD_CODES,
) -> tuple[list[MonthResult], YearSummary]:
    """Combined row: numerator counts every ward; the bed denominator sums the
    per-ward month bed value for wards whose legacy code is not excluded.
    """
    ward_rows: dict[UUID, list[EntryRow]] = defaultdict(list)
    for row in rows:
        ward_rows[row.ward_id].append(row)

    results: list[MonthResult] = []
    for year, month in months:
        month_rows = [
            row for row in rows
            if _month_key(row.service_date.year, row.service_date.month) == (year, month)
        ]
        base = compute_month(month_rows, year, month, night_shift_ids, shift_count)

        total_bed = 0
        for ward_rows_for_id in ward_rows.values():
            ward_month_rows = [
                row for row in ward_rows_for_id
                if _month_key(row.service_date.year, row.service_date.month) == (year, month)
            ]
            if not ward_month_rows:
                continue
            if ward_month_rows[0].legacy_ward_code in excluded_legacy_codes:
                continue
            ordered = sorted(
                ward_month_rows,
                key=lambda row: (row.service_date, row.display_order, row.shift_id),
            )
            bed = ordered[-1].amount_bed
            if bed:
                total_bed += bed

        num_all_record = base.num_day * shift_count * ward_count
        results.append(
            MonthResult(
                year=year,
                month=month,
                num_day=base.num_day,
                num_record=base.num_record,
                num_all_record=num_all_record,
                complete=base.num_record == num_all_record,
                on_pt=base.on_pt,
                in_pt=base.in_pt,
                move_pt=base.move_pt,
                home_pt=base.home_pt,
                move_b_pt=base.move_b_pt,
                send_pt=base.send_pt,
                dead_pt=base.dead_pt,
                non_voluntary_pt=base.non_voluntary_pt,
                ad_pt=base.ad_pt,
                result_pt=base.result_pt,
                patient_day=base.patient_day,
                avg_sleep=base.avg_sleep,
                amount_bed=total_bed or None,
                bed_rate=round(base.patient_day * 100 / (base.num_day * total_bed), 2) if total_bed else None,
            )
        )
    return results, compute_year_summary(results)
