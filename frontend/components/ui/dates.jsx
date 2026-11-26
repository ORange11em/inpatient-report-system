"use client";

import { useEffect, useRef, useState } from "react";
import { addDaysISO, dateRangePreset, fiscalYearForDate, formatFiscalYear, formatThaiDate, formatThaiMonth, monthStartISO, parseISODate, parseThaiDate, thaiDateInput, todayISO, toISODate } from "@/lib/thai-date.mjs";
import { Button, FormField, Select } from "./primitives";
import { Dialog } from "./overlays";
import { Icon } from "./Icon";

function shiftedMonth(value, delta) {
  const date = parseISODate(monthStartISO(value));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return toISODate(date);
}

export function ThaiDatePicker({ label = "วันที่", value = "", onChange, hint = "พิมพ์ วัน/เดือน/ปี พ.ศ. หรือ ค.ศ.", error, required, id, disabled, readOnly, min, max, resetToken = 0 }) {
  const [draft, setDraft] = useState(thaiDateInput(value));
  const [problem, setProblem] = useState("");
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthStartISO(value || todayISO()));
  const input = useRef(null);
  const grid = useRef(null);
  useEffect(() => { setDraft(thaiDateInput(value)); setProblem(""); input.current?.setCustomValidity(""); }, [value, resetToken]);
  function validate(text) {
    const iso = text.trim() ? parseThaiDate(text) : "";
    const message = iso === null ? "วันที่ไม่ถูกต้อง กรุณากรอกวัน/เดือน/ปีให้ครบ" : iso && ((min && iso < min) || (max && iso > max)) ? "วันที่อยู่นอกช่วงที่เลือกได้" : "";
    input.current?.setCustomValidity(message);
    return { iso, message };
  }
  function commit(iso) {
    setProblem(""); input.current?.setCustomValidity(""); setDraft(thaiDateInput(iso));
    onChange?.(iso); setOpen(false);
  }
  const enabled = iso => (!min || iso >= min) && (!max || iso <= max);
  const first = parseISODate(month);
  const days = new Date(first.getUTCFullYear(), first.getUTCMonth() + 1, 0).getDate();
  const focusDay = value.startsWith(month.slice(0, 7)) ? value : month;
  function navigate(event, iso) {
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next;
    if (Object.hasOwn(steps, event.key)) next = addDaysISO(iso, steps[event.key]);
    else if (event.key === "Home") next = addDaysISO(iso, -parseISODate(iso).getUTCDay());
    else if (event.key === "End") next = addDaysISO(iso, 6 - parseISODate(iso).getUTCDay());
    else if (["PageUp", "PageDown"].includes(event.key)) next = shiftedMonth(iso, event.key === "PageUp" ? -1 : 1);
    if (!next) return;
    event.preventDefault();
    if (!enabled(next)) return;
    setMonth(monthStartISO(next));
    requestAnimationFrame(() => grid.current?.querySelector(`[data-date="${next}"]`)?.focus());
  }
  return <div className="ui-date-picker"><FormField {...{ id, label, required, hint }} error={error || problem}>
    {field => <div className="ui-input-action"><input ref={input} className="ui-input ui-numeric" {...field} value={draft} disabled={disabled} readOnly={readOnly} placeholder="วว/ดด/ปปปป" autoComplete="off" inputMode="text"
      onChange={event => { setDraft(event.target.value); validate(event.target.value); setProblem(""); if (!event.target.value) onChange?.(""); }}
      onBlur={() => { if (disabled || readOnly) return; const result = validate(draft); setProblem(result.message); if (!result.message && result.iso !== value) commit(result.iso); else if (!result.message) setDraft(thaiDateInput(result.iso)); }} />
      <Button variant="ghost" icon="calendar" aria-label={`เลือก${label}จากปฏิทิน`} disabled={disabled || readOnly} onClick={() => { setMonth(monthStartISO(value || todayISO())); setOpen(true); }} /></div>}
  </FormField>
    <div className="ui-quick-actions"><Button variant="ghost" disabled={disabled || readOnly || !enabled(todayISO())} onClick={() => commit(todayISO())}>วันนี้</Button><Button variant="ghost" disabled={disabled || readOnly || !enabled(addDaysISO(todayISO(), -1))} onClick={() => commit(addDaysISO(todayISO(), -1))}>เมื่อวาน</Button></div>
    <Dialog variant="calendar" open={open} onClose={() => setOpen(false)} title={`เลือก${label}`}>
      <div className="ui-calendar-heading"><Button variant="ghost" icon="arrow" className="ui-arrow-back" aria-label="เดือนก่อนหน้า" onClick={() => setMonth(shiftedMonth(month, -1))} /><strong aria-live="polite">{formatThaiMonth(month)}</strong><Button variant="ghost" icon="arrow" aria-label="เดือนถัดไป" onClick={() => setMonth(shiftedMonth(month, 1))} /></div>
      <div ref={grid} className="ui-calendar-grid" role="group" aria-label={formatThaiMonth(month)}>
        {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(day => <span key={day} className="ui-calendar-weekday" aria-hidden="true">{day}</span>)}
        {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => { const iso = `${month.slice(0, 8)}${String(index + 1).padStart(2, "0")}`; return <button type="button" key={iso} className="ui-calendar-day" data-date={iso} aria-pressed={value === iso} aria-label={thaiDateInput(iso)} aria-current={iso === todayISO() ? "date" : undefined}
          tabIndex={focusDay === iso ? 0 : -1} disabled={!enabled(iso)} onKeyDown={event => navigate(event, iso)} onClick={() => commit(iso)}>{index + 1}</button>; })}
      </div><p className="ui-field-hint">ใช้ปุ่มลูกศรเลื่อนวัน และ Enter เพื่อเลือก</p>
    </Dialog>
  </div>;
}

