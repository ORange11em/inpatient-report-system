"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { preferredWard } from "@/lib/workspace.mjs";
import { flowFields, types, staff, specialties, countFields, groups, patientDays } from "@/lib/census";
import { Button, Card, ConfirmDialog, EmptyState, InfoCallout, Legend, PageHeader, Skeleton, StatusBadge, StickyActionBar, Toast } from "@/components/ui";
import { EntryContextBar } from "@/components/entries/EntryContextBar";
import { EntryFieldRow, EntryFlowSummary, EntryFocusControls, EntryLayout, EntrySection, revealInvalidField } from "@/components/entries/EntryLayout";
import { formatThaiDate, formatThaiMonth, formatThaiNumber, formatThaiTime, todayISO } from "@/lib/thai-date.mjs";
import { entryReview } from "@/lib/entry-workspace.mjs";
import { monthlyFieldLabels } from "@/lib/indicator-view.mjs";
import { useEntryEditing } from "@/components/entries/useEntryEditing";
import { EntryDraftNotice, EntryReview, EntrySavedBanner, EntrySaveSummary } from "@/components/entries/EntryReview";
import { EntryActivity } from "@/components/entries/EntryActivity";
import { satisfactionLink } from "@/lib/satisfaction.mjs";
import "@/styles/entries.css";

const MAX_ENTRY_COUNT = 2147483647;

function normalizeDigits(raw) {
  return String(raw ?? "").replace(/[๐-๙]/g, digit => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)));
}

function entryValidityMessage(value, min) {
  const text = String(value ?? "");
  if (text === "") return "";
  if (!/^\d+$/.test(text)) return "กรอกเฉพาะตัวเลขจำนวนเต็มเท่านั้น";
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > MAX_ENTRY_COUNT) {
    return `กรอกจำนวนเต็มตั้งแต่ ${min} ถึง ${MAX_ENTRY_COUNT}`;
  }
  return "";
}

