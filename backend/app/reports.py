"""Tabular reports from the inpatient entry, pressure and readmission records."""
from calendar import monthrange
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from itertools import groupby
from typing import Literal

from sqlalchemy import select

from app.models import DailyEntry, PressureDaily, ReadmissionMonthly, ShiftType, SpecialtyCount
from app.occupancy import EXCLUDED_LEGACY_WARD_CODES, fiscal_year_months
from app.schemas import COUNTER_FIELDS, SPECIALTY_CODES

ReportKind = Literal["daily", "daily-all", "monthly", "census-day", "census-month", "turnover", "los",
                     "productivity", "specialty", "skill-mix", "nursing-hours", "pressure", "pressure-detail", "readmission"]
ReportChannel = Literal["screen", "print", "excel"]
FISCAL = {"turnover", "los", "skill-mix", "nursing-hours", "pressure", "readmission"}
PAID = ("home", "move_b", "send", "dead", "non_voluntary")
FLOWS = {"on": "คงพยาบาล", "in": "รับใหม่", "move": "รับย้าย", "home": "กลับบ้าน", "move_b": "ย้ายตึก",
         "send": "ส่งต่อ", "dead": "ตาย", "non_voluntary": "ไม่สมัครใจอยู่", "ad": "A&D Same day"}
FLOW_KEYS = [group + "_" + suffix for suffix in FLOWS for group in ("pt", "nb")]
STAFF = ["em_" + role for role in ("hn", "rn", "tn", "pn", "aid")]
TYPES = ["patient_type" + str(i) for i in range(5, 0, -1)]


def rate(numerator, denominator):
    return numerator / denominator if denominator else None


def month_end(day):
    return day.replace(day=monthrange(day.year, day.month)[1])


def php_round(value, digits=2):
    return float(Decimal(str(value)).quantize(Decimal(10) ** -digits, rounding=ROUND_HALF_UP))


def table(columns, rows, precisions=None):
    precisions = precisions or {}
    return {"columns": columns, "rows": [[php_round(cell, precisions.get(columns[i], 2)) if isinstance(cell, float) else cell for i,cell in enumerate(row)] for row in rows]}


def closing_count(entry, group):
    return (getattr(entry, group + "_on") + getattr(entry, group + "_in") + getattr(entry, group + "_move")
            - sum(getattr(entry, group + "_" + key) for key in PAID))


def summarize(entries, shifts, opening="night"):
    """Input is ordered by date and legacy shift. Opening balances are stocks, not flows."""
    counts = Counter()
    beds = {}
    first = {}
    last = {}
    for entry in entries:
        for key in COUNTER_FIELDS:
            counts[key] += getattr(entry, key)
        first.setdefault(entry.ward_id, entry)
        beds[entry.ward_id] = entry.amount_bed
        last[entry.ward_id] = entry
    for group in ("pt", "nb"):
        source = entries
        if opening == "night":
            source = [e for e in entries if shifts[e.shift_type_id].legacy_shift_id == 1]
        elif opening == "first":
            source = first.values()
        counts[group + "_on"] = sum(getattr(e, group + "_on") for e in source)
        paid = sum(counts[group + "_" + key] for key in PAID)
        received = counts[group + "_in"] + counts[group + "_move"]
        closing = counts[group + "_on"] + received - paid
        counts.update({group + "_paid": paid, group + "_received": received,
                       group + "_closing": closing, group + "_days": closing + counts[group + "_ad"]})
    counts["beds"] = sum(value or 0 for value in beds.values())
    counts["first"] = sum(e.pt_on for e in first.values())
    counts["last"] = sum(closing_count(e, "pt") for e in last.values())
    counts["first_night"] = sum(e.pt_on for e in entries if e.service_date.day == 1 and shifts[e.shift_type_id].legacy_shift_id == 1)
    counts["pt_nursing"] = counts["pt_on"] + counts["pt_received"]
    return counts


