import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { addDaysISO, dateRangePreset, fiscalYearForDate, fiscalYearRange, formatFiscalYear, formatThaiDate, formatThaiMonth, formatThaiNumber, formatThaiTime, monthStartISO, parseISODate, parseThaiDate, thaiDateInput, todayISO, toISODate } from "../lib/thai-date.mjs";

test("พิมพ์ปี พ.ศ. และ ค.ศ. แล้วได้ ISO เดียวกัน รวมเลขไทย", () => {
  for (const text of ["19/11/2569", "19/11/2026", "2026-11-19", "2569-11-19", "๑๙/๑๑/๒๕๖๙", " 19.11.2569 "]) assert.equal(parseThaiDate(text), "2026-11-19");
  assert.equal(thaiDateInput("2026-11-19"), "19/11/2569");
  assert.equal(parseThaiDate("01/01/2399"), "2399-01-01");
  assert.equal(parseThaiDate("01/01/2400"), "1857-01-01");
});
test("ไม่เลื่อนวันที่ผิดเป็นวันถัดไป และตรวจปีอธิกสุรทินหลังแปลง พ.ศ.", () => {
  for (const value of ["31/04/2569", "29/02/2569", "31/13/2569", "00/01/2569", "19/11/69", "2026-2-30", "ข้อความ", ""]) assert.equal(parseThaiDate(value), null, value);
  assert.equal(parseThaiDate("29/02/2567"), "2024-02-29");
  assert.equal(parseThaiDate("29/02/2643"), null); // ค.ศ. 2100 ไม่ใช่ leap year
  assert.equal(parseThaiDate("29/02/2543"), "2000-02-29");
  assert.equal(parseISODate("2026-02-29"), null);
  assert.equal(toISODate(parseISODate("0004-02-29")), "0004-02-29");
});
test("วันปัจจุบันอิงกรุงเทพฯ ตรงรอยต่อเที่ยงคืนและปีใหม่", () => {
  assert.equal(todayISO(new Date("2026-11-18T16:59:59Z")), "2026-11-18");
  assert.equal(todayISO(new Date("2026-11-18T17:00:00Z")), "2026-11-19");
  assert.equal(todayISO(new Date("2026-12-31T17:00:00Z")), "2027-01-01");
});
test("บวกวันและช่วงด่วนข้ามเดือน/ปีได้โดยนับรวมวันสิ้นสุด", () => {
  assert.equal(addDaysISO("2024-03-01", -1), "2024-02-29");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(dateRangePreset("last7", "2027-01-03"), { from: "2026-12-28", to: "2027-01-03" });
  assert.deepEqual(dateRangePreset("previousMonth", "2027-01-03"), { from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(dateRangePreset("month", "2024-02-11"), { from: "2024-02-01", to: "2024-02-29" });
  assert.equal(monthStartISO("2026-11"), "2026-11-01");
  assert.equal(monthStartISO("2026-02-30"), "");
  assert.equal(monthStartISO("2026-11-extra"), "");
  assert.equal(dateRangePreset("unknown", "2026-11-19"), null);
});
test("แสดงวันที่และเดือนไทยเป็น พ.ศ. โดยไม่แก้ค่า ISO", () => {
  const iso = "2026-11-19";
  assert.equal(formatThaiDate(iso), "19 พ.ย. 2569");
  assert.equal(formatThaiMonth("2026-11"), "พฤศจิกายน 2569");
  assert.equal(formatThaiMonth("2026-10", { short: true, shortYear: true }), "ต.ค. 69");
  assert.equal(iso, "2026-11-19");
  for (const value of ["", null, "invalid", "2026-02-30"]) assert.equal(formatThaiDate(value), "—");
});
test("วันแบบ date-only ไม่เปลี่ยนเมื่อเครื่องใช้เขตเวลาอื่น", () => {
  for (const zone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", "import {formatThaiDate} from './lib/thai-date.mjs'; process.stdout.write(formatThaiDate('2026-11-19'));"], { cwd: new URL("../", import.meta.url), env: { ...process.env, TZ: zone }, encoding: "utf8" });
    assert.equal(result, "19 พ.ย. 2569");
  }
});
test("เวลาใช้กรุงเทพฯ รับเฉพาะเวลาในนาฬิกาหรือ timestamp ที่มีเขตเวลา", () => {
  assert.equal(formatThaiTime("2026-11-19T07:30:00Z"), "14:30 น.");
  assert.equal(formatThaiTime("00:00"), "00:00 น.");
  for (const value of ["24:00", "12:60", "2026-11-19", "2026-11-19T14:30:00", null]) assert.equal(formatThaiTime(value), "—");
});
test("ปีงบประมาณเปลี่ยนในวันที่ 1 ตุลาคม แปลงเป็นช่วง ISO โดยไม่บวก 543 ซ้ำ", () => {
  assert.equal(fiscalYearForDate("2026-09-30"), 2569);
  assert.equal(fiscalYearForDate("2026-10-01"), 2570);
  assert.deepEqual(fiscalYearRange(2570), { from: "2026-10-01", to: "2027-09-30" });
  assert.equal(fiscalYearRange(2027), null);
  assert.equal(formatFiscalYear(2570), "ปีงบประมาณ 2570 (ตุลาคม 2569 – กันยายน 2570)");
});
test("ตัวเลขแยกไม่มีข้อมูลจากศูนย์ และร้อยละรับค่าร้อยละอยู่แล้ว", () => {
  assert.equal(formatThaiNumber(0), "0");
  assert.equal(formatThaiNumber(1234567), "1,234,567");
  assert.equal(formatThaiNumber(85, { percent: true }), "85.0%");
  for (const value of ["", null, undefined, NaN, Infinity, false]) assert.equal(formatThaiNumber(value), "—");
});
