import test from "node:test";
import assert from "node:assert/strict";
import { indicatorChanged, monthlyFieldLabels, pressureDisabledReason } from "../lib/indicator-view.mjs";

test("ชื่อช่องรายเดือนใช้เดือนก่อนเดือนรายงานเป็น พ.ศ. รวมข้ามปีและวันสิ้นเดือน", () => {
  assert.match(monthlyFieldLabels("2026-11").discharge_count, /ตุลาคม 2569/);
  assert.equal(monthlyFieldLabels("2026-11").discharge_count, monthlyFieldLabels("2026-11-30").discharge_count);
  assert.match(monthlyFieldLabels("2027-01").discharge_count, /ธันวาคม 2569/);
  assert.match(monthlyFieldLabels("2024-03-31").discharge_count, /กุมภาพันธ์ 2567/);
  assert.equal(monthlyFieldLabels("").discharge_count, "จำนวนผู้ป่วยที่จำหน่ายทั้งหมดในเดือนก่อนหน้า");
  assert.equal(monthlyFieldLabels("2026-13").discharge_count, monthlyFieldLabels("").discharge_count);
});

test("การตรวจค่าค้างไม่แปลงช่องว่างเป็นศูนย์และไม่ถือเลขสตริงว่าเปลี่ยนค่า", () => {
  const baseline = { readmit_count: 0, discharge_count: 20 };
  assert.equal(indicatorChanged({ readmit_count: "0", discharge_count: "20" }, baseline), false);
  assert.equal(indicatorChanged({ readmit_count: "", discharge_count: "20" }, baseline), true);
  assert.equal(indicatorChanged({ readmit_count: 0, discharge_count: 21 }, baseline), true);
  assert.equal(indicatorChanged({}, null), false);
  assert.deepEqual(baseline, { readmit_count: 0, discharge_count: 20 });
});

test("ไม่เปิดบันทึกแผลกดทับจากข้อมูลที่ยังโหลดไม่สำเร็จ/ยืนยันแล้ว/ไม่มีเวร/ไม่มีสิทธิ์", () => {
  const context = { ward: { can_write: true }, date: "2026-11-19", ready: true, phase: "ready", entryStatus: "unconfirmed", pending: false };
  assert.equal(pressureDisabledReason(context), "");
  for (const patch of [{ ready: false }, { ready: false, phase: "error" }, { entryStatus: "confirmed" }, { entryStatus: "missing" }, { entryStatus: "unknown" }, { ward: { can_write: false } }, { pending: true }, { ward: null }, { date: "" }]) assert.notEqual(pressureDisabledReason({ ...context, ...patch }), "");
});