def census_report(kind, entries, shifts, wards, start, end, channel="screen", calendar_days=None):
    census = kind.startswith("census-")
    type_keys = TYPES[1:] if census else TYPES
    nursing_keys = [] if census else ["pt_nursing"]
    common = FLOW_KEYS + ["pt_paid","nb_paid","pt_closing","nb_closing","pt_days","nb_days"] + nursing_keys + type_keys + STAFF
    labels = [FLOWS[suffix] + " " + group for suffix in FLOWS for group in ("PT","NB")]
    labels += ["รวมจำหน่าย PT","รวมจำหน่าย NB","คงเหลือ PT","คงเหลือ NB","Patient Day PT","Patient Day NB"] + (["รวมให้การพยาบาล PT"] if nursing_keys else [])
    staff_labels = [s[3:].upper() for s in STAFF]
    columns = ["หอผู้ป่วย","วันที่ / ช่วง","เวร"] + labels + ["ประเภท " + k[-1] for k in type_keys] + staff_labels
    columns += ["เตียง","เฉลี่ยนอน PT","เฉลี่ยนอน NB","ครองเตียง (%)","จำหน่ายต่อเตียง","ช่วงเตียงว่าง","สถานะ"]
    if census:
        columns += ["ยกมา PT","ยกไป PT","ชม. RN","ชม. บุคลากร","ผู้ให้บริการ","LOS"]
    rows = []
    census_days = calendar_days if calendar_days is not None else (end-start).days + 1
    def append(name, period, label, group, days=1, opening="night", per_shift=False, status="", occupancy_beds=None, bed_basis=None, ward_row=False):
        c = summarize(group, shifts, opening)
        pd = c["pt_days"]
        avg = rate(pd, days)
        numerator = c["pt_closing"] if per_shift else avg
        beds = c["beds"] if bed_basis is None else bed_basis
        nb_average = rate(c["nb_days"], days)
        if kind == "census-month" and name == "รวมทุกหอที่เลือก":
            # Source resets only the opening/ending accumulators before its group-2 loop.
            group2 = [e for e in group if wards[e.ward_id].report_group == 2]
            extra = summarize(group2, shifts)
            c["first"], c["last"] = extra["first"], extra["last"]
        row = [name, period, label] + [c[k] for k in common] + [
            beds or None, avg, nb_average, rate(numerator * 100, beds if occupancy_beds is None else occupancy_beds),
            rate(c["pt_paid"], beds), rate(beds * days - pd, c["pt_paid"]) if beds else None, status]
        if census:
            row.extend([c["first"], c["last"], (c["em_hn"] + c["em_rn"]) * 8, sum(c[k] for k in STAFF[:4]) * 8,
                        sum(c[k] for k in STAFF[1:]), rate(pd, c["pt_received"])])
        rows.append(row)

    by_ward = defaultdict(list)
    for e in entries:
        by_ward[e.ward_id].append(e)
    if kind == "daily-all":
        for wid, group in by_ward.items():
            for e in group:
                c = summarize([e], shifts, "all")
                rows.append([wards[wid].name, shifts[e.shift_type_id].display_name, c["pt_on"], c["nb_on"],
                             c["pt_received"], c["nb_received"], c["pt_paid"], c["nb_paid"], c["pt_on"]+c["pt_received"],
                             *[c[k] for k in TYPES], c["pt_closing"], c["nb_closing"], *[c[k] for k in STAFF]])
        if rows:
            rows.append(["รวมทุกหอที่เลือก", "รวม", *[sum(row[i] for row in rows) for i in range(2, len(rows[0]))]])
        # report_day_all.php includes this column but never calculates a value.
        for row in rows:
            row.append(None)
        return table(["หอผู้ป่วย","เวร","คงพยาบาล PT","คงพยาบาล NB","รวมรับ PT","รวมรับ NB","รวมจำหน่าย PT",
                      "รวมจำหน่าย NB","รวมให้การพยาบาล PT", *["ประเภท " + k[-1] for k in TYPES],
                      "คงเหลือ PT","คงเหลือ NB", *staff_labels, "Productivity (%)"], rows)

    period = str(start) if start == end else f"{start} – {end}"
    for wid, ward in wards.items():
        group = by_ward[wid]
        if not group:
            continue
        name = ward.name
        if census:
            append(name, period, "รวม", group, census_days, ward_row=True)
            continue
        for day, day_iter in groupby(group, key=lambda e: e.service_date):
            daily = list(day_iter)
            for e in daily:
                label = "ยืนยันแล้ว" if e.status == "confirmed" else "รอยืนยัน"
                append(name, str(day), shifts[e.shift_type_id].display_name, [e], opening="all", per_shift=True, status=label)
            append(name, str(day), "รวมวัน", daily, opening="first")
        if kind == "monthly":
            days = len({e.service_date for e in group})
            for sid, shift in shifts.items():
                chunk = [e for e in group if e.shift_type_id == sid]
                if chunk:
                    # report_month.php uses the final bed count of the entire month for all three totals.
                    append(name, str(start)[:7], "รวมเวร" + shift.display_name, chunk, days, "all", bed_basis=group[-1].amount_bed)
            append(name, str(start)[:7], "รวมเดือน", group, days)
    if census and entries:
        if kind == "census-month":
            for number in (1,):
                sub = [e for e in entries if wards[e.ward_id].report_group == number]
                if sub:
                    sub_beds = sum(group[-1].amount_bed or 0 for wid, group in by_ward.items() if group and wards[wid].report_group == number and wards[wid].legacy_code not in EXCLUDED_LEGACY_WARD_CODES)
                    append(f"รวมหอกลุ่ม {number}", period, "รวม", sub, census_days, occupancy_beds=sub_beds)
        beds = sum((items[-1].amount_bed or 0) for wid, items in by_ward.items()
                   if items and wards[wid].legacy_code not in EXCLUDED_LEGACY_WARD_CODES)
        append("รวมทุกหอที่เลือก", period, "รวม", entries, census_days, occupancy_beds=beds)
    return table(columns, rows, {"เฉลี่ยนอน PT": 3} if kind == "monthly" else None)


