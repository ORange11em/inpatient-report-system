"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { todayISO, thaiDateLabel } from "@/components/DateField";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { preferredWard } from "@/lib/workspace.mjs";
import { flowFields, types, staff, specialties, countFields, groups, patientDays } from "@/lib/census";
import { Button, Card, ConfirmDialog, EmptyState, InfoCallout, Legend, PageHeader, Skeleton, StatusBadge, StickyActionBar, Toast } from "@/components/ui";
import { EntryContextBar } from "@/components/entries/EntryContextBar";
import { EntryFieldRow, EntryFlowSummary, EntryFocusControls, EntryLayout, EntrySection, revealInvalidField } from "@/components/entries/EntryLayout";
import { formatThaiDate, formatThaiMonth, formatThaiNumber, formatThaiTime } from "@/lib/thai-date.mjs";
import { entryReview } from "@/lib/entry-workspace.mjs";
import { monthlyFieldLabels } from "@/lib/indicator-view.mjs";
import { useEntryEditing } from "@/components/entries/useEntryEditing";
import { EntryDraftNotice, EntryReview, EntrySaveSummary } from "@/components/entries/EntryReview";
import { EntryActivity } from "@/components/entries/EntryActivity";
import { satisfactionLink } from "@/lib/satisfaction.mjs";
import "@/styles/entries.css";

function initialValues(context) {
  const entry = context.entry;
  const values = Object.fromEntries(countFields.map(key => [key, entry?.[key] ?? 0]));
  values.pt_on = entry?.pt_on ?? context.pt_on;
  values.nb_on = entry?.nb_on ?? context.nb_on;
  values.amount_bed = (entry ? entry.amount_bed : context.amount_bed) ?? "";
  for (const category of ["n", "s"]) for (const code of specialties) values[code + ":" + category] = 0;
  for (const item of entry?.specialties || []) values[item.specialty_code + ":" + item.category_code] = item.count_value;
  values.stage2_4_cases = context.pressure?.stage2_4_cases ?? 0;
  values.at_risk_patient_days = context.pressure?.at_risk_patient_days ?? 0;
  values.readmit_count = context.readmission?.readmit_count ?? "";
  values.discharge_count = context.readmission?.discharge_count ?? "";
  return values;
}

