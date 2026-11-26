"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet, Button, Card, Select, ShiftSelector, ThaiDatePicker } from "@/components/ui";
import { useMobile } from "@/components/ui/primitives";
import { formatThaiDate } from "@/lib/thai-date.mjs";

export function EntryContextBar({ wards, shifts, selection, select, open, busy, satisfactionHref, hasContext, resetToken = 0, requestToken = 0 }) {
  const mobile = useMobile();
  const [sheet, setSheet] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const expandedRef = useRef(null);
  const lastRequest = useRef(requestToken);
  const ward = wards.find(item => item.id === selection.ward_id);
  const shift = shifts.find(item => String(item.id) === selection.shift_type_id);
  const showCollapsed = !mobile && hasContext && condensed;

  function scrollToExpanded() {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const control = expandedRef.current?.querySelector(".entry-context-expanded select:not(:disabled), .entry-context-expanded input:not(:disabled), .entry-context-expanded button:not(:disabled)");
    control?.focus({ preventScroll: true });
    expandedRef.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  useEffect(() => {
    const target = expandedRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([item]) => {
        if (!item) return;
        setCondensed(!item.isIntersecting && item.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!mobile) setSheet(false); }, [mobile]);
  useEffect(() => { if (lastRequest.current !== requestToken) { lastRequest.current = requestToken; if (mobile) setSheet(true); else scrollToExpanded(); } }, [requestToken, mobile]);
  const form = <form onSubmit={event => { open(event); setSheet(false); }} className="entry-context-form"><fieldset className="plain-fields" disabled={busy}><div className="entry-context-fields">
    <Select required label="หอผู้ป่วย" value={selection.ward_id} placeholder="เลือกหอผู้ป่วย" options={wards.map(item => ({ value: item.id, label: `${item.name} (${item.code})` }))} onChange={event => select("ward_id", event.target.value)} />
    <ThaiDatePicker resetToken={resetToken} required label="วันที่" hint="" value={selection.service_date} onChange={value => select("service_date", value)} disabled={busy} />
    <ShiftSelector required label="เวร" value={selection.shift_type_id} onChange={value => select("shift_type_id", String(value))} disabled={busy} options={shifts.filter(item => item.is_active || String(item.id) === selection.shift_type_id).map(item => ({ value: item.id, label: item.display_name }))} />
  </div><div className="entry-context-actions"><Button type="submit" icon="edit" loading={busy}>เปิดแบบฟอร์ม</Button><p className="ui-field-hint">เลือกหอผู้ป่วย วันที่ และเวรก่อนเปิดแบบฟอร์ม</p>{satisfactionHref && <a className="ui-button ui-button--ghost" href={satisfactionHref} target="_blank" rel="noreferrer">อัตราความพึงพอใจ</a>}</div></fieldset></form>;
  const renderCompact = (interactive = true) => <div className="entry-context-compact"><div><strong>{ward?.name || "เลือกหอผู้ป่วย"} · {shift ? `เวร${shift.display_name}` : "เลือกเวร"}</strong><p>{selection.service_date ? formatThaiDate(selection.service_date) : "เลือกวันที่"}</p></div><Button variant="secondary" icon="calendar" disabled={busy} tabIndex={interactive ? undefined : -1} onClick={() => mobile ? setSheet(true) : scrollToExpanded()}>{hasContext ? "เปลี่ยน" : "เลือกและเปิด"}</Button></div>;
  return <>
    <div ref={expandedRef} className="entry-context-bar"><Card className="entry-context-card">{mobile ? renderCompact(true) : <div className="entry-context-expanded">{form}</div>}</Card></div>
    {!mobile && <div className="entry-context-sticky-track" aria-hidden={!showCollapsed || undefined}><div className={`entry-context-collapsed ${showCollapsed ? "is-visible" : ""}`}><Card className="entry-context-card">{renderCompact(showCollapsed)}</Card></div></div>}
    <BottomSheet open={mobile && sheet} onClose={() => setSheet(false)} title="เลือกหอผู้ป่วย วันที่ และเวร">{mobile && form}</BottomSheet>
  </>;
}