def fiscal_value(kind, records, shifts):
    if not records:
        return 0 if kind in {"skill-mix", "nursing-hours"} else None
    if kind == "pressure":
        return rate(sum(r.stage2_4_cases for r in records) * 1000, sum(r.at_risk_patient_days for r in records))
    if kind == "readmission":
        return rate(sum(r.readmit_count for r in records) * 100, sum(r.discharge_count for r in records))
    c = summarize(records, shifts)
    if kind == "turnover":
        return rate(c["pt_paid"], c["beds"])
    if kind == "los":
        return rate(c["pt_days"], c["first_night"] + c["pt_received"]) if c["pt_received"] else None
    if kind == "skill-mix":
        return rate((c["em_hn"] + c["em_rn"]) * 100, sum(c[k] for k in STAFF[:4]))
    return rate(sum(c[k] for k in STAFF[1:]) * 7, c["pt_days"])


def fiscal_report(kind, records, shifts, wards, year):
    months = fiscal_year_months(year)
    previous = fiscal_year_months(year - 1)
    rows = []
    def append(name, group):
        monthly = defaultdict(list)
        for r in group:
            d = r.reporting_month if kind == "readmission" else r.service_date
            monthly[d.year, d.month].append(r)
        values = [fiscal_value(kind, monthly[m], shifts) for m in months]
        if kind == "turnover":
            total = sum(php_round(v or 0) for v in values)
            prev = [fiscal_value(kind, monthly[m], shifts) for m in previous]
            prior_total = sum(php_round(v or 0) for v in prev)
            comparison = prior_total / 12
            rows.append([name, *values, total, prior_total, comparison])
        elif kind == "los":
            rows.append([name, *values, rate(sum(v or 0 for v in values), sum(bool(monthly[m]) for m in months))])
        else:
            rows.append([name, *values, fiscal_value(kind, group, shifts)])
    by_ward = defaultdict(list)
    for r in records:
        by_ward[r.ward_id].append(r)
    for ward in wards.values():
        append(ward.name, by_ward[ward.id])
    append("รวมทุกหอที่เลือก", records)
    columns = ["หอผู้ป่วย", *[f"{m:02}/{y+543}" for y,m in months], "เฉลี่ยปี" if kind == "los" else "รวมปี"]
    if kind == "turnover":
        columns.extend(["รวมปีก่อน", "เฉลี่ยต่อเดือนปีก่อน"])
    return table(columns, rows)


