"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, EmptyState, ErrorState, FilterBar, InfoCallout, PageHeader, Select, Skeleton, ThaiDatePicker, ThaiMonthPicker, Toast } from "@/components/ui";
import { DailyReportOverview, OccupancyReport, ReportPrint, ReportTable } from "@/components/reports/ReportTables";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { defaultReportFilters, hiddenStatusKinds, occupancyTable, dailyReportSummary, reportCatalog, reportFilename, reportForChannel, reportHasData, reportPeriod, reportTimestamp, spreadsheetXML, statusLabels } from "@/lib/report-view.mjs";
import { fiscalYearForDate, fiscalYearRange, formatThaiMonth, parseISODate, monthStartISO, todayISO } from "@/lib/thai-date.mjs";
import "@/styles/reports.css";

const REPORT_GROUPS = [
  { label: "รายงานประจำวันและประจำเดือน", kinds: ["daily", "daily-all", "monthly"] },
  { label: "ยอดคงพยาบาล", kinds: ["census-day", "census-month"], adminOnly: true },
  { label: "อัตราเตียงและกำลังคนทางการพยาบาล", kinds: ["occupancy", "turnover", "los", "productivity", "skill-mix", "nursing-hours", "specialty"] },
  { label: "ตัวชี้วัดความปลอดภัย", kinds: ["pressure", "pressure-detail", "readmission"] },
];

const MIN_FISCAL_YEAR = 2553;

function compactFiscalYearLabel(year) {
  const range = fiscalYearRange(year);
  return range
    ? `ปีงบประมาณ ${year} (${formatThaiMonth(range.from, { short: true, shortYear: true })} – ${formatThaiMonth(range.to, { short: true, shortYear: true })})`
    : `ปีงบประมาณ ${year}`;
}

const friendlyError = problem => getErrorMessage(problem, "แสดงรายงานไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่").replace(/\bward\b/gi, "หอผู้ป่วย");

