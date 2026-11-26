"use client";

import { Button, Card, ErrorState, Icon, InfoCallout, NumberInput, Skeleton, StatusBadge, ThaiDatePicker, ThaiMonthPicker } from "@/components/ui";
import { monthlyFieldLabels } from "@/lib/indicator-view.mjs";

function IndicatorState({ state, ready, onRetry }) {
  if (state.phase === "error") return <ErrorState description={state.error} onRetry={onRetry} />;
  if (!ready) return state.phase === "loading" ? <Skeleton lines={3} /> : <p className="ui-muted">เลือกหอผู้ป่วยและช่วงข้อมูลเพื่อแสดงค่าที่บันทึกไว้</p>;
  return <div className="indicator-record-state" role="status">{state.found ? <span><Icon name="check" />มีข้อมูลที่บันทึกไว้</span> : <><StatusBadge status="unrecorded" label="ยังไม่มีข้อมูล" /><span className="ui-muted">ช่องกรอกเริ่มต้นเป็น 0</span></>}</div>;
}

function SaveFeedback({ state, reason, id, children }) {
  return <div className="indicator-save">
    {state.saveError && <div role="alert"><InfoCallout tone="danger" title="บันทึกไม่สำเร็จ">{state.saveError}</InfoCallout></div>}
    {state.notice && <p className="indicator-notice" role="status"><Icon name="check" />{state.notice}</p>}
    {children}
    <p id={id} className="ui-field-hint">{reason || "ตรวจสอบตัวเลขให้ครบก่อนบันทึก"}</p>
  </div>;
}

export function PressureIndicatorCard({ date, onDateChange, resetToken, state, ready, values, onChange, reason, busy, saving, onSave, onRetry, entryHref }) {
  const readonly = Boolean(reason);
  return <Card className="indicator-panel" title="แผลกดทับ" actions={<span className="ui-badge ui-tone--neutral">รายวัน</span>}>
    <form onSubmit={event => { event.preventDefault(); onSave(); }}>
      <ThaiDatePicker label="วันที่ข้อมูลแผลกดทับ" value={date} onChange={onDateChange} resetToken={resetToken} disabled={busy} required />
      <InfoCallout title="บันทึกคู่กับเวรบ่าย">แก้ไขได้จนกว่าจะยืนยันเวร ข้อมูลเดียวกับหน้าบันทึกข้อมูลประจำวัน</InfoCallout>
      <IndicatorState {...{ state, ready, onRetry }} />
      {ready && <>
        <div className="indicator-entry-state">{state.entryStatus === "confirmed" ? <StatusBadge status="confirmed" label="เวรบ่ายยืนยันแล้ว" /> : state.entryStatus === "unconfirmed" ? <StatusBadge status="unconfirmed" label="เวรบ่ายรอยืนยัน" /> : <StatusBadge status="readonly" label={state.entryStatus === "missing" ? "ยังไม่พบเวรบ่ายที่บันทึกไว้" : "ต้องตรวจสถานะเวรบ่ายใหม่"} />}</div>
        <div className="indicator-inputs">
          <NumberInput label="จำนวนครั้งระดับ 2–4" hint="จำนวนครั้งที่พบแผลกดทับระดับ 2–4" value={values.stage2_4_cases} onChange={value => onChange("stage2_4_cases", value)} required readOnly={readonly} />
          <NumberInput label="วันนอนผู้ป่วยเสี่ยง" hint="วันนอนรวมของผู้ป่วยกลุ่มเสี่ยง" value={values.at_risk_patient_days} onChange={value => onChange("at_risk_patient_days", value)} required readOnly={readonly} />
        </div>
      </>}
      <SaveFeedback state={state} reason={reason} id="pressure-save-reason"><Button type="submit" icon="save" loading={saving} disabled={Boolean(reason)} aria-describedby="pressure-save-reason">บันทึกข้อมูลรายวัน</Button></SaveFeedback>
      {entryHref && <a className="ui-button ui-button--ghost indicator-entry-link" href={entryHref}><Icon name="edit" />เปิดแบบฟอร์มเวรบ่ายของวันที่เลือก</a>}
    </form>
  </Card>;
}

export function ReadmissionIndicatorCard({ month, onMonthChange, state, ready, values, onChange, reason, busy, saving, onSave, onRetry }) {
  const labels = monthlyFieldLabels(month);
  return <Card className="indicator-panel" title="การกลับมารักษาซ้ำ" actions={<span className="ui-badge ui-tone--neutral">รายเดือน</span>}>
    <form onSubmit={event => { event.preventDefault(); onSave(); }}>
      <ThaiMonthPicker label="เดือนรายงานการกลับมารักษาซ้ำ" value={month} onChange={onMonthChange} disabled={busy} required />
      <InfoCallout title="ใช้ร่วมกันทั้งเดือนของหอผู้ป่วย">การแก้ไขมีผลต่อข้อมูลเดือนเดียวกันในหน้าบันทึกข้อมูลประจำวัน</InfoCallout>
      <IndicatorState {...{ state, ready, onRetry }} />
      {ready && <div className="indicator-inputs">
        <NumberInput label={labels.readmit_count} hint="ผู้ป่วยที่กลับมารักษาซ้ำด้วยโรคเดิมภายใน 28 วันหลังจำหน่าย" value={values.readmit_count} onChange={value => onChange("readmit_count", value)} required readOnly={Boolean(reason)} />
        <NumberInput label={labels.discharge_count} hint="ยอดจำหน่ายของเดือนก่อนเดือนรายงานที่เลือก" value={values.discharge_count} onChange={value => onChange("discharge_count", value)} required readOnly={Boolean(reason)} />
      </div>}
      <SaveFeedback state={state} reason={reason} id="readmission-save-reason"><Button type="submit" icon="save" loading={saving} disabled={Boolean(reason)} aria-describedby="readmission-save-reason">บันทึกข้อมูลรายเดือน</Button></SaveFeedback>
    </form>
  </Card>;
}