def productivity_report(entries, shifts, wards, start, channel="screen"):
    def value(group, code):
        c = summarize(group, shifts)
        top = 12 if code in {"12", "13"} else 7.5
        weights = (top, top, 5.5, 3.5, 1.5)
        workload = sum(c[key] * weight for key, weight in zip(TYPES, weights)) / 3
        return rate(workload * 100, 7 * sum(c[k] for k in STAFF)) or 0
    days = range(1, month_end(start).day + 1)
    by_ward = defaultdict(list)
    for e in entries:
        by_ward[e.ward_id].append(e)
    rows = []
    for w in wards.values():
        group = by_ward[w.id]
        per_day = defaultdict(list)
        for e in group:
            per_day[e.service_date.day].append(e)
        rows.append([w.name, *[value(per_day[d], w.legacy_code) for d in days], value(group, w.legacy_code)])
    return table(["หอผู้ป่วย", *map(str, days), "รวมเดือน (%)"], rows)


async def specialty_report(db, entries, shifts, wards, start, end):
    afternoon = [e.id for e in entries if shifts[e.shift_type_id].legacy_shift_id == 3]
    counts = defaultdict(Counter)
    # Chunk the IN predicate for multi-year ranges on asyncpg.
    for i in range(0, len(afternoon), 10000):
        for item in (await db.scalars(select(SpecialtyCount).where(SpecialtyCount.entry_id.in_(afternoon[i:i+10000])))):
            counts[item.entry_id][item.specialty_code, item.category_code] = item.count_value
    groups = defaultdict(list)
    single_month = start.replace(day=1) == end.replace(day=1)
    for e in entries:
        key = str(e.service_date) if single_month else str(e.service_date)[:7]
        groups[e.ward_id, key].append(e)
    rows = []
    totals = defaultdict(Counter)
    across = defaultdict(Counter)
    for (wid, period), group in groups.items():
        latest = {e.service_date: e for e in group if single_month or shifts[e.shift_type_id].legacy_shift_id == 3}
        pt = sum(closing_count(e, "pt") for e in latest.values())
        nb = sum(closing_count(e, "nb") for e in latest.values())
        for category, label in (("n","สามัญ"), ("s","พิเศษ")):
            values = [sum(counts[e.id][code, category] for e in group) for code in SPECIALTY_CODES]
            rows.append([wards[wid].name, period, label, pt, nb, *values, sum(values)])
            totals[wid,label].update(dict(zip(("pt","nb", *SPECIALTY_CODES), (pt,nb,*values))))
            across[period,label].update(dict(zip(("pt","nb", *SPECIALTY_CODES), (pt,nb,*values))))
    for (wid,label), c in totals.items():
        rows.append([wards[wid].name, "รวม", label, c["pt"], c["nb"], *[c[k] for k in SPECIALTY_CODES], sum(c[k] for k in SPECIALTY_CODES)])
    if len(wards) > 1:
        grand = defaultdict(Counter)
        for (period,label), c in across.items():
            rows.append(["รวมทุกหอที่เลือก", period, label, c["pt"], c["nb"], *[c[k] for k in SPECIALTY_CODES], sum(c[k] for k in SPECIALTY_CODES)])
            grand[label].update(c)
        for label,c in grand.items():
            rows.append(["รวมทุกหอที่เลือก", "รวม", label, c["pt"], c["nb"], *[c[k] for k in SPECIALTY_CODES], sum(c[k] for k in SPECIALTY_CODES)])
    return table(["หอผู้ป่วย","ช่วงข้อมูล","ห้อง","คงเหลือ PT","คงเหลือ NB", *[s.upper() for s in SPECIALTY_CODES],"รวมสาขา"], rows)