export function ThaiMonthPicker({ label = "เดือน", value = "", onChange, disabled, readOnly, error, hint, required }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number((value || todayISO()).slice(0, 4)));
  return <><FormField {...{ label, required, hint, error }}>{field => <div className="ui-input-action"><input className="ui-input" {...field} value={value ? formatThaiMonth(value) : ""} placeholder="เลือกเดือน" readOnly disabled={disabled} />
    <Button variant="ghost" icon="calendar" aria-label={`เลือก${label}`} disabled={disabled || readOnly} onClick={() => { setYear(Number((value || todayISO()).slice(0, 4))); setOpen(true); }} /></div>}</FormField>
    <Dialog open={open} onClose={() => setOpen(false)} title={`เลือก${label}`}>
      <div className="ui-calendar-heading"><Button variant="ghost" icon="arrow" className="ui-arrow-back" aria-label="ปีก่อนหน้า" onClick={() => setYear(year - 1)} /><strong aria-live="polite">พ.ศ. {year + 543}</strong><Button variant="ghost" icon="arrow" aria-label="ปีถัดไป" onClick={() => setYear(year + 1)} /></div>
      <div className="ui-month-grid">{Array.from({ length: 12 }, (_, index) => { const month = `${year}-${String(index + 1).padStart(2, "0")}`; return <button type="button" className="ui-button ui-button--secondary" aria-pressed={month === value} key={month} onClick={() => { onChange?.(month); setOpen(false); }}>{new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" }).format(parseISODate(`${month}-01`))}</button>; })}</div>
    </Dialog></>;
}

export function DateRangePicker({ label = "ช่วงวันที่", value = { from: "", to: "" }, onChange, disabled, readOnly, error, anchor, compact = false }) {
  const [open, setOpen] = useState(false);
  const content = useRef(null);
  const rangeError = error || (value.from && value.to && value.from > value.to ? "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น" : undefined);
  const summary = !value.from && !value.to ? "ทุกช่วงวัน" : `${value.from ? formatThaiDate(value.from) : "ไม่จำกัด"} – ${value.to ? formatThaiDate(value.to) : "ไม่จำกัด"}`;
  const picker = <fieldset className="ui-range" disabled={disabled || compact && !open}><legend>{label}</legend><div className="ui-range-fields">
    <ThaiDatePicker label="ตั้งแต่วันที่" value={value.from} onChange={from => onChange?.({ ...value, from })} disabled={disabled} readOnly={readOnly} />
    <ThaiDatePicker label="ถึงวันที่" value={value.to} onChange={to => onChange?.({ ...value, to })} disabled={disabled} readOnly={readOnly} error={rangeError} />
  </div><div className="ui-quick-actions">{[["last7", "7 วันล่าสุด"], ["month", "เดือนนี้"], ["previousMonth", "เดือนก่อน"]].map(([key, text]) => <Button key={key} variant="secondary" disabled={disabled || readOnly} onClick={() => onChange?.(dateRangePreset(key, anchor))}>{text}</Button>)}</div></fieldset>;
  if (!compact) return picker;
  function finish() {
    const invalid = [...content.current.querySelectorAll("input")].find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    setOpen(false);
  }
  return <><FormField label={label} error={rangeError}>{field => <Button {...field} variant="secondary" className="ui-range-summary" disabled={disabled || readOnly} aria-label={`เลือก${label}: ${summary}`} aria-haspopup="dialog" onClick={() => setOpen(true)}><span>{summary}</span><Icon name="calendar" /></Button>}</FormField><Dialog open={open} onClose={() => setOpen(false)} title={`เลือก${label}`} actions={<Button disabled={Boolean(rangeError)} onClick={finish}>เสร็จสิ้น</Button>}><div ref={content} onKeyDown={event => { if (event.key === "Enter" && event.target.tagName === "INPUT") { event.preventDefault(); event.target.blur(); } }}>{picker}</div></Dialog></>;
}

export function FiscalYearSelect({ value, onChange, label = "ปีงบประมาณ", years, ...props }) {
  const current = fiscalYearForDate(todayISO());
  const available = years || Array.from({ length: 11 }, (_, index) => current + 2 - index);
  const all = [...new Set([...available, ...(Number.isInteger(value) ? [value] : [])])].sort((a, b) => b - a);
  return <Select {...props} label={label} value={value ?? ""} options={all.map(year => ({ value: year, label: formatFiscalYear(year) }))} onChange={event => onChange?.(Number(event.target.value))} />;
}
