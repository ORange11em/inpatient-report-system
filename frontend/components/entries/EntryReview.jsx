"use client";

import { Button, Card, InfoCallout } from "@/components/ui";
import { formatThaiNumber, formatThaiTime } from "@/lib/thai-date.mjs";
import { focusEntryField } from "./useEntryEditing";

export function EntryReview({ review, formRef }) {
  return <Card className="entry-review" title="ยอดคงเหลือเวรนี้" description="ยกมา + รับใหม่ + รับย้าย − การจำหน่ายทั้ง 5 ทาง · ไม่รวม A&D"><dl className="entry-review-totals">{[["PT", review.closing.pt], ["NB", review.closing.nb], ["รวมประเภทผู้ป่วย", review.typeTotal], ["จำนวนเตียง", review.beds]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatThaiNumber(value)}</dd></div>)}</dl>{review.warnings.length > 0 && <InfoCallout tone="warning" title={`ควรตรวจสอบ ${review.warnings.length} จุด · ยังบันทึกได้`}><ul className="entry-warning-list">{review.warnings.map(warning => <li key={warning.key}><span>{warning.text}</span><Button variant="ghost" onClick={() => focusEntryField(formRef.current?.querySelector(`[name="${warning.field}"]`))}>ไปตรวจสอบ</Button></li>)}</ul></InfoCallout>}</Card>;
}

export function EntryDraftNotice({ editing }) {
  return <>{editing.storageError && <div role="alert"><InfoCallout tone="warning" title="ตรวจสอบการเก็บค่าค้าง">{editing.storageError}</InfoCallout></div>}{editing.candidate && !editing.isDirty && (editing.candidate.status === "ready" ? <Card title="พบค่าค้างในเครื่อง" description={`เก็บไว้เมื่อ ${formatThaiTime(new Date(editing.candidate.savedAt))} ยังไม่ได้บันทึกเข้าระบบ`}><div className="ui-actions"><Button variant="secondary" onClick={editing.restore}>คืนค่าที่กรอกค้างไว้</Button><Button variant="ghost" onClick={editing.discard}>ไม่ใช้ค่าค้าง</Button></div></Card> : <InfoCallout tone="warning" title="ค่าค้างไม่ตรงกับข้อมูลล่าสุด"><p>ข้อมูลต้นฉบับเปลี่ยนแล้ว จึงไม่คืนค่าชุดเก่าทับข้อมูลที่เปิดอยู่</p><Button variant="secondary" onClick={editing.discard}>ลบค่าค้างชุดเก่า</Button></InfoCallout>)}</>;
}

export function EntrySaveSummary({ review, editing }) {
  return <div className="entry-save-summary"><p className="entry-save-totals"><strong>คงเหลือ PT {formatThaiNumber(review.closing.pt)}</strong><strong>NB {formatThaiNumber(review.closing.nb)}</strong><span className={review.warnings.length ? "entry-warning-count" : "ui-muted"}>{review.warnings.length} ข้อควรตรวจสอบ</span></p><p className="ui-field-hint">{editing.isDirty ? "มีการแก้ไขที่ยังไม่บันทึก" : editing.lastSavedAt ? `บันทึกล่าสุดในหน้านี้ ${formatThaiTime(editing.lastSavedAt)}` : "ตรวจสอบข้อมูลก่อนบันทึก"}</p>{editing.isDirty && editing.storedAt && !editing.storageError && <p className="ui-field-hint entry-save-secondary">เก็บค่าค้างในเครื่อง {formatThaiTime(new Date(editing.storedAt))}</p>}</div>;
}
