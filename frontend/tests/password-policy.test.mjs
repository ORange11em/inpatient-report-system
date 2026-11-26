import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePasswordPolicy, summarizeUserRoles } from "../lib/password-policy.mjs";
import { pageContext } from "../lib/workspace.mjs";

test("evaluatePasswordPolicy enforces >= 8 chars, >= 1 uppercase, and >= 1 special char", () => {
  const valid = evaluatePasswordPolicy("Nurse@01");
  assert.equal(valid.valid, true);
  assert.equal(valid.minLength, true);
  assert.equal(valid.hasUppercase, true);
  assert.equal(valid.hasSpecial, true);

  assert.equal(evaluatePasswordPolicy("Ab!1234").valid, false);
  assert.equal(evaluatePasswordPolicy("Ab!1234").minLength, false);

  assert.equal(evaluatePasswordPolicy("nurse@2026").valid, false);
  assert.equal(evaluatePasswordPolicy("nurse@2026").hasUppercase, false);

  assert.equal(evaluatePasswordPolicy("Nurse2026").valid, false);
  assert.equal(evaluatePasswordPolicy("Nurse2026").hasSpecial, false);

  assert.equal(evaluatePasswordPolicy("Nurseกั123").valid, false);
  assert.equal(evaluatePasswordPolicy("Nurseกั123").hasSpecial, false);

  assert.equal(evaluatePasswordPolicy("A!" + "a".repeat(255)).valid, false);
});

test("summarizeUserRoles formats admin and ward roles in Thai", () => {
  const wards = new Map([
    ["w1", { id: "w1", name: "อายุรกรรมชาย", short_name: "อช" }],
    ["w2", { id: "w2", name: "ศัลยกรรมหญิง", short_name: "ศญ" }],
  ]);

  const admin = summarizeUserRoles({ global_role: "system_admin", ward_roles: [] }, wards);
  assert.equal(admin.globalLabel, "ผู้ดูแลระบบ");
  assert.equal(admin.wardSummary, "ทุกหอผู้ป่วย (สิทธิ์ผู้ดูแลระบบ)");

  const nurse = summarizeUserRoles(
    {
      global_role: null,
      ward_roles: [
        { ward_id: "w1", role_code: "ward_recorder" },
        { ward_id: "w2", role_code: "report_reader" },
      ],
    },
    wards,
  );
  assert.equal(nurse.globalLabel, "—");
  assert.equal(nurse.wardItems.length, 2);
  assert.equal(nurse.wardItems[0].wardShortName, "อช");
  assert.equal(nurse.wardSummary, "อายุรกรรมชาย (ผู้บันทึกประจำหอ), ศัลยกรรมหญิง (ผู้ดูรายงาน)");
});

test("pageContext resolves /users route cleanly", () => {
  const context = pageContext("/users");
  assert.equal(context.href, "/users");
  assert.equal(context.label, "จัดการผู้ใช้และสิทธิ์");
});
