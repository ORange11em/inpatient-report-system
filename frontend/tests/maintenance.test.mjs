import test from "node:test";
import assert from "node:assert/strict";
import { getMaintenanceContent, isMaintenanceModeEnabled } from "../lib/maintenance.mjs";

test("โหมดแจ้งปิดปรับปรุงปิดเป็นค่าเริ่มต้น และเปิดเฉพาะเมื่อกำหนดค่าเปิดชัดเจน", () => {
  for (const off of [undefined, null, "", "false", "0", "no", "off", "FALSE"]) {
    assert.equal(isMaintenanceModeEnabled(off), false);
  }
  for (const on of ["true", "TRUE", "1", "yes", "on", " true "]) {
    assert.equal(isMaintenanceModeEnabled(on), true);
  }
});

test("ข้อความหน้าแจ้งปิดปรับปรุงใช้ภาษาไทยสุภาพ มีชื่อโรงพยาบาล และไม่มีศัพท์เทคนิคระบบ", () => {
  const content = getMaintenanceContent({ note: "" });
  assert.equal(content.hospitalName, "โรงพยาบาลอากาศอำนวย");
  assert.match(content.title, /แจ้งปิดปรับปรุง/);
  assert.match(content.description, /กรุณาเว้นช่วงการใช้งานชั่วคราว/);
  for (const text of Object.values(content)) {
    assert.doesNotMatch(String(text), /\b(API|payload|database|backend|env)\b/i);
  }
});