export default function EntriesPage() {
  const { user, csrfToken } = useAuth();
  const [wards, setWards] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selection, setSelection] = useState({ ward_id: "", service_date: todayISO(), shift_type_id: "" });
  const [context, setContext] = useState(null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contextRequest, setContextRequest] = useState(0);
  const entry = context?.entry;
  const ward = wards.find(w => w.id === selection.ward_id);
  const shift = shifts.find(s => String(s.id) === selection.shift_type_id);
  const afternoon = shift?.legacy_shift_id === 3;
  const readonly = !ward?.can_write || entry?.status === "confirmed";
  const editing = useEntryEditing({ userId: user?.id, selection, context, values, setValues, setDirty, readonly, busy, initialValues, select, open, error });
  const review = entryReview(values);
  const monthlyLabels = monthlyFieldLabels(selection.service_date);
  const relatedHref = "/indicators?" + new URLSearchParams({ ward: selection.ward_id, date: selection.service_date, month: selection.service_date.slice(0, 7) });
  const nextShift = shifts.filter(item => item.is_active && item.display_order > shift?.display_order).sort((a, b) => a.display_order - b.display_order)[0];
  const nextEntryHref = nextShift ? "/entries?" + new URLSearchParams({ ward: selection.ward_id, date: selection.service_date, shift: nextShift.id }) : null;
  const satisfactionHref = satisfactionLink(process.env.NEXT_PUBLIC_SATISFACTION_URL, ward?.legacy_code, Boolean(ward?.can_write));

  function show(data) {
    setContext(data);
    setValues(initialValues(data));
    setDirty(false);
  }

  useEffect(() => {
    let active = true;
    async function init() {
      const [w, s] = await Promise.all([apiRequest("/wards"), apiRequest("/shifts?include_inactive=true")]);
      if (!active) return;
      setWards(w);
      setShifts(s);
      const params = new URLSearchParams(window.location.search);
      const key = {
        ward_id: params.get("ward") || preferredWard(w) || w[0]?.id || "",
        service_date: params.get("date") || todayISO(),
        shift_type_id: params.get("shift") || String(s.find(item => item.is_active)?.id ?? "")
      };
      setSelection(key);
      if (params.has("ward") && params.has("shift") && params.has("date")) {
        const data = await apiRequest("/entry-form?" + new URLSearchParams(key));
        if (active) show(data);
      }
    }
    init().catch(e => { if (active) setError(getErrorMessage(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  function select(key, value) {
    setSelection(s => ({ ...s, [key]: value }));
    setContext(null);
    setError("");
    setNotice("");
  }

  async function open(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    setContext(null);
    try {
      show(await apiRequest("/entry-form?" + new URLSearchParams(selection)));
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  function input(key, label, min = 0, required = true) {
    return <input {...editing.fieldProps(key)} type="number" name={key} aria-label={label} required={required} min={min} max="2147483647" step="1"
      value={values[key] ?? ""} onChange={e => { setValues({ ...values, [key]: e.target.value }); setDirty(true); editing.fieldChanged(key); }} />;
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const hasReadmit = values.readmit_count !== "";
    if (hasReadmit !== (values.discharge_count !== "") || (!hasReadmit && context.readmission)) {
      setError("กรุณากรอกจำนวนผู้ป่วยทั้งสองช่องในส่วนรีแอดมิต ระบุ 0 ได้เมื่อไม่มีผู้ป่วย");
      return;
    }
    if (!window.confirm("บันทึกข้อมูลเวร" + shift.display_name + " วันที่ " + thaiDateLabel(selection.service_date) + " หรือไม่?")) return;
    const body = Object.fromEntries([...countFields, "amount_bed"].map(key => [key, Number(values[key])]));
    if (afternoon) {
      body.specialties = specialties.flatMap(code => ["n", "s"].map(category => ({
        specialty_code: code, category_code: category, count_value: Number(values[code + ":" + category])
      })));
      body.pressure = { stage2_4_cases: Number(values.stage2_4_cases), at_risk_patient_days: Number(values.at_risk_patient_days) };
    }
    if (hasReadmit && (Number(values.readmit_count) !== context.readmission?.readmit_count ||
        Number(values.discharge_count) !== context.readmission?.discharge_count)) {
      body.readmission = { readmit_count: Number(values.readmit_count), discharge_count: Number(values.discharge_count) };
      body.previous_readmission = context.readmission;
    }
    setBusy(true);
    try {
      const result = await apiRequest(entry ? "/entries/" + entry.id : "/entries", {
        csrfToken, method: entry ? "PATCH" : "POST",
        body: entry ? { ...body, expected_version: entry.version } : { ...body, ...selection, shift_type_id: shift.id }
      });
      show({ ...context, entry: result, pressure: body.pressure ?? context.pressure, readmission: body.readmission ?? context.readmission });
      editing.saved();
      window.dispatchEvent(new Event("inpatient-entries-changed"));
      setNotice("บันทึกข้อมูลเวร" + shift.display_name + " แล้ว");
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function confirmEntry() {
    if (dirty || !window.confirm("ยืนยันการส่งข้อมูลและล็อกรายการเวรนี้หรือไม่?")) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest("/entries/" + entry.id + "/confirm", { method: "POST", csrfToken, body: { expected_version: entry.version } });
      show({ ...context, entry: result });
      window.dispatchEvent(new Event("inpatient-entries-changed"));
      setNotice("ยืนยันการส่งข้อมูลแล้ว");
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return <AppShell><EntryLayout>
    <PageHeader title="บันทึกข้อมูลประจำวัน" description={context ? undefined : "เลือกบริบท แล้วกรอกข้อมูลแยกตามกลุ่มในแบบรายงาน"} />
    <EntryContextBar {...{ wards, shifts, selection, busy, satisfactionHref }} select={editing.changeSelection} open={editing.openForm} resetToken={editing.resetToken} requestToken={contextRequest} hasContext={Boolean(context)} />
    {!busy && !error && !wards.length && <Card><EmptyState title="ยังไม่มีหอผู้ป่วยที่ได้รับสิทธิ์" description="ติดต่อผู้ดูแลระบบเพื่อกำหนดหอผู้ป่วยให้บัญชีนี้" /></Card>}
    {!busy && !error && wards.length > 0 && !shifts.some(s => s.is_active) && <InfoCallout tone="warning" title="ยังไม่มีเวรที่เปิดใช้งาน">ติดต่อผู้ดูแลระบบเพื่อตรวจสอบข้อมูลเวร</InfoCallout>}
    {error && <div role="alert" id="entry-error" tabIndex={-1} ref={editing.errorRef}><InfoCallout tone="danger" title="ทำรายการไม่สำเร็จ">{error}</InfoCallout></div>}
    <EntryDraftNotice editing={editing} />
    <span id="entry-changed-hint" className="ui-sr-only">ช่องนี้มีการแก้ไขที่ยังไม่บันทึก</span><span id="entry-number-hint" className="ui-sr-only">กรอกจำนวนเต็มตั้งแต่ศูนย์ จำนวนเตียงต้องอย่างน้อยหนึ่ง ตรวจจำนวนสูงสุดตามช่องกรอก</span>
    {busy && !context && <Card><Skeleton label="กำลังเปิดแบบฟอร์ม" lines={5} /></Card>}
    {!context && !busy && !error && wards.length > 0 && shifts.some(s => s.is_active) && <Card><EmptyState title="เลือกข้อมูลเพื่อเริ่มบันทึก" description="เลือกหอผู้ป่วย วันที่ และเวร แล้วกดเปิดแบบฟอร์ม" icon="edit" /></Card>}
    {context && <form ref={editing.formRef} onSubmit={save} onKeyDown={editing.moveField} onInvalidCapture={revealInvalidField} className="daily-entry-form" aria-label="แบบฟอร์มบันทึกข้อมูลประจำวัน">
      <Card className="entry-form-heading"><div className="entry-heading-label"><h2>{ward?.name} · เวร{shift?.display_name}</h2><p className="ui-muted">{formatThaiDate(selection.service_date, { month: "long" })}</p></div><div className="ui-actions"><StatusBadge status={entry?.status || "unrecorded"} />{readonly ? <StatusBadge status="readonly" /> : <span className="ui-badge ui-tone--neutral">{entry ? "แก้ไข" : "สร้างใหม่"}</span>}</div>{!readonly && <EntryFocusControls />}</Card>
      {!entry && context.source_date && <InfoCallout title="แหล่งข้อมูลยกมา">ยอดผู้ป่วยและจำนวนเตียงจาก {formatThaiDate(context.source_date)} · เวร{shifts.find(s => s.id === context.source_shift_id)?.display_name || context.source_shift_id}</InfoCallout>}
      {readonly && <InfoCallout title="อ่านอย่างเดียว">{entry?.status === "confirmed" ? "รายการนี้ยืนยันแล้ว จึงแก้ไขข้อมูลไม่ได้" : "บัญชีนี้ไม่มีสิทธิ์บันทึกหรือแก้ไขข้อมูลในหอผู้ป่วยนี้"}</InfoCallout>}
      {entry && <EntryActivity key={entry.id} entry={entry} />}
      <EntryReview review={review} formRef={editing.formRef} />
      {afternoon && !readonly && !context.pressure && <InfoCallout tone="warning" title="อย่าลืมบันทึกข้อมูลแผลกดทับของวันนี้"><p>กรอกในส่วนแผลกดทับด้านล่าง ข้อมูลนี้ใช้ร่วมกับหน้าตัวชี้วัดเสริม</p><a href={relatedHref} className="ui-button ui-button--secondary">ไปหน้าตัวชี้วัดเสริม</a></InfoCallout>}
      {editing.lastSavedAt && !editing.isDirty && <Card title="บันทึกข้อมูลแล้ว" description={`บันทึกล่าสุดในหน้านี้ ${formatThaiTime(editing.lastSavedAt)}`}><div className="ui-actions">{nextEntryHref ? <a className="ui-button ui-button--secondary" href={nextEntryHref}>บันทึกเวรถัดไป</a> : <Button variant="secondary" onClick={() => setContextRequest(value => value + 1)}>เลือกวันและเวรถัดไป</Button>}<a className="ui-button ui-button--ghost" href="/history?status=unconfirmed">ไปหน้ารอยืนยัน</a></div></Card>}
      <details className="entry-legend"><summary>คำอธิบายช่องข้อมูล</summary><Legend items={[{ label: "PT / NB", description: "แยกช่องตามกลุ่มข้อมูล" }, { label: "ประเภทผู้ป่วย", description: "เรียง 5 → 1" }, { label: "เจ้าหน้าที่", description: staff.join(" · ") }]} /></details>
      <fieldset className="plain-fields entry-fields" disabled={readonly || busy}><div className="entry-sections">
        <div className="entry-flow-sections">{[[["on"], "ยอดผู้ป่วยยกมา"], [["in", "move"], "การรับ"], [["home", "move_b", "send", "dead", "non_voluntary"], "การจำหน่าย"]].map(([codes, title], index) => <EntrySection first={index === 0} number={index + 1} key={title} title={title} summary={<EntryFlowSummary {...{ values, codes }} />} className={`entry-flow-section entry-flow-section--${index}`}>
          <div className="entry-data-rows" style={{ "--entry-columns": codes.length }}>{flowFields.filter(([key]) => codes.includes(key)).map(([key,, label]) => <EntryFieldRow key={key} label={key === "on" ? "ยกมา" : label}>{groups.map(group => input(`${group}_${key}`, `${key === "on" ? "ยกมา" : label} ${group.toUpperCase()}`))}</EntryFieldRow>)}</div>
        </EntrySection>)}</div>
        <div className="entry-core-sections">
          <EntrySection number="4" title="รับและจำหน่ายในวันเดียวกัน (A&D)" summary={<EntryFlowSummary values={values} codes={["ad"]} />} className="entry-ad"><EntryFieldRow label="จำนวนผู้ป่วย">{groups.map(group => input(`${group}_ad`, `A&D ${group.toUpperCase()}`))}</EntryFieldRow></EntrySection>
          <EntrySection number="5" title="ประเภทผู้ป่วย" description="กรอกแยกตามประเภท 5 ถึง 1" className="entry-types"><div className="entry-data-rows" style={{ "--entry-columns": types.length }}>{types.map(type => <EntryFieldRow single key={type} label={`ประเภท ${type}`}>{input(`patient_type${type}`, `ประเภท ${type}`)}</EntryFieldRow>)}</div></EntrySection>
          <EntrySection number="6" title="จำนวนเตียง" className="entry-beds"><EntryFieldRow single label="จำนวนเตียง">{input("amount_bed", "จำนวนเตียง", 1)}</EntryFieldRow></EntrySection>
          <EntrySection number="7" title="เจ้าหน้าที่ปฏิบัติงาน" className="entry-staff"><div className="entry-data-rows" style={{ "--entry-columns": staff.length }}>{staff.map(code => <EntryFieldRow single key={code} label={code}>{input(`em_${code.toLowerCase()}`, code)}</EntryFieldRow>)}</div></EntrySection>
        </div>
        {afternoon && <>
          <EntrySection number="8" title="การให้บริการผู้ป่วยในแต่ละสาขา" description="แยกห้องสามัญและห้องพิเศษตามรหัสสาขาในแบบรายงาน" className="entry-specialties" summary="เฉพาะเวรบ่าย"><p className="entry-patient-days">วันนอนผู้ป่วย {groups.map(group => <strong key={group}>{group.toUpperCase()} {formatThaiNumber(patientDays(values, group))}</strong>)}</p><div className="entry-specialty-rows">{specialties.map(code => <EntryFieldRow key={code} label={code.toUpperCase().replace("_", " ")} captions={["สามัญ", "พิเศษ"]}>{[["n", "สามัญ"], ["s", "พิเศษ"]].map(([category, label]) => input(`${code}:${category}`, `${code.toUpperCase()} ห้อง${label}`))}</EntryFieldRow>)}</div></EntrySection>
          <EntrySection number="9" title="แผลกดทับประจำวัน" summary="เฉพาะเวรบ่าย" className="entry-pressure"><div className="entry-two-fields"><label className="ui-field"><span>จำนวนครั้งระดับ 2–4</span>{input("stage2_4_cases", "จำนวนครั้งแผลกดทับ")}</label><label className="ui-field"><span>วันนอนรวมของผู้ป่วยเสี่ยง</span>{input("at_risk_patient_days", "วันนอนผู้ป่วยเสี่ยง")}</label></div></EntrySection>
        </>}
        <EntrySection collapsible number={afternoon ? "10" : "8"} title="ข้อมูลรายเดือน (ใช้ร่วมกันทั้งเดือน)" summary={`${formatThaiMonth(selection.service_date)} · ${editing.changed.some(key => ["readmit_count", "discharge_count"].includes(key)) ? "มีการแก้ไขรายเดือน" : context.readmission ? "มีข้อมูลเดือนนี้แล้ว" : "ยังไม่มีข้อมูลเดือนนี้"}`} className="entry-monthly"><InfoCallout title="ลงข้อมูลเดือนละครั้ง">ข้อมูลส่วนนี้ใช้ร่วมกันทั้งเดือนของหอผู้ป่วย การแก้ไขมีผลต่อข้อมูลรายเดือนเดียวกัน</InfoCallout><div className="entry-two-fields"><label className="ui-field"><span>{monthlyLabels.readmit_count}</span>{input("readmit_count", monthlyLabels.readmit_count, 0, false)}</label><label className="ui-field"><span>{monthlyLabels.discharge_count}</span>{input("discharge_count", monthlyLabels.discharge_count, 0, false)}</label></div><a className="ui-button ui-button--ghost" href={relatedHref}>เปิดข้อมูลเดือนเดียวกันในหน้าตัวชี้วัดเสริม</a></EntrySection>
      </div></fieldset>
      {!readonly && <StickyActionBar className="entry-actions" summary={<EntrySaveSummary {...{ review, editing }} />}><Button type="submit" icon="save" disabled={busy} loading={busy}>{entry ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</Button>{entry && <Button className="entry-confirm-button" variant="secondary" icon="check" onClick={confirmEntry} disabled={busy || dirty}>ยืนยันการส่งข้อมูล</Button>}</StickyActionBar>}
    </form>}
    <ConfirmDialog open={Boolean(editing.pending)} onClose={editing.cancelPending} onConfirm={editing.continuePending} title="มีข้อมูลที่ยังไม่บันทึก" description={editing.storageError ? "ยังเก็บค่าค้างในเครื่องไม่สำเร็จ หากออกข้อมูลที่กรอกอาจสูญหาย ต้องการดำเนินการต่อหรือไม่?" : "เก็บค่าค้างในเครื่องไว้ให้แล้ว ต้องการดำเนินการต่อหรือไม่?"} confirmLabel="ดำเนินการต่อ" />
    <div className="entry-toast"><Toast open={Boolean(notice)} title={notice} onClose={() => setNotice("")} /></div>
  </EntryLayout></AppShell>;
}
