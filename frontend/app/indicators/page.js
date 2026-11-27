"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, Select, Skeleton, Toast } from "@/components/ui";
import { PressureIndicatorCard, ReadmissionIndicatorCard } from "@/components/indicators/IndicatorCards";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { preferredWard } from "@/lib/workspace.mjs";
import { indicatorChanged, pressureDisabledReason } from "@/lib/indicator-view.mjs";
import { parseISODate, todayISO } from "@/lib/thai-date.mjs";
import "@/styles/indicators.css";

const initialState = { key: "", phase: "idle", found: false, error: "", saveError: "", notice: "", baseline: null };
const message = (problem, fallback) => getErrorMessage(problem, fallback).replace(/\bward\b/gi, "หอผู้ป่วย");

export default function IndicatorsPage() {
  const { csrfToken } = useAuth();
  const [wards, setWards] = useState([]);
  const [wardId, setWardId] = useState("");
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [reportMonth, setReportMonth] = useState(() => todayISO().slice(0, 7));
  const [catalog, setCatalog] = useState({ loading: true, error: "" });
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [shiftCatalog, setShiftCatalog] = useState({ loading: true, error: "", afternoon: null });
  const [shiftRetry, setShiftRetry] = useState(0);
  const [pressure, setPressure] = useState({ stage2_4_cases: 0, at_risk_patient_days: 0 });
  const [readmission, setReadmission] = useState({ readmit_count: 0, discharge_count: 0 });
  const [daily, setDaily] = useState(initialState);
  const [monthly, setMonthly] = useState(initialState);
  const [dailyRetry, setDailyRetry] = useState(0);
  const [monthlyRetry, setMonthlyRetry] = useState(0);
  const [pending, setPending] = useState("");
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState("daily");
  const writeLock = useRef(false);
  const [confirmation, setConfirmation] = useState(null);
  const confirmAction = useRef(null);
  const [resetToken, setResetToken] = useState(0);
  const leaveAllowed = useRef(false);
  const latest = useRef(null);
  const dailyKey = wardId && serviceDate ? wardId + "|" + serviceDate : "";
  const monthlyKey = wardId && reportMonth ? wardId + "|" + reportMonth : "";
  const dailyReady = Boolean(dailyKey && daily.key === dailyKey && daily.phase === "ready");
  const monthlyReady = Boolean(monthlyKey && monthly.key === monthlyKey && monthly.phase === "ready");
  const dailyDirty = dailyReady && indicatorChanged(pressure, daily.baseline);
  const monthlyDirty = monthlyReady && indicatorChanged(readmission, monthly.baseline);
  const ward = wards.find(item => item.id === wardId);
  const dailyReason = pressureDisabledReason({ ward, date: serviceDate, ready: dailyReady, phase: daily.phase, entryStatus: daily.entryStatus, pending });
  const monthlyReason = !ward ? "เลือกหอผู้ป่วยก่อน" : !reportMonth ? "เลือกเดือนรายงานก่อน" : pending ? "กำลังบันทึกข้อมูล กรุณารอสักครู่" : !monthlyReady ? monthly.phase === "error" ? "โหลดข้อมูลรายเดือนไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึก" : "กำลังโหลดข้อมูลรายเดือน" : !ward.can_write ? "บัญชีนี้มีสิทธิ์อ่านข้อมูลหอผู้ป่วยนี้เท่านั้น" : "";
  latest.current = { dailyDirty, monthlyDirty, pending, confirmation };

  useEffect(() => {
    let active = true;
    setCatalog({ loading: true, error: "" });
    apiRequest("/wards").then(items => {
      if (!active) return;
      setWards(items);
      const params = new URLSearchParams(window.location.search);
      const linkedWard = items.find(item => item.id === params.get("ward"));
      setWardId(linkedWard?.id || preferredWard(items) || items[0]?.id || "");
      const linkedDate = params.get("date"), linkedMonth = params.get("month");
      if (linkedDate && parseISODate(linkedDate)) setServiceDate(linkedDate);
      if (linkedMonth && /^\d{4}-\d{2}$/.test(linkedMonth) && parseISODate(linkedMonth + "-01")) setReportMonth(linkedMonth);
      setCatalog({ loading: false, error: "" });
    }).catch(problem => { if (active) setCatalog({ loading: false, error: message(problem, "โหลดรายการหอผู้ป่วยไม่สำเร็จ กรุณาลองใหม่") }); });
    return () => { active = false; };
  }, [catalogRetry]);

  useEffect(() => {
    let active = true;
    setShiftCatalog({ loading: true, error: "", afternoon: null });
    apiRequest("/shifts?include_inactive=true").then(items => {
      if (!active) return;
      const afternoon = items.find(item => item.legacy_shift_id === 3);
      setShiftCatalog({ loading: false, afternoon, error: afternoon ? "" : "ไม่พบการตั้งค่าเวรบ่าย กรุณาติดต่อผู้ดูแลระบบ" });
    }).catch(problem => { if (active) setShiftCatalog({ loading: false, afternoon: null, error: message(problem, "ตรวจสถานะเวรบ่ายไม่สำเร็จ กรุณาลองใหม่") }); });
    return () => { active = false; };
  }, [shiftRetry]);

  useEffect(() => {
    let active = true;
    if (!dailyKey) { setDaily(initialState); return; }
    if (shiftCatalog.loading) { setDaily({ ...initialState, key: dailyKey, phase: "loading" }); return; }
    if (shiftCatalog.error) { setDaily({ ...initialState, key: dailyKey, phase: "error", error: shiftCatalog.error }); return; }
    setDaily({ ...initialState, key: dailyKey, phase: "loading" });
    Promise.all([
      apiRequest("/indicators/pressure/" + wardId + "?date_from=" + serviceDate + "&date_to=" + serviceDate),
      apiRequest("/entry-form?" + new URLSearchParams({ ward_id: wardId, service_date: serviceDate, shift_type_id: shiftCatalog.afternoon.id }))
    ]).then(([rows, form]) => {
      if (!active) return;
      const row = rows.find(item => item.service_date === serviceDate);
      const values = row ? { stage2_4_cases: row.stage2_4_cases, at_risk_patient_days: row.at_risk_patient_days } : { stage2_4_cases: 0, at_risk_patient_days: 0 };
      setPressure(values);
      setDaily({ ...initialState, key: dailyKey, phase: "ready", found: Boolean(row), baseline: values, entryStatus: form.entry?.status || "missing" });
    }).catch(problem => { if (active) setDaily({ ...initialState, key: dailyKey, phase: "error", error: message(problem, "โหลดข้อมูลแผลกดทับหรือสถานะเวรบ่ายไม่สำเร็จ กรุณาลองใหม่") }); });
    return () => { active = false; };
  }, [dailyKey, wardId, serviceDate, shiftCatalog, dailyRetry]);

  useEffect(() => {
    let active = true;
    if (!monthlyKey) { setMonthly(initialState); return; }
    setMonthly({ ...initialState, key: monthlyKey, phase: "loading" });
    const monthStart = reportMonth + "-01";
    apiRequest("/indicators/readmission/" + wardId + "?month_from=" + monthStart + "&month_to=" + monthStart).then(rows => {
      if (!active) return;
      const row = rows.find(item => item.reporting_month === monthStart);
      const values = row ? { readmit_count: row.readmit_count, discharge_count: row.discharge_count } : { readmit_count: 0, discharge_count: 0 };
      setReadmission(values);
      setMonthly({ ...initialState, key: monthlyKey, phase: "ready", found: Boolean(row), baseline: values });
    }).catch(problem => { if (active) setMonthly({ ...initialState, key: monthlyKey, phase: "error", error: message(problem, "โหลดข้อมูลการกลับมารักษาซ้ำไม่สำเร็จ กรุณาลองใหม่") }); });
    return () => { active = false; };
  }, [monthlyKey, wardId, reportMonth, monthlyRetry]);

  function requestChange(action, dirty) {
    if (writeLock.current || confirmAction.current) return;
    if (dirty) { confirmAction.current = action; setConfirmation(true); }
    else action();
  }
  function cancelChange() { confirmAction.current = null; setConfirmation(null); setResetToken(value => value + 1); }
  function continueChange() { const action = confirmAction.current; confirmAction.current = null; setConfirmation(null); action?.(); }
  useEffect(() => {
    function unload(event) {
      if (!leaveAllowed.current && (latest.current.dailyDirty || latest.current.monthlyDirty || writeLock.current)) { event.preventDefault(); event.returnValue = ""; }
    }
    function leave(event) {
      if (leaveAllowed.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!latest.current.dailyDirty && !latest.current.monthlyDirty && !writeLock.current) return;
      const target = event.target.closest?.("a[href],button[data-confirm-leave]");
      if (!target || target.target === "_blank" || target.hasAttribute("download") || target.getAttribute("href")?.startsWith("#")) return;
      event.preventDefault(); event.stopPropagation();
      requestChange(() => { leaveAllowed.current = true; if (target.tagName === "A") window.location.assign(target.href); else { try { target.click(); } finally { leaveAllowed.current = false; } } }, true);
    }
    window.addEventListener("beforeunload", unload); document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", leave, true); };
  }, []);

  function validateCounts(value) {
    return Object.values(value).every((count) => count !== "" && count !== null && Number.isInteger(Number(count)) && Number(count) >= 0 && Number(count) <= 2147483647);
  }
  async function savePressure() {
    if (writeLock.current || dailyReason) return;
    if (!validateCounts(pressure)) { setDaily(old => ({ ...old, saveError: "กรอกจำนวนเต็มไม่ติดลบให้ครบทุกช่อง แล้วลองบันทึกอีกครั้ง" })); return; }
    writeLock.current = true; setPending("daily"); setToast(""); setDaily(old => ({ ...old, saveError: "", notice: "" }));
    try {
      await apiRequest("/indicators/pressure/" + wardId + "/" + serviceDate, {
        method: "PUT",
        csrfToken,
        body: {
          stage2_4_cases: Number(pressure.stage2_4_cases),
          at_risk_patient_days: Number(pressure.at_risk_patient_days)
        }
      });
      setDaily(old => ({ ...old, found: true, baseline: { ...pressure }, notice: "บันทึกข้อมูลแผลกดทับแล้ว" }));
      setToast("บันทึกข้อมูลแผลกดทับแล้ว");
    } catch (problem) {
      setDaily(old => ({ ...old, saveError: message(problem, "บันทึกข้อมูลแผลกดทับไม่สำเร็จ กรุณาตรวจสอบแล้วลองใหม่"), entryStatus: problem.detail === "afternoon_entry_required" ? "unknown" : old.entryStatus }));
    } finally { writeLock.current = false; setPending(""); }
  }
  async function saveReadmission() {
    if (writeLock.current || monthlyReason) return;
    if (!validateCounts(readmission)) { setMonthly(old => ({ ...old, saveError: "กรอกจำนวนเต็มไม่ติดลบให้ครบทุกช่อง แล้วลองบันทึกอีกครั้ง" })); return; }
    writeLock.current = true; setPending("monthly"); setToast(""); setMonthly(old => ({ ...old, saveError: "", notice: "" }));
    try {
      await apiRequest("/indicators/readmission/" + wardId + "/" + reportMonth + "-01", {
        method: "PUT",
        csrfToken,
        body: {
          readmit_count: Number(readmission.readmit_count),
          discharge_count: Number(readmission.discharge_count)
        }
      });
      setMonthly(old => ({ ...old, found: true, baseline: { ...readmission }, notice: "บันทึกข้อมูลการกลับมารักษาซ้ำแล้ว" }));
      setToast("บันทึกข้อมูลการกลับมารักษาซ้ำแล้ว");
    } catch (problem) { setMonthly(old => ({ ...old, saveError: message(problem, "บันทึกข้อมูลการกลับมารักษาซ้ำไม่สำเร็จ กรุณาตรวจสอบแล้วลองใหม่") })); }
    finally { writeLock.current = false; setPending(""); }
  }
  const retryDaily = () => requestChange(() => { if (shiftCatalog.error) setShiftRetry(value => value + 1); else setDailyRetry(value => value + 1); }, dailyDirty);
  const entryHref = wardId && serviceDate && shiftCatalog.afternoon ? "/entries?" + new URLSearchParams({ ward: wardId, date: serviceDate, shift: shiftCatalog.afternoon.id }) : null;
  function handleTabKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = ["daily", "monthly"];
    const next = event.key === "Home" ? "daily" : event.key === "End" ? "monthly" : tabs[(tabs.indexOf(activeTab) + 1) % tabs.length];
    setActiveTab(next);
    document.getElementById(`indicator-tab-${next}`)?.focus();
  }
  return <AppShell><div className="indicators-page">
    <PageHeader title="ตัวชี้วัดเสริม" description="บันทึกข้อมูลแผลกดทับ (รายวัน) และการกลับมารักษาซ้ำ (รายเดือน) ของหอผู้ป่วย" />
    <Card className="indicators-ward">
      {catalog.loading ? <Skeleton lines={2} label="กำลังโหลดรายชื่อหอผู้ป่วย" /> : catalog.error ? <ErrorState description={catalog.error} onRetry={() => setCatalogRetry(value => value + 1)} /> : !wards.length ? <EmptyState title="ยังไม่มีหอผู้ป่วยที่เข้าถึงได้" description="ติดต่อผู้ดูแลระบบเพื่อตรวจสอบสิทธิ์หอผู้ป่วย" /> : <>
        <Select label="หอผู้ป่วยสำหรับตัวชี้วัด" value={wardId} onChange={event => { const value = event.target.value; requestChange(() => setWardId(value), dailyDirty || monthlyDirty); }} disabled={Boolean(pending)} required placeholder="เลือกหอผู้ป่วย" options={wards.map(item => ({ value: item.id, label: `${item.name} (${item.code})` }))} />
        <p className="ui-muted">หอผู้ป่วยเดียวกันสำหรับทั้งสองส่วน เลือกวันและเดือนแยกกันในแต่ละการ์ด</p>
      </>}
    </Card>
    <div className="indicators-tabs" role="tablist" aria-label="เลือกประเภทตัวชี้วัด" onKeyDown={handleTabKeyDown}>
      <button type="button" role="tab" id="indicator-tab-daily" className="indicators-tab" aria-selected={activeTab === "daily"} aria-controls="indicator-panel-daily" tabIndex={activeTab === "daily" ? 0 : -1} onClick={() => setActiveTab("daily")}>
        แผลกดทับ (รายวัน)
      </button>
      <button type="button" role="tab" id="indicator-tab-monthly" className="indicators-tab" aria-selected={activeTab === "monthly"} aria-controls="indicator-panel-monthly" tabIndex={activeTab === "monthly" ? 0 : -1} onClick={() => setActiveTab("monthly")}>
        การกลับมารักษาซ้ำ (รายเดือน)
      </button>
    </div>
    <div className="indicators-grid">
      <div id="indicator-panel-daily" role="tabpanel" aria-labelledby="indicator-tab-daily" className={`indicator-tab-panel ${activeTab !== "daily" ? "is-inactive-tab" : ""}`}>
        <PressureIndicatorCard date={serviceDate} onDateChange={value => requestChange(() => setServiceDate(value), value !== serviceDate && dailyDirty)} {...{ resetToken, entryHref }} state={daily} ready={dailyReady} values={pressure} onChange={(key, value) => setPressure(old => ({ ...old, [key]: value }))} reason={dailyReason} busy={Boolean(pending)} saving={pending === "daily"} onSave={savePressure} onRetry={retryDaily} />
      </div>
      <div id="indicator-panel-monthly" role="tabpanel" aria-labelledby="indicator-tab-monthly" className={`indicator-tab-panel ${activeTab !== "monthly" ? "is-inactive-tab" : ""}`}>
        <ReadmissionIndicatorCard month={reportMonth} onMonthChange={value => requestChange(() => setReportMonth(value), value !== reportMonth && monthlyDirty)} state={monthly} ready={monthlyReady} values={readmission} onChange={(key, value) => setReadmission(old => ({ ...old, [key]: value }))} reason={monthlyReason} busy={Boolean(pending)} saving={pending === "monthly"} onSave={saveReadmission} onRetry={() => requestChange(() => setMonthlyRetry(value => value + 1), monthlyDirty)} />
      </div>
    </div>
    {dailyReady && daily.entryStatus === "unknown" && <Button variant="secondary" icon="refresh" onClick={retryDaily}>ตรวจสถานะเวรบ่ายและโหลดข้อมูลใหม่</Button>}
    <ConfirmDialog open={Boolean(confirmation)} onClose={cancelChange} onConfirm={continueChange} title="มีข้อมูลที่ยังไม่บันทึก" description="การดำเนินการนี้จะทิ้งค่าที่แก้ไขในส่วนที่เปลี่ยน กรุณาบันทึกก่อนหากต้องการเก็บข้อมูล" confirmLabel="ทิ้งค่าและดำเนินการต่อ" />
    <div className="indicators-toast"><Toast open={Boolean(toast)} title={toast} onClose={() => setToast("")} /></div>
  </div></AppShell>;
}