function EntryNumberInput({ name, label, value, min = 0, required = true, placeholder, fieldProps, onValueChange }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.setCustomValidity(entryValidityMessage(value, min));
  }, [value, min]);
  return (
    <input
      ref={ref}
      {...fieldProps}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      data-entry-number="true"
      name={name}
      aria-label={label}
      required={required}
      placeholder={placeholder}
      value={value ?? ""}
      onBeforeInput={event => {
        if (event.data && !/^[0-9๐-๙]+$/.test(event.data)) event.preventDefault();
      }}
      onChange={event => {
        const next = normalizeDigits(event.target.value);
        if (!/^\d*$/.test(next)) {
          event.currentTarget.setCustomValidity(entryValidityMessage(value, min));
          return;
        }
        event.currentTarget.setCustomValidity(entryValidityMessage(next, min));
        onValueChange(next);
      }}
    />
  );
}

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
  const [confirmKind, setConfirmKind] = useState(null);
  const [contextRequest, setContextRequest] = useState(0);
  const [shiftStatusData, setShiftStatusData] = useState(null);
  const [shiftStatusRefresh, setShiftStatusRefresh] = useState(0);
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

  useEffect(() => {
    const reloadStatuses = () => setShiftStatusRefresh(value => value + 1);
    window.addEventListener("inpatient-entries-changed", reloadStatuses);
    return () => window.removeEventListener("inpatient-entries-changed", reloadStatuses);
  }, []);

  useEffect(() => {
    const wardId = selection.ward_id;
    const serviceDate = selection.service_date;
    if (!wardId || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      setShiftStatusData(null);
      return;
    }
    let active = true;
    setShiftStatusData(old => (old?.wardId === wardId && old?.serviceDate === serviceDate ? old : null));
    apiRequest("/reports/daily?" + new URLSearchParams({ service_date: serviceDate, ward_id: wardId }))
      .then(data => {
        if (!active || !Array.isArray(data?.entries)) return;
        const byShift = {};
        for (const row of data.entries) {
          if (row.ward_id === wardId) {
            byShift[String(row.shift_type_id)] = row.status === "confirmed" ? "confirmed" : "unconfirmed";
          }
        }
        setShiftStatusData({ wardId, serviceDate, byShift });
      })
      .catch(() => {
        if (active) setShiftStatusData(null);
      });
    return () => { active = false; };
  }, [selection.ward_id, selection.service_date, shiftStatusRefresh]);

  const shiftStatuses = shiftStatusData?.wardId === selection.ward_id && shiftStatusData?.serviceDate === selection.service_date ? shiftStatusData.byShift : null;

  function select(key, value) {
    setSelection(s => ({ ...s, [key]: value }));
    setContext(null);
    setConfirmKind(null);
    setError("");
    setNotice("");
  }

  async function open(event) {
    event.preventDefault();
    setBusy(true);
    setConfirmKind(null);
    setNotice("");
    setError("");
    setContext(null);
    try {
      show(await apiRequest("/entry-form?" + new URLSearchParams(selection)));
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  function input(key, label, min = 0, required = true, placeholder = undefined) {
    return (
      <EntryNumberInput
        name={key}
        label={label}
        min={min}
        required={required}
        placeholder={placeholder}
        value={values[key] ?? ""}
        fieldProps={editing.fieldProps(key)}
        onValueChange={next => { setValues({ ...values, [key]: next }); setDirty(true); editing.fieldChanged(key); }}
      />
    );
  }

  function save(event) {
    event.preventDefault();
    if (busy || readonly) return;
    setError("");
    setNotice("");
    const hasReadmit = values.readmit_count !== "";
    if (hasReadmit !== (values.discharge_count !== "") || (!hasReadmit && context.readmission)) {
      setError("กรุณากรอกจำนวนผู้ป่วยทั้งสองช่องในส่วนการกลับมารักษาซ้ำ ระบุ 0 ได้เมื่อไม่มีผู้ป่วย");
      return;
    }
    setConfirmKind("save");
  }

  async function performSave() {
    if (busy || readonly) return;
    const hasReadmit = values.readmit_count !== "";
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
      setConfirmKind(null);
      show({ ...context, entry: result, pressure: body.pressure ?? context.pressure, readmission: body.readmission ?? context.readmission });
      editing.saved();
      window.dispatchEvent(new Event("inpatient-entries-changed"));
      setNotice("บันทึกข้อมูลเวร" + shift.display_name + " แล้ว");
    } catch (e) { setConfirmKind(null); setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  function confirmEntry() {
    if (dirty || busy || !entry) return;
    setError("");
    setNotice("");
    setConfirmKind("confirm");
  }

  async function performConfirmEntry() {
    if (dirty || busy || !entry) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest("/entries/" + entry.id + "/confirm", { method: "POST", csrfToken, body: { expected_version: entry.version } });
      setConfirmKind(null);
      show({ ...context, entry: result });
      window.dispatchEvent(new Event("inpatient-entries-changed"));
      setNotice("ยืนยันการส่งข้อมูลแล้ว");
    } catch (e) { setConfirmKind(null); setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return <AppShell><EntryLayout>
    <PageHeader title="บันทึกข้อมูลประจำวัน" description={context ? undefined : "เลือกบริบท แล้วกรอกข้อมูลแยกตามกลุ่มในแบบรายงาน"} />
    <EntryContextBar {...{ wards, shifts, selection, busy, satisfactionHref, shiftStatuses }} select={editing.changeSelection} open={editing.openForm} resetToken={editing.resetToken} requestToken={contextRequest} hasContext={Boolean(context)} />
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
      <EntrySavedBanner lastSavedAt={editing.lastSavedAt} isDirty={editing.isDirty} nextEntryHref={nextEntryHref} onSelectNext={() => setContextRequest(value => value + 1)} />
      <details className="entry-legend"><summary>คำอธิบายช่องข้อมูล</summary><Legend items={[{ label: "PT / NB", description: "แยกช่องตามกลุ่มข้อมูล" }, { label: "ประเภทผู้ป่วย", description: "เรียง 5 → 1" }, { label: "เจ้าหน้าที่", description: staff.join(" · ") }]} /></details>
      <fieldset className="plain-fields entry-fields" disabled={readonly || busy}><div className="entry-sections">
        <div className="entry-flow-sections">{[[["on"], "ยอดผู้ป่วยยกมา"], [["in", "move"], "การรับ"], [["home", "move_b", "send", "dead", "non_voluntary"], "การจำหน่าย"]].map(([codes, title], index) => <EntrySection first={index === 0} number={index + 1} key={title} title={title} summary={<EntryFlowSummary {...{ values, codes }} />} className={`entry-flow-section entry-flow-section--${index}`}>
          <div className="entry-data-rows" style={{ "--entry-columns": codes.length }}>{flowFields.filter(([key]) => codes.includes(key)).map(([key,, label]) => <EntryFieldRow key={key} label={key === "on" ? "ยกมา" : label}>{groups.map(group => input(`${group}_${key}`, `${key === "on" ? "ยกมา" : label} ${group.toUpperCase()}`))}</EntryFieldRow>)}</div>
        </EntrySection>)}</div>
        <div className="entry-core-sections">
          <EntrySection number="4" title="รับและจำหน่ายในวันเดียวกัน (A&D)" summary={<EntryFlowSummary values={values} codes={["ad"]} />} className="entry-ad"><EntryFieldRow label="จำนวนผู้ป่วย">{groups.map(group => input(`${group}_ad`, `A&D ${group.toUpperCase()}`))}</EntryFieldRow></EntrySection>
          <EntrySection number="5" title="ประเภทผู้ป่วย" description="กรอกแยกตามประเภท 5 ถึง 1" className="entry-types"><div className="entry-data-rows" style={{ "--entry-columns": types.length }}>{types.map(type => { const typeLabel = type === 5 ? "ประเภท 5 (วิกฤต)" : `ประเภท ${type}`; return <EntryFieldRow single key={type} label={typeLabel}>{input(`patient_type${type}`, typeLabel)}</EntryFieldRow>; })}</div></EntrySection>
          <EntrySection number="6" title="จำนวนเตียง" className="entry-beds"><EntryFieldRow single label="จำนวนเตียง">{input("amount_bed", "จำนวนเตียง", 1, true, "ระบุจำนวน")}</EntryFieldRow></EntrySection>
          <EntrySection number="7" title="เจ้าหน้าที่ปฏิบัติงาน" className="entry-staff"><div className="entry-data-rows" style={{ "--entry-columns": staff.length }}>{staff.map(code => <EntryFieldRow single key={code} label={code}>{input(`em_${code.toLowerCase()}`, code)}</EntryFieldRow>)}</div></EntrySection>
        </div>
        {afternoon && <>
          <EntrySection number="8" title="การให้บริการผู้ป่วยในแต่ละสาขา" description="แยกห้องสามัญและห้องพิเศษตามรหัสสาขาในแบบรายงาน" className="entry-specialties" summary="เฉพาะเวรบ่าย"><p className="entry-patient-days">วันนอนผู้ป่วย {groups.map(group => <strong key={group}>{group.toUpperCase()} {formatThaiNumber(patientDays(values, group))}</strong>)}</p><div className="entry-specialty-rows">{specialties.map(code => <EntryFieldRow key={code} label={code.toUpperCase().replace("_", " ")} captions={["สามัญ", "พิเศษ"]}>{[["n", "สามัญ"], ["s", "พิเศษ"]].map(([category, label]) => input(`${code}:${category}`, `${code.toUpperCase()} ห้อง${label}`))}</EntryFieldRow>)}</div></EntrySection>
          <EntrySection number="9" title="แผลกดทับประจำวัน" summary="เฉพาะเวรบ่าย" className="entry-pressure"><div className="entry-two-fields"><label className="ui-field"><span>จำนวนครั้งระดับ 2–4</span>{input("stage2_4_cases", "จำนวนครั้งแผลกดทับ")}</label><label className="ui-field"><span>วันนอนรวมของผู้ป่วยเสี่ยง</span>{input("at_risk_patient_days", "วันนอนผู้ป่วยเสี่ยง")}</label></div></EntrySection>
        </>}
        <EntrySection collapsible number={afternoon ? "10" : "8"} title="ข้อมูลรายเดือน (ใช้ร่วมกันทั้งเดือน)" summary={`${formatThaiMonth(selection.service_date)} · ${editing.changed.some(key => ["readmit_count", "discharge_count"].includes(key)) ? "มีการแก้ไขรายเดือน" : context.readmission ? "มีข้อมูลเดือนนี้แล้ว" : "ยังไม่มีข้อมูลเดือนนี้"}`} className="entry-monthly"><InfoCallout title="ลงข้อมูลเดือนละครั้ง">ข้อมูลส่วนนี้ใช้ร่วมกันทั้งเดือนของหอผู้ป่วย การแก้ไขมีผลต่อข้อมูลรายเดือนเดียวกัน</InfoCallout><div className="entry-two-fields"><label className="ui-field"><span>{monthlyLabels.readmit_count}</span>{input("readmit_count", monthlyLabels.readmit_count, 0, false, "เว้นว่างได้หากยังไม่บันทึก")}</label><label className="ui-field"><span>{monthlyLabels.discharge_count}</span>{input("discharge_count", monthlyLabels.discharge_count, 0, false, "เว้นว่างได้หากยังไม่บันทึก")}</label></div><a className="ui-button ui-button--ghost" href={relatedHref}>เปิดข้อมูลเดือนเดียวกันในหน้าตัวชี้วัดเสริม</a></EntrySection>
      </div></fieldset>
      {!readonly && <StickyActionBar className="entry-actions" summary={<EntrySaveSummary {...{ review, editing }} />}><Button type="submit" icon="save" disabled={busy} loading={busy}>{entry ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</Button>{entry && <Button className="entry-confirm-button" variant="secondary" icon="check" onClick={confirmEntry} disabled={busy || dirty} aria-describedby={dirty ? "entry-confirm-disabled-reason" : undefined}>ยืนยันการส่งข้อมูล</Button>}{entry && dirty && <p id="entry-confirm-disabled-reason" className="ui-field-hint entry-confirm-hint">บันทึกการแก้ไขก่อน จึงจะยืนยันการส่งข้อมูลได้</p>}</StickyActionBar>}
    </form>}
    <ConfirmDialog open={confirmKind === "save"} onClose={() => { if (!busy) setConfirmKind(null); }} onConfirm={performSave} title="ยืนยันการบันทึกข้อมูล" description={`${ward?.name || "หอผู้ป่วยที่เลือก"} · เวร${shift?.display_name || ""} · ${formatThaiDate(selection.service_date, { month: "long" })}`} confirmLabel={entry ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"} loading={busy}>
      {review.warnings.length > 0 && <InfoCallout tone="warning">พบข้อควรตรวจสอบ {formatThaiNumber(review.warnings.length)} จุด (ยังสามารถบันทึกได้)</InfoCallout>}
    </ConfirmDialog>
    <ConfirmDialog open={confirmKind === "confirm"} onClose={() => { if (!busy) setConfirmKind(null); }} onConfirm={performConfirmEntry} title="ยืนยันการส่งข้อมูล" description={`${ward?.name || "หอผู้ป่วยที่เลือก"} · เวร${shift?.display_name || ""} · ${formatThaiDate(selection.service_date, { month: "long" })} — เมื่อยืนยันแล้วจะไม่สามารถแก้ไขได้จนกว่าผู้ดูแลระบบจะส่งกลับ`} confirmLabel="ยืนยันและล็อกข้อมูล" loading={busy} />
    <ConfirmDialog open={Boolean(editing.pending)} onClose={editing.cancelPending} onConfirm={editing.continuePending} title="มีข้อมูลที่ยังไม่บันทึก" description={editing.storageError ? "ยังเก็บค่าค้างในเครื่องไม่สำเร็จ หากออกข้อมูลที่กรอกอาจสูญหาย ต้องการดำเนินการต่อหรือไม่?" : "เก็บค่าค้างในเครื่องไว้ให้แล้ว ต้องการดำเนินการต่อหรือไม่?"} confirmLabel="ดำเนินการต่อ" />
    <div className="entry-toast"><Toast open={Boolean(notice)} title={notice} onClose={() => setNotice("")} /></div>
  </EntryLayout></AppShell>;
}
