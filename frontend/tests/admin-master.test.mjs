import test from "node:test";
import assert from "node:assert/strict";
import { navigation, pageContext } from "../lib/workspace.mjs";

test("pageContext resolves /admin/master route and admin menu metadata cleanly", () => {
  const context = pageContext("/admin/master");
  assert.equal(context.href, "/admin/master");
  assert.equal(context.label, "จัดการหอผู้ป่วยและเวร");
  assert.equal(context.short, "ตั้งค่า");
  assert.equal(context.group, "การจัดการระบบ");
  assert.equal(context.adminOnly, true);

  const adminItems = navigation.filter(item => item.group === "การจัดการระบบ");
  assert.equal(adminItems.some(item => item.href === "/admin/master" && item.adminOnly === true), true);
});
