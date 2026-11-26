"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button, Card, Icon } from "@/components/ui";
import { formatThaiNumber } from "@/lib/thai-date.mjs";

const EntryLayoutContext = createContext({ mode: "wide", focusMode: false, setFocusMode: () => {} });

export function EntryLayout({ children }) {
  const ref = useRef(null);
  const [mode, setMode] = useState("wide");
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([item]) => setMode(item.contentRect.width < 600 ? "compact" : item.contentRect.width < 1000 ? "medium" : "wide"));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (mode !== "compact") setFocusMode(false); }, [mode]);
  return <EntryLayoutContext.Provider value={{ mode, focusMode, setFocusMode }}><div ref={ref} className="entry-page" data-layout={mode} data-focus-mode={focusMode}>{children}</div></EntryLayoutContext.Provider>;
}

export function EntryFocusControls() {
  const { focusMode, setFocusMode } = useContext(EntryLayoutContext);
  return <Button className="entry-focus-toggle" variant="secondary" icon={focusMode ? "arrow" : "edit"} aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)}>{focusMode ? "กลับสู่เมนูหลัก" : "โหมดกรอกเต็มจอ"}</Button>;
}

export function EntrySection({ title, number, description, summary, children, className = "", first = false, collapsible = false }) {
  const { mode } = useContext(EntryLayoutContext);
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(collapsible ? false : mode !== "compact" || first); }, [mode, first, collapsible]);
  return <Card as="details" className={`entry-section ${collapsible ? "entry-section--collapsible" : ""} ${className}`} open={open} onToggle={event => setOpen(mode !== "compact" && !collapsible || event.currentTarget.open)}>
    <summary tabIndex={mode === "compact" || collapsible ? 0 : -1} onClick={event => { if (mode !== "compact" && !collapsible) event.preventDefault(); }}><span className="entry-section-number" aria-hidden="true">{number}</span><span className="entry-section-heading"><h2>{title}</h2>{summary && <span className="entry-section-summary">{summary}</span>}</span><Icon name="chevron" /></summary>
    <div className="entry-section-body">{description && <p className="ui-field-hint entry-section-description">{description}</p>}{children}</div>
  </Card>;
}

export function EntryFieldRow({ label, children, single = false, captions = ["PT", "NB"] }) {
  const inputs = Array.isArray(children) ? children : [children];
  return <div className={`entry-field-row ${single ? "entry-field-row--single" : ""}`}><span className="entry-row-label">{label}</span><div className="entry-row-inputs">{inputs.map((input, index) => <label key={index}><span className="entry-input-caption">{single ? "จำนวน" : captions[index]}</span>{input}</label>)}</div></div>;
}

export function EntryFlowSummary({ values, codes }) {
  return <>{["pt", "nb"].map(group => <span key={group}>{group.toUpperCase()} {codes.some(code => values[`${group}_${code}`] === "") ? "—" : formatThaiNumber(codes.reduce((sum, code) => sum + Number(values[`${group}_${code}`] || 0), 0))}</span>)}</>;
}

export function revealInvalidField(event) {
  // Disclosure only: retain the browser's existing required/min/max/step validation.
  const section = event.target.closest("details");
  if (section) section.open = true;
}
