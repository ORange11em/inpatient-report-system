import { fiscalYearForDate, formatFiscalYear, formatThaiDate, formatThaiMonth, formatThaiNumber, formatThaiTime, parseISODate, monthStartISO, todayISO } from "./thai-date.mjs";
import { dailySnapshot } from "./dashboard.mjs";

export const REPORT_ORGANIZATION = "โรงพยาบาลอากาศอำนวย";
export const reportCatalog = {
  daily: ["รายงานประจำวัน", "day"], "daily-all": ["รายงานประจำวันรวมทุกตึก", "day"],
  monthly: ["รายงานประจำเดือน", "month"], "census-day": ["ยอดคงพยาบาลประจำวัน", "day"],
  "census-month": ["ยอดคงพยาบาลประจำเดือน", "range"], turnover: ["อัตราหมุนเวียนเตียง", "year"],
  los: ["ระยะเวลานอนเฉลี่ย (LOS)", "year"], occupancy: ["อัตราการครองเตียง", "year"],
  productivity: ["ผลผลิตทางการพยาบาล (Productivity)", "month"], specialty: ["แยกผู้ป่วยตามสาขา", "range"],
  "skill-mix": ["การผสมผสานอัตรากำลัง (%)", "year"], "nursing-hours": ["จำนวนชั่วโมงการพยาบาลต่อวันนอน", "year"],
  pressure: ["อัตราการเกิดแผลกดทับต่อ 1,000 วันนอนเสี่ยง", "year"], "pressure-detail": ["รายละเอียดแผลกดทับรายวัน", "month"],
  readmission: ["อัตราการกลับมารักษาซ้ำภายใน 28 วัน (%)", "year"]
};
export const statusLabels = { all: "ทั้งหมด", confirmed: "ยืนยันแล้ว", unconfirmed: "รอยืนยัน" };
export const hiddenStatusKinds = ["pressure", "pressure-detail", "readmission"];
export function reportHasData(result) {
  if (!result) return false;
  if (result.kind === "occupancy") return Boolean(result.occupancy?.wards.length);
  if (result.kind === "pressure-detail") return result.rows.length > 0;
  return result.rows.some(row => row.some(value => typeof value === "number" && Number.isFinite(value)));
}
export const cleanWardName = value => String(value ?? "").replace(/\s+/g, " ").trim();
export function wardDisplayMeta(rawName, wards = []) {
  const fullName = cleanWardName(rawName);
  if (!fullName || fullName.startsWith("รวม")) return { fullName, shortName: null };
  const match = Array.isArray(wards)
    ? wards.find(w => w && (w.name === rawName || cleanWardName(w.name) === fullName))
    : null;
  const shortCandidate = match?.short_name ? cleanWardName(match.short_name) : null;
  return {
    fullName,
    shortName: shortCandidate && shortCandidate !== fullName ? shortCandidate : null,
  };
}
export function pressureDrilldownTarget(resultKind, column, rowWardName, value, wards = []) {
  if (resultKind !== "pressure") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cleanedRowWard = cleanWardName(rowWardName);
  if (!cleanedRowWard || cleanedRowWard.startsWith("รวม")) return null;
  const fiscal = /^(\d{2})\/(\d{4})$/.exec(String(column ?? ""));
  if (!fiscal || Number(fiscal[2]) < 2400) return null;
  const month = String(Number(fiscal[2]) - 543).padStart(4, "0") + "-" + fiscal[1];
  if (!monthStartISO(month)) return null;
  const matchedWard = Array.isArray(wards)
    ? wards.find(w => w?.id && (w.name === rowWardName || cleanWardName(w.name) === cleanedRowWard))
    : null;
  if (!matchedWard) return null;
  const params = new URLSearchParams({
    kind: "pressure-detail",
    ward: String(matchedWard.id),
    month,
  });
  return {
    wardId: String(matchedWard.id),
    wardName: cleanWardName(matchedWard.name),
    month,
    href: "/reports?" + params.toString(),
  };
}
export const reportTimestamp = value => formatThaiDate(todayISO(value), { month: "long" }) + " " + formatThaiTime(value);
export function defaultReportFilters(kind = "daily", now = todayISO()) {
  return { kind, date: now, month: now.slice(0, 7), through: now.slice(0, 7), year: fiscalYearForDate(now), status: "all", ward: "", shift: "" };
}
export function reportPeriod(filters) {
  const mode = reportCatalog[filters.kind][1];
  return mode === "year" ? formatFiscalYear(Number(filters.year)) : mode === "day" ? formatThaiDate(filters.date, { month: "long" }) : mode === "range" ? formatThaiMonth(filters.month) + " - " + formatThaiMonth(filters.through) : formatThaiMonth(filters.month);
}
// Existing adapter: numeric values, completeness and totals remain service-owned.
export function occupancyTable(report) {
  const display = (item, value) => item.complete ? value : (item.num_record ?? item.sum_record) + "/" + (item.num_all_record ?? item.sum_all_record) + " เวร";
  return {
    columns: ["หอผู้ป่วย", ...report.months, "เฉลี่ยปี (%)", "เฉลี่ยปีก่อน (%)"],
    rows: [...report.wards, { ...report.total, name: "รวมทุกหอที่มีสิทธิ์" }].map(w => [
      w.name, ...w.months.map(m => display(m, m.bed_rate)), display(w.fiscal_year, w.fiscal_year.average),
      display(w.previous_fiscal_year, w.previous_fiscal_year.average)
    ])
  };
}
function dateText(value) {
  if (typeof value !== "string") return value;
  if (parseISODate(value)) return formatThaiDate(value);
  if (/^\d{4}-\d{2}$/.test(value) && monthStartISO(value)) return formatThaiMonth(value);
  const parts = value.split(" – ");
  return parts.length === 2 && parts.every(part => parseISODate(part)) ? parts.map(part => formatThaiDate(part)).join(" - ") : value;
}
export function reportColumnLabel(label) {
  if (/^\d{4}-\d{2}$/.test(label)) return formatThaiMonth(label, { short: true, shortYear: true });
  const fiscal = /^(\d{2})\/(\d{4})$/.exec(label);
  if (fiscal && Number(fiscal[2]) >= 2400) return formatThaiMonth((Number(fiscal[2]) - 543) + "-" + fiscal[1], { short: true, shortYear: true });
  return label.replace("A&D Same day", "รับและจำหน่ายในวันเดียวกัน (A&D)").replace("Patient Day", "วันนอน");
}
export function reportCellValue(value, column) {
  if (column === "หอผู้ป่วย") return cleanWardName(value);
  return ["วันที่", "วันที่ / ช่วง", "ช่วงข้อมูล"].includes(column) ? dateText(value) : value;
}
export function displayedReportCell(value, column, kind) {
  const actual = reportCellValue(value, column);
  if (actual == null || actual === "") return "—";
  if (typeof actual !== "number") return kind === "occupancy" ? String(actual).replace(/ เวร$/, "") : actual;
  const ratio = ["occupancy", "skill-mix", "productivity", "readmission", "turnover", "los", "nursing-hours", "pressure"].includes(kind) || /%|ร้อยละ|อัตราต่อ|ช่วงเตียงว่าง|จำหน่ายต่อเตียง/.test(column) || (["monthly", "census-month"].includes(kind) && column.startsWith("เฉลี่ยนอน"));
  const digits = kind === "monthly" && column === "เฉลี่ยนอน PT" ? 3 : ratio || !Number.isInteger(actual) ? 2 : 0;
  return formatThaiNumber(actual, { digits });
}
/** PHP screen/print/Excel may have different formulas; never reuse the screen value silently. */
export function reportForChannel(result, channel) {
  return result?.channels?.[channel] ? { ...result, ...result.channels[channel] } : result;
}
export function occupancyDelta(current, previous) {
  return current?.complete && previous?.complete && Number.isFinite(current.average) && Number.isFinite(previous.average) ? current.average - previous.average : null;
}
export function occupancyRecords(item) {
  return { recorded: item?.num_record ?? item?.sum_record ?? 0, expected: item?.num_all_record ?? item?.sum_all_record ?? 0 };
}
export function reportFilename(result) {
  const f = result.filters, mode = reportCatalog[result.kind][1];
  const day = value => { const d = parseISODate(value); return d ? d.getUTCDate() + "-" + (d.getUTCMonth()+1) + "-" + (d.getUTCFullYear()+543) : "ไม่ระบุ"; };
  const month = value => { const d = parseISODate(monthStartISO(value)); return d ? (d.getUTCMonth()+1) + "-" + (d.getUTCFullYear()+543) : "ไม่ระบุ"; };
  const period = mode === "year" ? "ปีงบ" + f.year : mode === "day" ? day(f.date) : mode === "range" ? month(f.month) + "_ถึง_" + month(f.through) : month(f.month);
  return result.title.replace(/[\\/:*?"<>|]/g, "") + "_" + period + ".xml";
}
export function spreadsheetXML(result) {
  const escape = s => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const isDailyAll = result.kind === "daily-all";
  const rawRows = [
    [result.title],
    [result.period],
    ...(isDailyAll ? [["แพทย์เวร", ""], ["พยาบาลเวรตรวจการ", ""]] : []),
    result.columns.map(reportColumnLabel),
    ...result.rows.map(row => row.map((cell, i) => reportCellValue(cell, result.columns[i]))),
    ...(isDailyAll ? [["หากไม่มีรายชื่อตึก แสดงว่าในวันดังกล่าว ตึกยังไม่มีการบันทึกข้อมูล"]] : []),
  ];
  const rows = rawRows.map(row => "<Row>" + row.map(cell =>
    '<Cell><Data ss:Type="' + (typeof cell === "number" ? "Number" : "String") + '">' + escape(cell) + "</Data></Cell>"
  ).join("") + "</Row>").join("");
  return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Worksheet ss:Name="รายงาน"><Table>' + rows + "</Table></Worksheet></Workbook>";
}
export function printColumnGroups(result) {
  const count = result.columns.length;
  if (count <= 16) return [Array.from({ length: count }, (_, i) => i)];
  const fixed = ["daily","monthly","census-day","census-month"].includes(result.kind) ? [0,1,2] : [0];
  const rest = Array.from({ length: count }, (_, i) => i).filter(i => !fixed.includes(i));
  const groups = [];
  for (let i = 0; i < rest.length; i += 9) groups.push([...fixed, ...rest.slice(i, i+9)]);
  return groups;
}
/** Display-only summary; stocks are never summed across shifts. */
export function dailyReportSummary(entries, wards, shifts, filters) {
  const expected = filters.kind === "daily-all" ? shifts.filter(s => String(s.id) === filters.shift) : shifts.filter(s => s.is_active);
  const selectedWards = wards.filter(w => !filters.ward || w.id === filters.ward);
  const scopedEntries = entries.filter(e => selectedWards.some(w => w.id === e.ward_id) && (filters.status === "all" || e.status === filters.status) && (filters.kind !== "daily-all" || String(e.shift_type_id) === filters.shift));
  const selectedEntries = scopedEntries.filter(e => [1,2,3].includes(shifts.find(s => s.id === e.shift_type_id)?.legacy_shift_id));
  const snapshots = selectedWards.map(ward => dailySnapshot(selectedEntries.filter(e => e.ward_id === ward.id), shifts)).filter(Boolean);
  const complete = expected.length ? selectedWards.filter(w => expected.every(s => selectedEntries.some(e => e.ward_id === w.id && e.shift_type_id === s.id))) : [];
  const missing = selectedWards.filter(w => !complete.includes(w));
  if (scopedEntries.some(e => !shifts.some(s => s.id === e.shift_type_id))) return { available: false, complete, missing, total: selectedWards.length, note: "ยังสรุปยอดไม่ได้ เนื่องจากข้อมูลเวรบางรายการไม่มีลำดับเวรให้ตรวจสอบ กรุณาดูค่าจากตารางรายงาน" };
  if (!snapshots.length) return { available: false, complete, missing, total: selectedWards.length };
  const closing = snapshots.reduce((n,s) => n+s.closing,0), received = snapshots.reduce((n,s) => n+s.received,0), discharged = snapshots.reduce((n,s) => n+s.discharged,0);
  const vacancies = snapshots.map(s=>s.vacant);
  const vacant = vacancies.every(n=>n!=null) ? vacancies.reduce((n,v)=>n+v,0) : null;
  const beds = vacant == null ? null : vacant + closing;
  return { available:true, closing,received,discharged,vacant,occupancy:beds>0?closing*100/beds:null, complete,missing,total:selectedWards.length };
}
