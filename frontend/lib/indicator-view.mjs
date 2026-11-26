import { addDaysISO, formatThaiMonth, monthStartISO } from "./thai-date.mjs";
import { monthlyLabels } from "./entry-workspace.mjs";

/** Labels only: reporting_month and both numeric fields keep their existing meaning. */
export function monthlyFieldLabels(month) {
  const start = monthStartISO(month);
  const previous = start && addDaysISO(start, -1);
  return { ...monthlyLabels, discharge_count: previous ? `จำนวนผู้ป่วยที่จำหน่ายทั้งหมดใน${formatThaiMonth(previous)}` : monthlyLabels.discharge_count };
}

export function indicatorChanged(values, baseline) {
  return Boolean(baseline && Object.keys(baseline).some(key => String(values[key] ?? "") !== String(baseline[key] ?? "")));
}

export function pressureDisabledReason({ ward, date, ready, phase, entryStatus, pending }) {
  if (!ward) return "เลือกหอผู้ป่วยก่อน";
  if (!date) return "เลือกวันที่ข้อมูลแผลกดทับก่อน";
  if (pending) return "กำลังบันทึกข้อมูล กรุณารอสักครู่";
  if (!ready) return phase === "error" ? "โหลดข้อมูลและสถานะเวรบ่ายไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึก" : "กำลังโหลดข้อมูลและตรวจสถานะเวรบ่าย";
  if (!ward.can_write) return "บัญชีนี้มีสิทธิ์อ่านข้อมูลหอผู้ป่วยนี้เท่านั้น";
  if (entryStatus === "confirmed") return "เวรบ่ายยืนยันแล้ว ข้อมูลแผลกดทับอ่านได้อย่างเดียว";
  if (entryStatus === "missing") return "บันทึกข้อมูลเวรบ่ายของวันที่เลือกก่อน จึงจะบันทึกแผลกดทับได้";
  if (entryStatus !== "unconfirmed") return "ต้องตรวจสถานะเวรบ่ายใหม่ก่อนบันทึก";
  return "";
}