async def build_report(db, kind, wards, selected, through, shift_id, status, channel="screen"):
    start, end = selected, selected
    if kind in FISCAL:
        start, end = date(selected.year-1,10,1), date(selected.year,9,30)
    elif kind in {"monthly","productivity","pressure-detail","specialty","census-month"}:
        start = selected.replace(day=1)
        end = month_end(through if through and kind in {"specialty","census-month"} else selected)

    model = {"pressure":PressureDaily, "pressure-detail":PressureDaily, "readmission":ReadmissionMonthly}.get(kind, DailyEntry)
    day = model.reporting_month if model is ReadmissionMonthly else model.service_date
    query_start = start.replace(year=start.year-1) if kind == "turnover" else start
    query = select(model).where(model.ward_id.in_(list(wards)), day.between(query_start, end))
    shifts = {}
    if model is DailyEntry:
        shifts = {s.id:s for s in await db.scalars(select(ShiftType).order_by(ShiftType.legacy_shift_id, ShiftType.id))}
        query = query.join(ShiftType).where(ShiftType.legacy_shift_id.in_((1,2,3)))
        if status != "all" and kind != "monthly":
            query = query.where(DailyEntry.status == status)
        if kind == "daily-all" and shift_id is not None:
            query = query.where(DailyEntry.shift_type_id == shift_id)
        query = query.order_by(day, ShiftType.legacy_shift_id, model.ward_id)
    else:
        query = query.order_by(day, model.ward_id)
    records = (await db.scalars(query)).all()
    if model is DailyEntry and kind == "monthly" and status != "all":
        # The legacy monthly report filters the date list, then its inner
        # `ORDER BY ... AND i_status=...` leaves every shift on that date in.
        matching_days = {(e.ward_id, e.service_date) for e in records if e.status == status}
        records = [e for e in records if (e.ward_id, e.service_date) in matching_days]
    if kind in FISCAL:
        return fiscal_report(kind, records, shifts, wards, selected.year)
    if kind == "pressure-detail":
        rows = []
        by_day = {(r.ward_id, r.service_date): r for r in records}
        for ward in wards.values():
            group = [r for r in records if r.ward_id == ward.id]
            for number in range(1, end.day + 1):
                day = start.replace(day=number)
                record = by_day.get((ward.id, day))
                rows.append([ward.name, str(day), record.stage2_4_cases if record else None,
                             record.at_risk_patient_days if record else None,
                             rate(record.stage2_4_cases * 1000, record.at_risk_patient_days) if record else None,
                             "บันทึกแล้ว" if record else "ยังไม่บันทึก"])
            cases = sum(r.stage2_4_cases for r in group) if group else None
            risk = sum(r.at_risk_patient_days for r in group) if group else None
            rows.append([ward.name, "รวมเดือน", cases, risk, rate(cases * 1000, risk) if group else None, "รวมเดือน"])
        if len(wards) > 1:
            cases, risk = sum(r.stage2_4_cases for r in records), sum(r.at_risk_patient_days for r in records)
            rows.append(["รวมทุกหอที่เลือก", "รวมเดือน", cases if records else None, risk if records else None,
                         rate(cases * 1000, risk) if records else None, "รวมเดือน"])
        return table(["หอผู้ป่วย","วันที่","จำนวนครั้งระดับ 2–4","วันนอนผู้ป่วยเสี่ยง","อัตราต่อ 1,000 วันนอน","สถานะข้อมูล"], rows)
    if kind == "productivity":
        return productivity_report(records, shifts, wards, start, channel)
    if kind == "specialty":
        return await specialty_report(db, records, shifts, wards, start, end)
    legacy_days = None
    if kind == "census-month" and start.replace(day=1) != end.replace(day=1):
        # on_pt.php overwrites num_day in each iteration; the last BE-year month wins.
        legacy_days = monthrange(end.year + 543, end.month)[1]
    return census_report(kind, records, shifts, wards, start, end, channel, legacy_days)

