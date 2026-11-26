"use client";

import { Button, Card, DataTable, Icon, StatusBadge } from "@/components/ui";
import { useMobile } from "@/components/ui/primitives";
import { entryAccess, entryFormHref, groupEntriesByDate } from "@/lib/history-view.mjs";
import { closingCount } from "@/lib/dashboard.mjs";
import { formatThaiDate, formatThaiNumber, formatThaiTime, todayISO } from "@/lib/thai-date.mjs";

export function HistoryResults({ rows, wards, shifts, user, pendingView, busy, onInspect, view, setView }) {
  const mobile = useMobile();
  const columns = [
    { key: "service_date", label: "วันที่ / เวร / สถานะ", render: (_, row) => <span className="history-record-title"><strong>{formatThaiDate(row.service_date)}</strong><span>เวร{shifts.find(shift => shift.id === row.shift_type_id)?.display_name || "ที่ปิดใช้งาน"}</span><StatusBadge status={row.status} /></span> },
    { key: "ward_id", label: "หอผู้ป่วย", render: id => wards.find(ward => ward.id === id)?.name || "ไม่พบชื่อหอผู้ป่วย" },
    { key: "closing", label: "คงเหลือ PT / NB", render: (_, row) => <span className="history-count-pair"><span>PT <strong>{formatThaiNumber(closingCount(row, "pt"))}</strong></span><span>NB <strong>{formatThaiNumber(closingCount(row, "nb"))}</strong></span></span> },
    { key: "amount_bed", label: "เตียง", numeric: true, render: value => formatThaiNumber(value) },
    { key: "updated_at", label: "แก้ไขล่าสุด", render: value => value && Number.isFinite(new Date(value).getTime()) ? <span className="history-updated"><span>{formatThaiDate(todayISO(new Date(value)))}</span><span>{formatThaiTime(value)}</span></span> : "—" },
    { key: "actions", label: "ดำเนินการ", render: (_, row) => {
      const ward = wards.find(item => item.id === row.ward_id);
      const access = entryAccess(row, ward, user);
      return <div className="history-row-actions"><a className="ui-button ui-button--secondary" href={entryFormHref(row)} aria-label={`${access.editable ? "แก้ไข" : "เปิดดู"} ${ward?.name || "รายการ"} ${formatThaiDate(row.service_date)} เวร${shifts.find(item => item.id === row.shift_type_id)?.display_name || "ที่ปิดใช้งาน"}`}><Icon name={access.editable ? "edit" : "lock"} />{access.editable ? "แก้ไข" : "เปิดดู"}</a><Button variant="ghost" icon="checklist" disabled={busy} onClick={() => onInspect(row)}>ตรวจสอบ</Button></div>;
    } },
  ];
  const table = (entries, label) => <DataTable {...{ columns, mobileView: view }} rows={entries} label={label} showViewToggle={false} />;
  return <div className="history-results">{mobile && <div className="ui-actions history-view-toggle" aria-label="มุมมองรายการ"><Button variant={view === "cards" ? "primary" : "secondary"} aria-pressed={view === "cards"} onClick={() => setView("cards")}>การ์ด</Button><Button variant={view === "table" ? "primary" : "secondary"} aria-pressed={view === "table"} onClick={() => setView("table")}>ตาราง</Button></div>}{pendingView ? groupEntriesByDate(rows).map(group => <Card key={group.date} className="history-date-group" title={formatThaiDate(group.date, { month: "long" })} description={`${formatThaiNumber(group.entries.length)} รายการในหน้านี้`}>{table(group.entries, `รอยืนยัน ${formatThaiDate(group.date)}`)}</Card>) : table(rows, "ประวัติข้อมูลในหน้านี้")}</div>;
}
