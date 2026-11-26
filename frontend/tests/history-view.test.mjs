import test from "node:test";
import assert from "node:assert/strict";
import { entryFormHref, entryAccess, historyStatusCountsPath, groupEntriesByDate } from "../lib/history-view.mjs";
test("แก้ไขใช้หอ วัน ISO และ primary key เวรของรายการ ไม่ใช้ค่าปัจจุบัน", () => {
  const url = new URL(entryFormHref({ ward_id: "example-b", service_date: "2026-10-31", shift_type_id: 73 }), "http://localhost");
  assert.equal(url.pathname, "/entries");
  assert.deepEqual(Object.fromEntries(url.searchParams), { ward: "example-b", date: "2026-10-31", shift: "73" });
});
test("คงสิทธิ์แก้ไขและยืนยันตามหอ และส่งกลับเฉพาะผู้ดูแล", () => {
  assert.deepEqual(entryAccess({ status: "unconfirmed" }, { can_write: true }, { is_admin: false }), { editable: true, confirmable: true, returnable: false });
  assert.deepEqual(entryAccess({ status: "confirmed" }, { can_write: true }, { is_admin: false }), { editable: false, confirmable: false, returnable: false });
  assert.equal(entryAccess({ status: "confirmed" }, { can_write: false }, { is_admin: true }).returnable, true);
  assert.equal(entryAccess({ status: "unconfirmed" }, undefined, { is_admin: false }).confirmable, false);
});
test("ยอดบนปุ่มนับครบทุกสถานะและทุกหน้าภายในหอและช่วงวันที่เดียวกับตาราง", () => {
  assert.equal(historyStatusCountsPath({ status: "unconfirmed", offset: 50 }), "/entries/status-counts");
  assert.equal(historyStatusCountsPath({ ward_id: "a", date_from: "2026-11-01", date_to: "2026-11-22", status: "confirmed" }),
    "/entries/status-counts?ward_id=a&date_from=2026-11-01&date_to=2026-11-22");
});
test("จัดกลุ่มวันที่โดยรักษาลำดับบริการและไม่แก้ต้นฉบับ", () => {
  const rows = [{ id: 3, service_date: "2026-11-19" }, { id: 2, service_date: "2026-11-19" }, { id: 1, service_date: "2026-11-18" }];
  assert.deepEqual(groupEntriesByDate(rows).map(group => [group.date, group.entries.map(row => row.id)]), [["2026-11-19", [3, 2]], ["2026-11-18", [1]]]);
  assert.deepEqual(rows.map(row => row.id), [3, 2, 1]);
});
