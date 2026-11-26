"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, Dialog, FormField, Icon, InfoCallout, StatusBadge } from "@/components/ui";
import { entryAccess, entryFormHref } from "@/lib/history-view.mjs";
import { closingCount } from "@/lib/dashboard.mjs";
import { flowFields, groups, staff, types } from "@/lib/census";
import { formatThaiDate, formatThaiNumber } from "@/lib/thai-date.mjs";
import { EntryActivity } from "@/components/entries/EntryActivity";

export function HistoryEntryDialog({ row, wards, shifts, user, busy, onClose, onAction }) {
  if (!row) return null;
  const ward = wards.find(item => item.id === row.ward_id);
  const shift = shifts.find(item => item.id === row.shift_type_id);
  const access = entryAccess(row, ward, user);
  return <Dialog open title="ตรวจสอบข้อมูลประจำวัน" onClose={onClose} busy={busy} description={`${ward?.name || "หอผู้ป่วย"} · เวร${shift?.display_name || "ที่ปิดใช้งาน"} · ${formatThaiDate(row.service_date)}`} actions={<><a className="ui-button ui-button--secondary" href={entryFormHref(row)}><Icon name={access.editable ? "edit" : "lock"} />{access.editable ? "แก้ไขในแบบฟอร์ม" : "เปิดแบบฟอร์มอ่านอย่างเดียว"}</a>{access.confirmable && <Button icon="check" disabled={busy} onClick={() => onAction(row, true)}>ยืนยันข้อมูล</Button>}{access.returnable && <Button variant="secondary" icon="history" disabled={busy} onClick={() => onAction(row, false)}>ส่งกลับแก้ไข</Button>}</>}>
    <StatusBadge status={row.status} /><div className="history-detail-grid"><section><h3>ยอดผู้ป่วย</h3><dl>{flowFields.map(([key,, label]) => <div key={key}><dt>{key === "on" ? "ยกมา" : label}</dt><dd>{groups.map(group => <span key={group}>{group.toUpperCase()} {formatThaiNumber(row[`${group}_${key}`])}</span>)}</dd></div>)}<div><dt>รับและจำหน่ายในวันเดียวกัน</dt><dd>{groups.map(group => <span key={group}>{group.toUpperCase()} {formatThaiNumber(row[`${group}_ad`])}</span>)}</dd></div><div><dt>คงเหลือ</dt><dd>{groups.map(group => <strong key={group}>{group.toUpperCase()} {formatThaiNumber(closingCount(row, group))}</strong>)}</dd></div></dl></section><section><h3>ประเภทผู้ป่วยและเตียง</h3><dl>{types.map(type => <div key={type}><dt>ประเภท {type}</dt><dd>{formatThaiNumber(row[`patient_type${type}`])}</dd></div>)}<div><dt>จำนวนเตียง</dt><dd>{formatThaiNumber(row.amount_bed)}</dd></div></dl><h3>เจ้าหน้าที่</h3><dl>{staff.map(code => <div key={code}><dt>{code}</dt><dd>{formatThaiNumber(row[`em_${code.toLowerCase()}`])}</dd></div>)}</dl></section></div>
    {row.specialties?.length > 0 && <section><h3>ผู้ป่วยแต่ละสาขา</h3><dl className="history-specialties">{row.specialties.map(item => <div key={`${item.specialty_code}:${item.category_code}`}><dt>{item.specialty_code.toUpperCase().replace("_", " ")} · ห้อง{item.category_code === "n" ? "สามัญ" : "พิเศษ"}</dt><dd>{formatThaiNumber(item.count_value)}</dd></div>)}</dl></section>}
    <EntryActivity key={row.id} entry={row} />
    <p className="ui-field-hint">ยอดคงเหลือไม่รวมรับและจำหน่ายในวันเดียวกัน เปิดแบบฟอร์มเพื่อดูข้อมูลรายเดือนและแผลกดทับที่เกี่ยวข้อง</p>
  </Dialog>;
}

export function HistoryActionDialog({ operation, wards, shifts, busy, error, onClose, onSubmit, onRefresh }) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const text = useRef(null);
  const alert = useRef(null);
  useEffect(() => { setReason(""); setReasonError(""); }, [operation]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  if (!operation) return null;
  const { row, confirm } = operation;
  const description = `${wards.find(item => item.id === row.ward_id)?.name || "หอผู้ป่วย"} · เวร${shifts.find(item => item.id === row.shift_type_id)?.display_name || "ที่ปิดใช้งาน"} · ${formatThaiDate(row.service_date)}`;
  const failure = error && <div ref={alert} tabIndex={-1} role="alert"><InfoCallout tone="danger" title="ทำรายการไม่สำเร็จ">{error.replaceAll("ward", "หอผู้ป่วย")}</InfoCallout><Button variant="secondary" icon="refresh" disabled={busy} onClick={onRefresh}>โหลดรายการล่าสุด</Button></div>;
  return confirm ? <ConfirmDialog open onClose={onClose} onConfirm={() => onSubmit(row, true)} title="ยืนยันข้อมูลรายการนี้" description={description} confirmLabel="ยืนยันและล็อกข้อมูล" loading={busy}><p>เมื่อยืนยันแล้ว หอผู้ป่วยจะไม่สามารถแก้ไขรายการนี้ได้</p>{failure}</ConfirmDialog> : <Dialog open onClose={onClose} title="ส่งกลับแก้ไข" description={description} busy={busy}><form onSubmit={event => { event.preventDefault(); if (!reason.trim()) { setReasonError("กรุณาระบุเหตุผลที่ส่งกลับแก้ไข"); text.current?.focus(); return; } onSubmit(row, false, reason); }}><FormField label="เหตุผลที่ส่งกลับแก้ไข" required error={reasonError}>{field => <textarea {...field} ref={text} className="ui-input" rows={4} maxLength={1000} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setReasonError(""); }} />}</FormField>{failure}<div className="ui-actions history-dialog-actions"><Button type="submit" icon="history" loading={busy}>ส่งกลับให้แก้ไข</Button><Button variant="secondary" disabled={busy} onClick={onClose}>ยกเลิก</Button></div></form></Dialog>;
}