export function ReportViewer({ initialKind = "daily" }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState(() => defaultReportFilters(initialKind));
  const [wards, setWards] = useState([]), [shifts, setShifts] = useState([]);
  const [catalogState, setCatalogState] = useState("loading"), [catalogError, setCatalogError] = useState(""), [catalogRetry, setCatalogRetry] = useState(0);
  const [result, setResult] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(""), [exportNotice, setExportNotice] = useState("");
  const exportLock = useRef(false);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const requestId = useRef(0), initialized = useRef(false);
  const mode = reportCatalog[filters.kind][1];
  const reportGroups = useMemo(() => REPORT_GROUPS
    .filter(group => !group.adminOnly || user?.is_admin)
    .map(group => ({
      label: group.label,
      options: group.kinds.filter(key => reportCatalog[key]).map(key => ({ value: key, label: reportCatalog[key][0] })),
    })), [user?.is_admin]);
  const fiscalYearOptions = useMemo(() => {
    const currentYear = fiscalYearForDate(todayISO());
    const startYear = Math.max(currentYear, MIN_FISCAL_YEAR);
    const baseYears = Array.from({ length: startYear - MIN_FISCAL_YEAR + 1 }, (_, index) => startYear - index);
    const selectedYear = Number(filters.year);
    const allYears = [...new Set([...baseYears, ...(Number.isInteger(selectedYear) ? [selectedYear] : [])])].sort((a, b) => b - a);
    return allYears.map(year => ({ value: year, label: compactFiscalYearLabel(year) }));
  }, [filters.year]);

  useEffect(() => {
    let active = true; setCatalogState("loading"); setCatalogError("");
    Promise.all([apiRequest("/wards"), apiRequest("/shifts")]).then(([w,s]) => {
      if (!active) return;
      setWards(w); setShifts(s); setFilters(old => ({ ...old, shift: String(s[0]?.id ?? "") })); setCatalogState("ready");
    }).catch(problem => { if (active) { setCatalogError(friendlyError(problem)); setCatalogState("error"); } });
    return () => { active = false; requestId.current++; };
  }, [catalogRetry]);
  useEffect(() => {
    if (!user || catalogState !== "ready") return;
    function applyUrlParams() {
      const params = new URLSearchParams(window.location.search), next = { ...defaultReportFilters(initialKind), shift: String(shifts[0]?.id ?? "") };
      const kind = params.get("kind");
      if (reportCatalog[kind] && (user.is_admin || !kind.startsWith("census-"))) next.kind = kind;
      const linkedDate = params.get("date");
      if (parseISODate(linkedDate)) next.date = linkedDate;
      for (const key of ["month", "through"]) if (/^\d{4}-\d{2}$/.test(params.get(key) || "") && monthStartISO(params.get(key))) next[key] = params.get(key);
      if (next.through < next.month) next.through = next.month;
      const year = Number(params.get("year"));
      if (Number.isInteger(year) && year >= 2543 && year <= 3543) next.year = year;
      if (Object.hasOwn(statusLabels, params.get("status"))) next.status = params.get("status");
      if (wards.some(w => w.id === params.get("ward"))) next.ward = params.get("ward");
      if (shifts.some(s => String(s.id) === params.get("shift"))) next.shift = params.get("shift");
      setFilters(next); search(next);
    }
    if (!initialized.current) {
      initialized.current = true;
      applyUrlParams();
    }
    window.addEventListener("popstate", applyUrlParams);
    return () => window.removeEventListener("popstate", applyUrlParams);
  }, [user, catalogState]);
  function handleDrillDown(target) {
    if (!target) return;
    const next = { ...filters, kind: "pressure-detail", ward: target.wardId, month: target.month };
    window.history.pushState(window.history.state, "", target.href);
    setFilters(next);
    search(next);
  }
  useEffect(() => {
    function beforePrint() { flushSync(() => setPrintedAt(new Date())); }
    window.addEventListener("beforeprint", beforePrint);
    return () => window.removeEventListener("beforeprint", beforePrint);
  }, []);

  function change(key, value) {
    requestId.current++;
    setFilters(old => ({ ...old, [key]: value, ...(key === "month" && old.through < value ? { through: value } : {}) }));
    setResult(null); setError(""); setExportError(""); setExportNotice(""); setBusy(false);
  }
  function reset() {
    requestId.current++;
    setFilters({ ...defaultReportFilters(filters.kind), shift: String(shifts[0]?.id ?? "") });
    setResult(null); setError(""); setExportError(""); setExportNotice(""); setBusy(false);
  }
  function removeFilterChip(patch) {
    if (busy) return;
    const next = { ...filters, ...patch };
    const nextMode = reportCatalog[next.kind][1];
    const nextQuery = { kind: next.kind, date: nextMode === "day" ? next.date : "", month: ["month", "range"].includes(nextMode) ? next.month : "", through: nextMode === "range" ? next.through : "", year: nextMode === "year" ? next.year : "", ward: next.kind !== "occupancy" ? next.ward : "", shift: next.kind === "daily-all" ? next.shift : "", status: next.status };
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(nextQuery)) {
      if (value === "" || value === null || value === undefined) url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    setFilters(next);
    search(next);
  }
  async function search(chosen = filters) {
    const { kind, date, month, through, year, status, ward, shift } = chosen;
    const mode = reportCatalog[kind][1];
    if (mode === "range" && through < month) { setError("เดือนสิ้นสุดต้องไม่อยู่ก่อนเดือนเริ่มต้น กรุณาเลือกช่วงใหม่"); return; }
    if (kind === "daily-all" && !shift) { setError("ยังไม่มีเวรให้เลือก กรุณาติดต่อผู้ดูแลระบบ"); return; }
    const id = ++requestId.current;
    setBusy(true); setError(""); setResult(null); setExportError(""); setExportNotice("");
    try {
      const selected = mode === "day" ? date : mode === "year" ? String(year-543) + "-09-30" : month + "-01";
      const params = new URLSearchParams({ selected, status });
      if (ward) params.set("ward_id", ward);
      if (kind === "daily-all") params.set("shift_type_id", shift);
      if (mode === "range") params.set("through", through + "-01");
      const response = kind === "occupancy" ? await apiRequest("/reports/occupancy?" +
        new URLSearchParams({ fiscal_year_end: String(year - 543), status })) :
        await apiRequest("/reports/summary/" + kind + "?" + params);
      if (id !== requestId.current) return;
      const data = kind === "occupancy" ? occupancyTable(response) : response;
      let channels;
      if (["daily", "monthly", "census-month", "productivity"].includes(kind)) {
        const [print, excel] = await Promise.all(["print", "excel"].map(channel =>
          apiRequest("/reports/summary/" + kind + "?" + new URLSearchParams({ ...Object.fromEntries(params), channel }))));
        channels = { print, excel };
        if (id !== requestId.current) return;
      }
      let overview = null, overviewError = false;
      if (["daily", "daily-all"].includes(kind)) {
        const dailyParams = new URLSearchParams({ service_date: date });
        if (ward) dailyParams.set("ward_id", ward);
        if (kind === "daily-all") dailyParams.set("shift_type_id", shift);
        try {
          const daily = await apiRequest("/reports/daily?" + dailyParams);
          overview = dailyReportSummary(daily.entries, wards, shifts, chosen);
        } catch { overviewError = true; }
      }
      if (id !== requestId.current) return;
      const scope = kind === "occupancy" || !ward ? "ทุกหอที่มีสิทธิ์" : wards.find(w=>w.id===ward)?.name || "หอผู้ป่วยที่เลือก";
      const statusText = hiddenStatusKinds.includes(kind) ? "ข้อมูลตัวชี้วัดร่วมของหอผู้ป่วย" : "สถานะข้อมูล: " + statusLabels[status];
      setResult({ ...data, channels, kind, selected, title: reportCatalog[kind][0], period: reportPeriod(chosen), filters: { ...chosen }, scope, statusText, loadedAt: new Date(), occupancy: kind === "occupancy" ? response : null, overview, overviewError });
    } catch (problem) { if (id === requestId.current) setError(friendlyError(problem)); }
    finally { if (id === requestId.current) setBusy(false); }
  }
  async function exportExcel() {
    if (!reportHasData(result) || exportLock.current) return;
    exportLock.current = true;
    setExporting(true); setExportError(""); setExportNotice("");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const xml = spreadsheetXML(reportForChannel(result, "excel"));
      const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
      const link = document.createElement("a"); link.href = url; link.download = reportFilename(result); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice("ส่งออกไฟล์รายงานแล้ว");
    } catch { setExportError("ส่งออกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"); }
    finally { exportLock.current = false; setExporting(false); }
  }
  const noData = result && !reportHasData(result);
  const actionReason = busy ? "กำลังโหลดรายงาน กรุณารอสักครู่" : error ? "แสดงรายงานให้สำเร็จก่อนพิมพ์หรือส่งออก" : !result ? "เลือกเงื่อนไขแล้วกดแสดงรายงาน" : noData ? "ไม่มีข้อมูลสำหรับพิมพ์หรือส่งออก เลือกวันหรือช่วงอื่น" : "";
  const query = { kind: filters.kind, date: mode === "day" ? filters.date : "", month: ["month","range"].includes(mode) ? filters.month : "", through: mode === "range" ? filters.through : "", year: mode === "year" ? filters.year : "", ward: filters.kind !== "occupancy" ? filters.ward : "", shift: filters.kind === "daily-all" ? filters.shift : "", status: filters.status };
  const chips = [
    { label: reportPeriod(filters) },
    ...(filters.kind !== "occupancy" ? [{ label: filters.ward ? wards.find(w => w.id === filters.ward)?.name || "หอที่เลือก" : "ทุกหอที่มีสิทธิ์", onRemove: filters.ward ? () => removeFilterChip({ ward: "" }) : undefined }] : []),
    ...(!hiddenStatusKinds.includes(filters.kind) ? [{ label: "สถานะข้อมูล: " + statusLabels[filters.status], onRemove: filters.status !== "all" ? () => removeFilterChip({ status: "all" }) : undefined }] : []),
  ];
  const printerName = user?.full_name?.trim() || user?.username || "—";
  return <AppShell><div className="reports-page">
    <PageHeader title={reportCatalog[filters.kind][0]} breadcrumbs={[{ label:"รายงาน" },{ label:reportCatalog[filters.kind][0] }]} description="เลือกเงื่อนไขเพื่อตรวจรายงาน พิมพ์ หรือส่งออกข้อมูล" />
    <Card className="reports-filters">{catalogState === "loading" ? <Skeleton label="กำลังโหลดตัวเลือกรายงาน" /> : catalogState === "error" ? <ErrorState title="โหลดตัวเลือกรายงานไม่สำเร็จ" description={catalogError} onRetry={()=>setCatalogRetry(n=>n+1)} /> :
      <FilterBar chips={chips} onApply={()=>search()} onReset={reset} loading={busy} applyLabel="แสดงรายงาน" query={query} syncToUrl>
        <Select label="ประเภทรายงาน" value={filters.kind} disabled={busy} groups={reportGroups} onChange={e=>change("kind",e.target.value)} />
        {mode === "day" && <ThaiDatePicker label="ประจำวันที่" value={filters.date} onChange={value=>change("date",value)} disabled={busy} required />}
        {["range","month"].includes(mode) && <ThaiMonthPicker label={mode==="range"?"ตั้งแต่เดือน":"เดือนรายงาน"} value={filters.month} onChange={value=>change("month",value)} disabled={busy} required />}
        {mode === "range" && <ThaiMonthPicker label="ถึงเดือน" value={filters.through} onChange={value=>change("through",value)} disabled={busy} error={filters.through<filters.month?"เดือนสิ้นสุดต้องไม่อยู่ก่อนเดือนเริ่มต้น":undefined} required />}
        {mode === "year" && <Select label="ปีงบประมาณ" value={Number(filters.year)} options={fiscalYearOptions} onChange={e=>change("year",Number(e.target.value))} disabled={busy} required />}
        {filters.kind !== "occupancy" && <Select label="หอผู้ป่วยในรายงาน" value={filters.ward} options={[{ value:"",label:"ทุกหอที่มีสิทธิ์" },...wards.map(w=>({ value:w.id,label:w.name }))]} disabled={busy} onChange={e=>change("ward",e.target.value)} />}
        {filters.kind === "daily-all" && <Select label="เวรในรายงาน" required value={filters.shift} options={shifts.map(s=>({ value:s.id,label:s.display_name }))} disabled={busy} onChange={e=>change("shift",e.target.value)} />}
        {!hiddenStatusKinds.includes(filters.kind) && <Select label="สถานะข้อมูล" value={filters.status} options={Object.entries(statusLabels).map(([value,label])=>({ value,label }))} disabled={busy} onChange={e=>change("status",e.target.value)} />}
      </FilterBar>}
    </Card>
    <Card className="report-output">
      <div className="report-screen">
        <div className="report-heading"><div><h2>{result?.title || reportCatalog[filters.kind][0]}</h2><p className="ui-muted">{result ? result.period + " · " + result.scope : reportPeriod(filters)}</p>{result && <><p className="ui-muted">{result.statusText}</p><p className="ui-muted">เรียกดูข้อมูล ณ {reportTimestamp(result.loadedAt)}</p></>}</div>
          <div className="report-actions"><Button icon="print" variant="secondary" disabled={Boolean(actionReason) || exporting} aria-describedby="report-action-reason" onClick={()=>window.print()}>พิมพ์</Button><Button icon="download" variant="secondary" disabled={Boolean(actionReason)} loading={exporting} aria-describedby="report-action-reason" onClick={exportExcel}>ส่งออก Excel</Button></div>
        </div>
        {actionReason && <p id="report-action-reason" className="ui-muted">{actionReason}</p>}
        {busy ? <Skeleton lines={7} label="กำลังโหลดรายงาน" /> : error ? <ErrorState description={error} onRetry={()=>search()} /> : !result ? <EmptyState title="พร้อมแสดงรายงาน" description="เลือกเงื่อนไขแล้วกดแสดงรายงาน" /> : noData ? <EmptyState title="ไม่พบข้อมูลในช่วงที่เลือก" description="ลองเปลี่ยนวัน ช่วงข้อมูล หรือสถานะข้อมูล แล้วกดแสดงรายงานอีกครั้ง" /> : <>
          {["daily","daily-all"].includes(result.kind) && <DailyReportOverview summary={result.overview} error={result.overviewError} />}
          {result.channels && JSON.stringify(result.rows) !== JSON.stringify(result.channels.print.rows) && <p className="ui-field-hint">หน้าจอและเอกสารพิมพ์หรือส่งออกคงวิธีคำนวณของรายงานเดิมแยกตามช่องทาง ตัวเลขบางช่องจึงต่างกัน</p>}
          {result.kind === "pressure" && <p className="ui-field-hint">คลิกที่ตัวเลขรายเดือนของแต่ละหอผู้ป่วยเพื่อเปิดดูรายละเอียดแผลกดทับรายวันของเดือนนั้น</p>}
          {result.kind==="occupancy" ? <OccupancyReport report={result.occupancy} wards={wards} /> : <ReportTable result={result} wards={wards} onDrillDown={handleDrillDown} />}
        </>}
        <p className="report-export-note ui-muted">ส่งออกเป็น Excel XML (.xml) เปิดด้วยโปรแกรม Excel ได้ ตัวเลขคงค่าจากรายงาน</p>
      </div>
      {result && !noData && <ReportPrint result={reportForChannel(result, "print")} username={printerName} printedAt={printedAt} />}
    </Card>
    <div className="reports-toast"><Toast open={Boolean(exportError || exportNotice)} tone={exportError ? "danger" : "success"} title={exportError || exportNotice} onClose={() => { setExportError(""); setExportNotice(""); }} /></div>
  </div></AppShell>;
}
