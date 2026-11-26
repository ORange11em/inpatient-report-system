"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { addDaysISO, formatThaiDate, formatThaiNumber, parseISODate, todayISO } from "@/lib/thai-date.mjs";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest, getErrorMessage } from "@/lib/api";

import { Button, Card, DateRangePicker, EmptyState, ErrorState, FilterBar, PageHeader, Select, Skeleton, Toast } from "@/components/ui";
import { HistoryResults } from "@/components/history/HistoryResults";
import { HistoryActionDialog, HistoryEntryDialog } from "@/components/history/HistoryEntryDialog";
import { historyStatusCountsPath } from "@/lib/history-view.mjs";
import "@/styles/history.css";

const pageSize = 50;
const defaults = pending => ({ ward_id: "", date_from: pending ? "" : todayISO().slice(0, 7) + "-01", date_to: pending ? "" : todayISO(), status: pending ? "unconfirmed" : "" });

export default function HistoryPage() {
  const { user, csrfToken } = useAuth();
  const [wards, setWards] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [filters, setFilters] = useState(() => defaults(false));
  const [applied, setApplied] = useState(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(null);
  const [countsFailed, setCountsFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingView, setPendingView] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [inspected, setInspected] = useState(null);
  const [operation, setOperation] = useState(null);
  const [view, setView] = useState("cards");
  const heading = useRef(null);
  const latestSearch = useRef(0);

  async function load(params, index) {
    const search = ++latestSearch.current;
    setBusy(true); setError("");
    setCounts(null); setCountsFailed(false);
    apiRequest(historyStatusCountsPath(params))
      .then(data => { if (search === latestSearch.current) setCounts(data); })
      .catch(() => { if (search === latestSearch.current) setCountsFailed(true); });
    try {
      const query = new URLSearchParams(Object.entries(params).filter(([,v]) => v));
      query.set("offset", index * pageSize);
      query.set("limit", pageSize + 1);
      const data = await apiRequest("/entries?" + query);
      if (search !== latestSearch.current) return;
      setRows(data.slice(0, pageSize)); setMore(data.length > pageSize);
      setApplied(params); setPage(index);
    } catch (e) { if (search === latestSearch.current) setError(getErrorMessage(e)); }
    finally { if (search === latestSearch.current) setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    setCatalogBusy(true); setCatalogError("");
    Promise.all([apiRequest("/wards"), apiRequest("/shifts?include_inactive=true")]).then(([w,s]) => { if (active) { setWards(w); setShifts(s); } })
      .catch(e => { if (active) setCatalogError(getErrorMessage(e)); }).finally(() => { if (active) setCatalogBusy(false); });
    return () => { active = false; };
  }, [catalogRetry]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const pending = query.get("status") === "unconfirmed";
    const initial = defaults(pending);
    if (["confirmed", "unconfirmed"].includes(query.get("status"))) initial.status = query.get("status");
    if (query.has("ward_id")) initial.ward_id = query.get("ward_id");
    for (const key of ["date_from", "date_to"]) if (query.has(key) && (query.get(key) === "" || parseISODate(query.get(key)))) initial[key] = query.get(key);
    setPendingView(pending); setFilters(initial);
    if (pending) load(initial, 0);
  }, []);

  function change(key, value) { setFilters(f => ({ ...f, [key]:value })); }
  async function action(row, confirm, providedReason = "") {
    const reason = confirm ? "" : providedReason.trim();
    if (!confirm && !reason) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("/entries/" + row.id + (confirm ? "/confirm" : "/return"), {
        method:"POST", csrfToken, body: confirm ? { expected_version:row.version } : { expected_version:row.version, reason }
      });
      setNotice(confirm ? "ยืนยันการส่งข้อมูลแล้ว" : "ส่งกลับให้หอผู้ป่วยแก้ไขแล้ว");
      window.dispatchEvent(new Event("inpatient-entries-changed"));
      setOperation(null); setInspected(null);
      await load(applied, rows.length === 1 && page > 0 ? page-1 : page);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  function apply(next = filters) {
    if (busy) return;
    if (next.date_from && next.date_to && next.date_from > next.date_to) { setError("วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น กรุณาตรวจสอบช่วงวันที่"); return; }
    setFilters(next); setPendingView(next.status === "unconfirmed"); setNotice("");
    const url = new URL(window.location.href);
    for (const key of ["ward_id", "date_from", "date_to", "status"]) { if (next[key]) url.searchParams.set(key, next[key]); else url.searchParams.delete(key); }
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new PopStateEvent("popstate"));
    load(next, 0);
  }
  const reset = () => apply(defaults(pendingView));
  const chips = applied ? [
    ...(applied.ward_id ? [{ label: wards.find(ward => ward.id === applied.ward_id)?.name || "หอผู้ป่วยที่เลือก", onRemove: () => apply({ ...applied, ward_id: "" }) }] : []),
    ...(applied.date_from || applied.date_to ? [{ label: `${applied.date_from ? formatThaiDate(applied.date_from) : "ทุกวันก่อนหน้า"} – ${applied.date_to ? formatThaiDate(applied.date_to) : "ทุกวันถัดไป"}`, onRemove: () => apply({ ...applied, date_from: "", date_to: "" }) }] : []),
    ...(applied.status ? [{ label: applied.status === "unconfirmed" ? "รอยืนยัน" : "ยืนยันแล้ว", onRemove: () => apply({ ...applied, status: "" }) }] : []),
  ] : [];
  const changed = applied && Object.keys(filters).some(key => filters[key] !== applied[key]);
  const title = pendingView ? "รอยืนยันการส่งข้อมูล" : "ตรวจสอบและยืนยันข้อมูล";
  const inspect = row => { setError(""); setInspected(row); };
  const beginAction = (row, confirm) => { setError(""); setOperation({ row, confirm }); };
  const refresh = () => { setOperation(null); setInspected(null); load(applied || filters, page); };

  return <AppShell><div className="history-page">
    <PageHeader title={title} description={pendingView ? "ตรวจข้อมูลที่บันทึกแล้วและรอการยืนยัน แยกตามวันที่" : "ค้นหา ดูรายละเอียด และแก้ไขข้อมูลด้วยแบบฟอร์มประจำวันเดิม"} />
    <Card className="history-filters"><FilterBar chips={chips} onApply={() => apply()} onReset={reset} loading={busy || catalogBusy} applyLabel="ค้นหารายการ">
      <Select label="หอผู้ป่วย" value={filters.ward_id} disabled={busy || catalogBusy} options={[{ value: "", label: "ทุกหอที่มีสิทธิ์" }, ...wards.map(ward => ({ value: ward.id, label: ward.name }))]} onChange={event => change("ward_id", event.target.value)} />
      <DateRangePicker compact label="ช่วงวันที่" value={{ from: filters.date_from, to: filters.date_to }} disabled={busy || catalogBusy} onChange={value => setFilters(old => ({ ...old, date_from: value.from, date_to: value.to }))} />
      <Select label="สถานะข้อมูล" value={filters.status} disabled={busy} options={[{ value: "", label: "ทั้งหมด" }, { value: "unconfirmed", label: "รอยืนยัน" }, { value: "confirmed", label: "ยืนยันแล้ว" }]} onChange={event => change("status", event.target.value)} />
    </FilterBar>{changed && <p className="ui-field-hint history-filter-hint">ตัวกรองมีการเปลี่ยนแปลง กดค้นหารายการเพื่อแสดงผลใหม่</p>}</Card>
    {catalogError && <Card><ErrorState title="โหลดรายชื่อหอผู้ป่วยหรือเวรไม่สำเร็จ" description={catalogError.replaceAll("ward", "หอผู้ป่วย")} onRetry={() => setCatalogRetry(value => value + 1)} /></Card>}
    {!busy && !catalogBusy && !catalogError && applied && !error && <section className="history-status-filters" aria-label="กรองสถานะข้อมูล">
      <p className="ui-field-hint" role="status">{countsFailed ? "โหลดจำนวนรายการไม่สำเร็จ กดค้นหารายการเพื่อลองอีกครั้ง" : counts ? "จำนวนรายการตามหอผู้ป่วยและช่วงวันที่ที่เลือก" : "กำลังนับจำนวนรายการ…"}</p>
      <div className="ui-actions">
        {[["", "ทั้งหมด"], ["unconfirmed", "รอยืนยัน"], ["confirmed", "ยืนยันแล้ว"]].map(([status, label]) =>
          <Button key={status} variant={applied.status === status ? "primary" : "secondary"} aria-pressed={applied.status === status} onClick={() => apply({ ...applied, status })}>
            {label}{counts && ` (${formatThaiNumber(counts[status || "all"])})`}
          </Button>)}
        <a className="ui-button ui-button--ghost" href="/">ตรวจเวรที่ยังไม่บันทึกในหน้าแรก</a>
      </div>
    </section>}
    <section className="history-results-section" aria-labelledby="history-results-heading" aria-busy={busy || catalogBusy}>
      <div className="history-results-heading"><h2 id="history-results-heading" tabIndex={-1} ref={heading}>ผลการค้นหา</h2>{applied && !busy && !error && <p className="ui-field-hint">หน้า {formatThaiNumber(page + 1)} · แสดง {formatThaiNumber(rows.length)} รายการ{more ? " · มีรายการถัดไป" : ""}</p>}</div>
      {busy || catalogBusy ? <Card><Skeleton label="กำลังโหลดรายการข้อมูล" lines={6} /></Card> : error && !operation ? <Card><ErrorState title="ค้นหาหรือปรับสถานะข้อมูลไม่สำเร็จ" description={error.replaceAll("ward", "หอผู้ป่วย")} onRetry={() => load(applied || filters, page)} /></Card> : catalogError ? null : !applied ? <Card><EmptyState title="เลือกตัวกรองเพื่อดูประวัติ" description="กำหนดหอผู้ป่วย ช่วงวันที่ และสถานะ แล้วกดค้นหารายการ" icon="history" /></Card> : !rows.length ? <Card><EmptyState title={pendingView ? "ไม่มีรายการรอยืนยัน" : "ไม่พบรายการในช่วงที่เลือก"} description={pendingView ? "ไม่พบข้อมูลรอยืนยันตามตัวกรองนี้ ตรวจสอบช่วงวันหรือเริ่มบันทึกข้อมูลประจำวันได้" : "ลองล้างตัวกรองหรือเปลี่ยนช่วงวันที่"} icon={pendingView ? "check" : "empty"} action={<div className="ui-actions"><Button variant="secondary" onClick={reset}>ล้างตัวกรอง</Button>{(applied.date_from || applied.date_to) && <Button variant="ghost" onClick={() => apply({ ...applied, date_from: addDaysISO(todayISO(), -29), date_to: todayISO() })}>ดู 30 วันล่าสุด</Button>}<a className="ui-button ui-button--ghost" href="/entries">ไปบันทึกข้อมูล</a></div>} /></Card> : <HistoryResults {...{ rows, wards, shifts, user, pendingView, busy, view, setView }} onInspect={inspect} />}
      {applied && !error && !busy && !catalogError && (page > 0 || more) && <nav className="history-pagination" aria-label="แบ่งหน้ารายการ"><Button variant="secondary" disabled={busy || page === 0} onClick={() => load(applied, page - 1)}>ก่อนหน้า</Button><span>หน้า {formatThaiNumber(page + 1)}</span><Button variant="secondary" disabled={busy || !more} onClick={() => load(applied, page + 1)}>ถัดไป</Button></nav>}
    </section>
    <HistoryEntryDialog row={inspected} {...{ wards, shifts, user, busy }} onClose={() => { if (!busy) setInspected(null); }} onAction={beginAction} />
    <HistoryActionDialog {...{ operation, wards, shifts, busy, error }} onClose={() => { if (!busy) setOperation(null); }} onSubmit={action} onRefresh={refresh} />
    <div className="history-toast"><Toast open={Boolean(notice)} title={notice} onClose={() => setNotice("")} /></div>
  </div></AppShell>;
}

