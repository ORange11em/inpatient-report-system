import test from "node:test";
import assert from "node:assert/strict";
import { closingCount, dailySnapshot, sameShiftComparison, wardCompletion } from "../lib/dashboard.mjs";
import { pageContext } from "../lib/workspace.mjs";
const shifts = [1, 2, 3].map(id => ({ id: id + 10, legacy_shift_id: id, is_active: true }));
const entry = (shift, values = {}) => ({ ward_id: "example-a", shift_type_id: shift + 10, status: "confirmed", pt_on: 20, amount_bed: 30, ...values });
test("ยอดคงเหลือหักการจำหน่ายครบห้าทางและไม่บวก A&D", () => {
  assert.equal(closingCount(entry(1, { pt_in: 5, pt_move: 2, pt_home: 1, pt_move_b: 1, pt_send: 1, pt_dead: 1, pt_non_voluntary: 1, pt_ad: 7 })), 22);
});
test("ใช้ยอดคงเหลือเวรล่าสุดแทนรวมยอดยกมาทุกเวร และไม่แก้ลำดับข้อมูลต้นฉบับ", () => {
  const entries = [entry(2, { pt_on: 21, pt_in: 3 }), entry(1, { pt_in: 2, pt_home: 1 })];
  const snapshot = dailySnapshot(entries, shifts);
  assert.equal(snapshot.closing, 24); assert.equal(snapshot.received, 5); assert.equal(snapshot.discharged, 1);
  assert.equal(snapshot.occupancy, 80); assert.equal(snapshot.vacant, 6); assert.equal(entries[0].shift_type_id, 12);
});
test("ไม่มีรายการและไม่มีฐานเตียงไม่แสดงศูนย์แทนข้อมูลที่ขาด", () => {
  assert.equal(dailySnapshot([], shifts), null);
  assert.equal(dailySnapshot([entry(1, { amount_bed: null })], shifts).occupancy, null);
  assert.equal(dailySnapshot([entry(1, { amount_bed: null })], shifts).vacant, null);
});
test("เปรียบเทียบผ่านเวรเดียวกันและต้องมีเวรนั้นเมื่อวานจริง", () => {
  const previous = [entry(1, { pt_in: 2 }), entry(2, { pt_in: 3 }), entry(3, { pt_in: 10 })];
  assert.equal(sameShiftComparison(previous, shifts, 12).received, 5);
  assert.equal(sameShiftComparison([entry(1)], shifts, 12), null);
});
test("หอครบหมายถึงยืนยันครบทุกเวรที่เปิด ไม่ใช่มีรายการเพียงอย่างเดียว", () => {
  const wards = [{ id: "example-a" }, { id: "example-b" }];
  const result = wardCompletion([entry(1), entry(2), entry(3, { status: "unconfirmed" })], wards, shifts);
  assert.equal(result.complete, 0); assert.equal(result.total, 2);
  assert.equal(wardCompletion([entry(1), entry(2), entry(3)], wards, shifts).complete, 1);
});
test("แยก active ของประวัติและรอยืนยันโดยไม่เปลี่ยน route", () => {
  assert.equal(pageContext("/history").href, "/history");
  assert.equal(pageContext("/history", "?status=unconfirmed").href, "/history?status=unconfirmed");
  assert.equal(pageContext("/history", "?status=confirmed").href, "/history");
});
