"use client";
import { useEffect, useState } from "react";
import { Card, EmptyState, ErrorState, Icon, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { useWorkspace } from "@/components/shell/WorkspaceContext";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { addDaysISO, formatThaiDate, formatThaiNumber, todayISO } from "@/lib/thai-date.mjs";
import { dailySnapshot, sameShiftComparison, wardCompletion } from "@/lib/dashboard.mjs";

export function KpiCard({ title, value, previous, percentage = false, icon, unit = "คน" }) {
  const delta = value != null && previous != null ? value - previous : null;
  return <Card className="home-kpi"><div className="home-kpi-label"><span>{title}</span><Icon name={icon} /></div><p className="home-kpi-value">{formatThaiNumber(value, { percent: percentage })}</p><p className="home-kpi-change">{delta == null ? "ยังไม่มีข้อมูลเปรียบเทียบ" : `${delta > 0 ? "↑ เพิ่มขึ้น " : delta < 0 ? "↓ ลดลง " : "เท่าเดิม "}${delta === 0 ? "" : formatThaiNumber(Math.abs(delta), { digits: percentage ? 1 : 0 }) + (percentage ? " จุดร้อยละ" : ` ${unit}`)}`}</p></Card>;
}

export function TodayStatusCard({ date, ward, entries, shifts }) {
  const firstMissing = shifts.find(shift => !entries.some(row => row.shift_type_id === shift.id));
  const pending = entries.some(row => row.status === "unconfirmed");
  const title = firstMissing ? "ยังบันทึกข้อมูลไม่ครบทุกเวร" : pending ? "มีข้อมูลที่รอการยืนยัน" : "ยืนยันข้อมูลครบทุกเวรแล้ว";
  const href = firstMissing && ward.can_write ? "/entries?" + new URLSearchParams({ ward: ward.id, date, shift: firstMissing.id }) : pending ? "/history?status=unconfirmed" : "/history";
  return <Card title="สถานะการส่งข้อมูลวันนี้" className="home-today" description={`${ward.name} · ${formatThaiDate(date, { month: "long" })}`}><div className="home-today-summary"><span className={`home-status-mark ui-tone--${firstMissing ? "warning" : pending ? "info" : "success"}`}><Icon name={firstMissing || pending ? "clock" : "check"} /></span><div><h3>{title}</h3><p className="ui-muted">ตรวจสถานะรายเวรก่อนเริ่มบันทึกหรือยืนยันข้อมูล</p></div></div><div className="home-shifts">{shifts.map(shift => { const entry = entries.find(row => row.shift_type_id === shift.id); return <div className="home-shift" key={shift.id}><strong>เวร{shift.display_name}</strong><StatusBadge status={entry?.status || "unrecorded"} /><a href={"/entries?" + new URLSearchParams({ ward: ward.id, date, shift: shift.id })}>{entry ? "ดูข้อมูลเวร" : ward.can_write ? "เริ่มบันทึก" : "เปิดดู"}<Icon name="arrow" /></a></div>; })}</div><a className="ui-button ui-button--primary home-primary" href={href}><Icon name={firstMissing ? "edit" : "checklist"} />{firstMissing && ward.can_write ? `บันทึกเวร${firstMissing.display_name}` : pending ? ward.can_write ? "ตรวจสอบและยืนยัน" : "ดูรายการรอยืนยัน" : "ดูประวัติข้อมูล"}</a></Card>;
}

function TrendCard({ days, shifts }) {
  const values = days.map(day => ({ date: day.service_date, value: dailySnapshot(day.entries, shifts)?.occupancy ?? null }));
  const max = Math.max(100, ...values.map(item => item.value ?? 0));
  const yFor = val => 82 - val / max * 66;
  const coordinates = values.map((item, index) => ({ ...item, x: 48 + index * 42, y: yFor(item.value ?? 0) }));
  const path = coordinates.map((item, index) => item.value == null ? "" : `${index && coordinates[index - 1].value != null ? "L" : "M"}${item.x},${item.y}`).join(" ");
  return <Card title="แนวโน้มอัตราการครองเตียง" description="7 วันล่าสุด · ณ เวรล่าสุดที่บันทึกของแต่ละวัน"><svg className="home-trend" viewBox="0 0 320 96" role="img" aria-label="แนวโน้มอัตราการครองเตียง ข้อมูลแต่ละวันอยู่ด้านล่าง">
    {[100, 50, 0].map(level => {
      const y = yFor(level);
      return <g key={level} aria-hidden="true"><line className="home-trend-grid" x1="40" y1={y} x2="310" y2={y} strokeDasharray={level === 0 ? undefined : "3 3"} /><text className="home-trend-axis" x="34" y={y + 3} textAnchor="end">{level}%</text></g>;
    })}
    <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    {coordinates.filter(item => item.value != null).map(item => <circle key={item.date} cx={item.x} cy={item.y} r="4" fill="currentColor"><title>{`${formatThaiDate(item.date, { month: "long" })}: ${formatThaiNumber(item.value, { percent: true })}`}</title></circle>)}
  </svg><dl className="home-trend-values">{values.map(item => <div key={item.date}><dt>{formatThaiDate(item.date)}</dt><dd>{formatThaiNumber(item.value, { percent: true })}</dd></div>)}</dl></Card>;
}

export function Dashboard({ announcements }) {
  const workspace = useWorkspace();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const date = todayISO();
  const wardId = workspace?.selectedWardId;
  useEffect(() => {
    if (!wardId) return;
    let active = true; setData(null); setError("");
    const dates = Array.from({ length: 7 }, (_, index) => addDaysISO(date, index - 6));
    Promise.all([apiRequest("/shifts?include_inactive=true"), ...dates.map(day => apiRequest("/reports/daily?" + new URLSearchParams({ service_date: day, ...(day === date ? {} : { ward_id: wardId }) })))])
      .then(([shifts, ...reports]) => { if (active) setData({ wardId, date, shifts, reports }); })
      .catch(problem => { if (active) setError(getErrorMessage(problem)); });
    return () => { active = false; };
  }, [wardId, date, retry]);
  if (!workspace) return null;
  const ready = data?.wardId === wardId && data?.date === date;
  const shifts = ready ? data.shifts.filter(shift => shift.is_active && [1, 2, 3].includes(shift.legacy_shift_id)).sort((a, b) => a.display_order - b.display_order) : [];
  const reports = ready ? data.reports.map(report => ({ ...report, entries: report.entries.filter(row => row.ward_id === wardId) })) : [];
  const entries = reports.at(-1)?.entries || [];
  const snapshot = ready ? dailySnapshot(entries, data.shifts) : null;
  const previous = snapshot ? sameShiftComparison(reports.at(-2)?.entries || [], data.shifts, snapshot.latestShift) : null;
  const completion = ready ? wardCompletion(data.reports.at(-1).entries, workspace.wards, shifts) : null;
  return <><PageHeader title="หน้าแรก" description="ภาพรวมประจำวันและงานที่รอดำเนินการ" /><div className="home-layout"><div className="home-primary-column">{workspace.wardsError ? <Card><ErrorState title="โหลดรายชื่อหอผู้ป่วยไม่สำเร็จ" description={workspace.wardsError} onRetry={workspace.retry} /></Card> : workspace.wardsLoading ? <Card><Skeleton label="กำลังโหลดหอผู้ป่วย" lines={5} /></Card> : !wardId ? <Card><EmptyState title="ยังไม่มีหอผู้ป่วยที่ได้รับสิทธิ์" description="ติดต่อผู้ดูแลระบบเพื่อกำหนดหอผู้ป่วยให้บัญชีนี้" /></Card> : error ? <Card><ErrorState description={error} onRetry={() => setRetry(value => value + 1)} /></Card> : !ready ? <><Card><Skeleton label="กำลังโหลดสถานะรายเวร" lines={5} /></Card><div className="home-kpis">{[1, 2, 3, 4, 5].map(key => <Card key={key}><Skeleton lines={3} /></Card>)}</div></> : <>
      {shifts.length ? <TodayStatusCard {...{ date, entries, shifts }} ward={workspace.ward} /> : <Card><EmptyState title="ยังไม่มีเวรที่เปิดใช้งาน" description="ติดต่อผู้ดูแลระบบเพื่อตรวจสอบข้อมูลเวร" /></Card>}
      {completion && workspace.wards.length > 1 && <Card className="home-completion-card"><div className="home-completion-row"><div><h2>ความครบถ้วนของทุกหอที่มีสิทธิ์</h2><p className="home-completeness"><strong>{completion.complete}/{completion.total}</strong> หอยืนยันครบทุกเวรแล้ว</p></div>{completion.missing.length > 0 && <details><summary>ดูหอที่ยังยืนยันไม่ครบ ({completion.missing.length})</summary><ul className="home-missing-wards">{completion.missing.map(ward => <li key={ward.id}>{ward.name}</li>)}</ul></details>}</div></Card>}
      <section aria-labelledby="home-kpi-heading"><div className="home-section-heading"><h2 id="home-kpi-heading">ภาพรวมจำนวนผู้ป่วย</h2><p className="ui-field-hint">{snapshot ? `ถึงเวร${data.shifts.find(shift => shift.id === snapshot.latestShift)?.display_name || "ล่าสุด"}` : "ยังไม่มีข้อมูลวันนี้"}</p></div><p className="home-kpi-note">ยอด PT (แสดงแยกจาก NB) · เปรียบเทียบถึงเวรเดียวกันเมื่อวาน</p><div className="home-kpis">{[["closing", "ผู้ป่วยคงเหลือ", "user"], ["received", "รับใหม่และรับย้าย", "plus"], ["discharged", "จำหน่าย", "arrow"], ["vacant", "เตียงว่าง", "bed"], ["occupancy", "อัตราการครองเตียง", "activity"]].map(([key, title, icon]) => <KpiCard key={key} {...{ title, icon }} value={snapshot?.[key] ?? null} previous={previous?.[key] ?? null} percentage={key === "occupancy"} unit={key === "vacant" ? "เตียง" : "คน"} />)}</div><p className="ui-field-hint home-kpi-note">อัตราการครองเตียงส่วนนี้คำนวณจากยอดคงเหลือและเตียง ณ เวรล่าสุด เป็นคนละช่วงกับรายงานรายเดือน</p></section>
      {reports.some(report => report.entries.length) && <TrendCard days={reports} shifts={data.shifts} />}
    </>}</div><aside className="home-announcements-column" aria-label="ข่าวประกาศ">{announcements}</aside></div></>;
}
