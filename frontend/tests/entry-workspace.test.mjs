import test from "node:test";
import assert from "node:assert/strict";
import { changedFields, draftScope, draftKey, makeDraft, readDraft, DRAFT_MAX_AGE, entryReview } from "../lib/entry-workspace.mjs";
const selection = { ward_id: "example-ward", service_date: "2026-11-19", shift_type_id: "13" };
const scope = draftScope("example-user", selection);
const key = draftKey(scope, { id: "example-entry", version: 3 });
const baseline = { pt_on: 10, amount_bed: 20, readmit_count: "", discharge_count: "" };
const now = 1800000000000;
test("ค่าค้างแยกบัญชี หอ วัน เวร รายการ และเวอร์ชัน", () => {
  assert.notEqual(draftScope("another-user", selection), scope);
  for (const field of Object.keys(selection)) assert.notEqual(draftScope("example-user", { ...selection, [field]: "different" }), scope);
  assert.notEqual(draftKey(scope, { id: "example-entry", version: 4 }), key);
  assert.notEqual(draftKey(scope, null), key);
  assert.equal(draftScope("", selection), "");
});
test("คง 0 กับค่าว่างต่างกัน และไม่ถือสตริงตัวเลขเท่ากันว่าแก้ไข", () => {
  assert.deepEqual(changedFields({ ...baseline, pt_on: "10", readmit_count: 0 }, baseline), ["readmit_count"]);
  const values = { ...baseline, pt_on: "0", amount_bed: "" };
  assert.deepEqual(readDraft(JSON.stringify(makeDraft(key, baseline, values, now)), key, baseline, now).values, values);
});
test("ข้อมูลต้นฉบับหรือรายเดือนเปลี่ยนแล้วไม่คืนค่าค้างทับ", () => {
  const raw = JSON.stringify(makeDraft(key, baseline, { ...baseline, pt_on: "12" }, now));
  assert.equal(readDraft(raw, key, { ...baseline, readmit_count: 2 }, now).status, "stale");
  assert.equal(readDraft(raw, key + "4", baseline, now).status, "invalid");
});
test("ปฏิเสธค่าค้างเสีย หมดอายุ และ field นอกแบบฟอร์ม", () => {
  assert.equal(readDraft("{", key, baseline, now).status, "invalid");
  assert.equal(readDraft(JSON.stringify(makeDraft(key, baseline, baseline, now - DRAFT_MAX_AGE - 1)), key, baseline, now).status, "invalid");
  assert.equal(readDraft(JSON.stringify(makeDraft(key, baseline, { ...baseline, csrf: "not-allowed" }, now)), key, baseline, now).status, "invalid");
  assert.equal(readDraft(JSON.stringify(makeDraft(key, baseline, { ...baseline, pt_on: {} }, now)), key, baseline, now).status, "invalid");
});
const counts = { pt_on: 10, pt_in: 2, pt_move: 1, pt_home: 1, pt_move_b: 1, pt_send: 1, pt_dead: 0, pt_non_voluntary: 0, pt_ad: 99, nb_on: 1, nb_in: 0, nb_move: 0, nb_home: 0, nb_move_b: 0, nb_send: 0, nb_dead: 0, nb_non_voluntary: 0, amount_bed: 20, patient_type1: 10, patient_type2: 0, patient_type3: 0, patient_type4: 0, patient_type5: 0 };
test("ยอดคงเหลือแยก PT/NB ไม่รวม A&D และไม่แก้ค่าที่กรอก", () => {
  const original = { ...counts };
  assert.deepEqual(entryReview(counts).closing, { pt: 10, nb: 1 });
  assert.deepEqual(entryReview(counts).warnings, []);
  assert.deepEqual(counts, original);
});
test("คำเตือนติดลบ เกินเตียง และประเภทเป็นข้อมูลแสดงผล; ช่องว่างไม่กลายเป็นศูนย์", () => {
  assert.ok(entryReview({ ...counts, pt_home: 30 }).warnings.some(w => w.key === "pt"));
  assert.ok(entryReview({ ...counts, amount_bed: 5 }).warnings.some(w => w.key === "pt-beds"));
  assert.ok(entryReview({ ...counts, patient_type5: 1 }).warnings.some(w => w.key === "types"));
  assert.equal(entryReview({ ...counts, pt_on: "" }).closing.pt, null);
});
