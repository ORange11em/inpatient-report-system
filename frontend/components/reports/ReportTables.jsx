"use client";

import { useState } from "react";
import { Button, DataTable, Icon, InfoCallout, InfoPopover, StatusBadge, TableScroll } from "@/components/ui";
import { useMobile } from "@/components/ui/primitives";
import { cleanWardName, displayedReportCell, occupancyDelta, occupancyRecords, pressureDrilldownTarget, printColumnGroups, REPORT_ORGANIZATION, reportColumnLabel, reportTimestamp, wardDisplayMeta } from "@/lib/report-view.mjs";
import { formatThaiMonth, formatThaiNumber } from "@/lib/thai-date.mjs";

export function WardNameLabel({ name, wards = [] }) {
  const { fullName, shortName } = wardDisplayMeta(name, wards);
  return <span className={`report-ward-name ${shortName ? "report-ward-name--has-short" : ""}`} title={shortName ? `${fullName} (${shortName})` : fullName}><span className="report-ward-full">{fullName}</span>{shortName && <abbr className="report-ward-short" title={fullName}>{shortName}</abbr>}</span>;
}

export function OccupancyCell({ item, annual = false }) {
  const value = annual ? item?.average : item?.bed_rate;
  if (item?.complete) return <span className="occupancy-complete"><Icon name={value == null ? "info" : "check"} /><span>{value == null ? "—" : formatThaiNumber(value, { digits: 2 }) + "%"}</span></span>;
  const { recorded, expected } = occupancyRecords(item);
  const text = "บันทึกแล้ว " + formatThaiNumber(recorded) + " จาก " + formatThaiNumber(expected) + " เวร";
  return <span className="occupancy-incomplete"><InfoPopover label={text} trigger={<span><span>{recorded}/{expected}</span><progress value={recorded} max={expected || 1} aria-label={text} /></span>}>{text} ยังไม่แสดงร้อยละจนกว่าข้อมูลจะครบ</InfoPopover></span>;
}
function Delta({ current, previous }) {
  const delta = occupancyDelta(current, previous);
  return <span className="occupancy-delta" aria-label={delta == null ? "ยังเปรียบเทียบไม่ได้" : (delta > 0 ? "เพิ่มขึ้น " : delta < 0 ? "ลดลง " : "เท่าเดิม ") + formatThaiNumber(Math.abs(delta), { digits: 1 }) + " จุดร้อยละ"}>{delta == null ? "—" : (delta > 0 ? "▲ " : delta < 0 ? "▼ " : "= ") + formatThaiNumber(Math.abs(delta), { digits: 1 })}</span>;
}
export function CompletenessLegend() {
  return <div className="report-legend"><p><Icon name="check" /><strong>ข้อมูลครบ:</strong> แสดงร้อยละ · — หมายถึงไม่มีค่าร้อยละ</p><p><Icon name="clock" /><strong>ข้อมูลไม่ครบ:</strong> จำนวนที่บันทึก / จำนวนที่ต้องมี (หน่วย: เวร) แตะตัวเลขเพื่อดูคำอธิบาย</p><p>▲ เพิ่มขึ้น · ▼ ลดลง · = เท่าเดิม เทียบปีก่อน (จุดร้อยละ) เปรียบเทียบเมื่อข้อมูลครบทั้งสองปี</p></div>;
}
export function OccupancyWardCard({ ward }) {
  const { recorded, expected } = occupancyRecords(ward.fiscal_year);
  return <article className="ui-record-card occupancy-ward-card"><h3>{cleanWardName(ward.name)}</h3>
    <dl className="occupancy-card-summary"><div><dt>เฉลี่ยปี (%)</dt><dd><OccupancyCell item={ward.fiscal_year} annual /></dd></div><div><dt>เฉลี่ยปีก่อน (%)</dt><dd><OccupancyCell item={ward.previous_fiscal_year} annual /></dd></div><div><dt>ส่วนต่าง</dt><dd><Delta current={ward.fiscal_year} previous={ward.previous_fiscal_year} /></dd></div></dl>
    <p className="ui-muted">บันทึกแล้ว {formatThaiNumber(recorded)} จาก {formatThaiNumber(expected)} เวร</p><progress value={recorded} max={expected || 1} aria-label="ความครบถ้วนทั้งปี" />
    <details><summary className="ui-button ui-button--ghost">ดูข้อมูลทั้ง 12 เดือน</summary><dl className="occupancy-card-months">{ward.months.map(month => <div key={month.month}><dt>{formatThaiMonth(month.month, { short: true, shortYear: true })}</dt><dd><OccupancyCell item={month} /></dd></div>)}</dl></details>
  </article>;
}
function ViewToggle({ view, setView }) {
  return <div className="ui-actions report-view-toggle" aria-label="มุมมองรายงาน"><Button variant={view === "cards" ? "primary" : "secondary"} aria-pressed={view === "cards"} onClick={() => setView("cards")}>การ์ด</Button><Button variant={view === "table" ? "primary" : "secondary"} aria-pressed={view === "table"} onClick={() => setView("table")}>ตาราง</Button></div>;
}
export function OccupancyReport({ report, wards = [] }) {
  const mobile = useMobile(), [view, setView] = useState("cards");
  const total = { ...report.total, ward_id: "total", name: "รวมทุกหอที่มีสิทธิ์" };
  const cells = ward => <><th scope="row"><WardNameLabel name={ward.name} wards={wards} /></th>{ward.months.map(month => <td key={month.month}><OccupancyCell item={month} /></td>)}<td><OccupancyCell item={ward.fiscal_year} annual /></td><td><OccupancyCell item={ward.previous_fiscal_year} annual /></td><td><Delta current={ward.fiscal_year} previous={ward.previous_fiscal_year} /></td></>;
  return <div className="occupancy-report"><InfoCallout tone="warning" title="สูตรรายเดือนชั่วคราว">สูตรและฐานจำนวนเตียงอยู่ระหว่างการยืนยัน ตัวเลขใช้วิธีคำนวณเดียวกับรายงานเดิม</InfoCallout><CompletenessLegend />
    {mobile && <ViewToggle {...{ view, setView }} />}
    {mobile && view === "cards" ? <div className="ui-record-cards">{report.wards.map(ward => <OccupancyWardCard ward={ward} key={ward.ward_id} />)}<OccupancyWardCard ward={total} /></div> :
      <TableScroll label="อัตราการครองเตียง เลื่อนดูเดือนเพิ่มเติมได้"><table className="ui-table occupancy-table"><caption className="ui-sr-only">อัตราการครองเตียงรายหอและยอดรวมตามบริการ</caption><colgroup><col className="occupancy-ward-col" />{Array.from({ length: 15 }, (_, i) => <col key={i} />)}</colgroup><thead><tr><th scope="col">หอผู้ป่วย</th>{report.months.map(month => <th scope="col" key={month}>{formatThaiMonth(month, { short: true, shortYear: true })}</th>)}<th scope="col">เฉลี่ยปี (%)</th><th scope="col">เฉลี่ยปีก่อน (%)</th><th scope="col">ส่วนต่าง</th></tr></thead><tbody>{report.wards.map(ward => <tr key={ward.ward_id}>{cells(ward)}</tr>)}</tbody><tfoot><tr>{cells(total)}</tr></tfoot></table></TableScroll>}
  </div>;
}
function ReportCell({ value, column, kind, rowWardName, wards = [], onDrillDown }) {
  if (column === "หอผู้ป่วย") return <WardNameLabel name={value} wards={wards} />;
  if (column === "สถานะ" && ["ยืนยันแล้ว", "รอยืนยัน"].includes(value)) return <StatusBadge status={value === "ยืนยันแล้ว" ? "confirmed" : "unconfirmed"} />;
  const text = displayedReportCell(value, column, kind);
  const drillTarget = pressureDrilldownTarget(kind, column, rowWardName, value, wards);
  if (drillTarget) {
    return <a
      href={drillTarget.href}
      className="report-drilldown-link"
      title={`ดูรายละเอียดแผลกดทับรายวัน ${drillTarget.wardName} (${reportColumnLabel(column)})`}
      onClick={event => {
        if (!onDrillDown || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onDrillDown(drillTarget);
      }}
    >{text}</a>;
  }
  return text;
}
export function ReportTable({ result, wards = [], onDrillDown }) {
  const mobile = useMobile(), [view, setView] = useState("cards");
  const records = result.rows.map((cells, id) => ({ id, ...Object.fromEntries(cells.map((v,i) => [String(i),v])) }));
  const last = records.at(-1), hasSummary = last && String(last["0"]).startsWith("รวม");
  const columns = result.columns.map((column, i) => ({ key: String(i), label: reportColumnLabel(column), numeric: records.some(row => typeof row[String(i)] === "number"), render: (value, row) => <ReportCell {...{ value, column, wards, onDrillDown }} rowWardName={row?.["0"]} kind={result.kind} /> }));
  return <div className="generic-report-table" style={{ "--report-column-count": result.columns.length }}>{mobile && <ViewToggle {...{ view, setView }} />}
    {mobile && view === "cards" ? <div className="ui-record-cards">{records.map(row => <article className="ui-record-card" key={row.id}><h3>{cleanWardName(row["0"])}</h3><dl>{columns.slice(1,3).map(c => <div key={c.key}><dt>{c.label}</dt><dd>{c.render(row[c.key], row)}</dd></div>)}</dl><details><summary className="ui-button ui-button--ghost">ดูข้อมูลครบทุกช่อง</summary><dl>{columns.slice(3).map(c => <div key={c.key}><dt>{c.label}</dt><dd>{c.render(row[c.key], row)}</dd></div>)}</dl></details></article>)}</div> :
      <DataTable label={result.title} columns={columns} rows={hasSummary ? records.slice(0,-1) : records} summary={hasSummary ? last : undefined} mobileCards={false} />}
  </div>;
}
export function DailyReportOverview({ summary, error }) {
  if (error) return <InfoCallout tone="warning" title="แสดงยอดสรุปไม่สำเร็จ">ตารางรายงานยังแสดงผลได้ ลองแสดงรายงานอีกครั้งเพื่อโหลดส่วนสรุป</InfoCallout>;
  if (!summary) return null;
  return <div className="report-daily-overview"><div className="report-kpis">{[["คงเหลือ PT",summary.closing],["รวมรับ PT",summary.received],["รวมจำหน่าย PT",summary.discharged],["เตียงว่าง",summary.vacant],["อัตราการครองเตียง (%)",summary.occupancy]].map(([label,value],i) => <div key={label}><span className="ui-muted">{label}</span><strong>{summary.available ? formatThaiNumber(value, { digits:i===4?1:0 }) : "—"}</strong></div>)}</div>
    {summary.note && <InfoCallout tone="warning">{summary.note}</InfoCallout>}
    <p className="ui-muted">คงเหลือ PT และเตียงอิงเวรล่าสุดของแต่ละหอที่มีข้อมูล ส่วนรับและจำหน่ายรวมในวันที่เลือกตามตัวกรอง</p>
    <InfoCallout tone={summary.missing.length ? "warning" : "success"} title={"บันทึกครบเวรที่เลือก " + summary.complete.length + "/" + summary.total + " หอ"}>{summary.missing.length ? "ยังขาด: " + summary.missing.map(w=>cleanWardName(w.name)).join(", ") : "มีข้อมูลครบตามเวรและสถานะข้อมูลที่เลือก"}</InfoCallout>
  </div>;
}
export function PrintHeader({ result, username, printedAt, part }) {
  return <div className="report-print-header"><strong>{REPORT_ORGANIZATION}</strong><h2>{result.title}{part && <span> · {part}</span>}</h2><p>{result.period} · {result.scope} · {result.statusText}</p><p>ผู้พิมพ์: {username} · พิมพ์เมื่อ {reportTimestamp(printedAt)} · เรียกดูข้อมูล ณ {reportTimestamp(result.loadedAt)}</p>{result.kind === "daily-all" && <><p>แพทย์เวร ..............................................................</p><p>พยาบาลเวรตรวจการ ..................................................</p></>}{result.kind === "occupancy" && <p>สูตรรายเดือนชั่วคราว · ตัวเลขที่มี / = เวรที่บันทึก / เวรที่ต้องมี · — = ไม่มีค่าร้อยละ</p>}</div>;
}
export function ReportPrint({ result, username, printedAt }) {
  const occupancyRows = result.occupancy && [...result.occupancy.wards, result.occupancy.total];
  const model = occupancyRows ? { ...result, columns: [...result.columns, "ส่วนต่าง (จุดร้อยละ)"], rows: result.rows.map((row,i) => {
    const delta = occupancyDelta(occupancyRows[i].fiscal_year, occupancyRows[i].previous_fiscal_year);
    return [...row, delta == null ? null : (delta > 0 ? "▲ " : delta < 0 ? "▼ " : "= ") + formatThaiNumber(Math.abs(delta), { digits: 1 })];
  }) } : result;
  const groups = printColumnGroups(model);
  return <div className="report-print-only" aria-hidden="true">{groups.map((indices, part) => <section className="report-print-panel" key={part}>
    <table><colgroup>{indices.map((i,n)=><col key={i} className={n===0?"report-print-ward-col":undefined} />)}</colgroup><thead><tr><th colSpan={indices.length}><PrintHeader {...{ result, username, printedAt }} part={groups.length>1?"ส่วน "+(part+1)+"/"+groups.length:null} /></th></tr><tr>{indices.map(i=><th scope="col" key={i}>{reportColumnLabel(model.columns[i])}</th>)}</tr></thead><tbody>{model.rows.map((row,r)=><tr key={r}>{indices.map((i,n)=>{const Tag=n===0?"th":"td";return <Tag scope={n===0?"row":undefined} key={i}>{displayedReportCell(row[i],model.columns[i],result.kind)}</Tag>})}</tr>)}</tbody></table>
    {result.kind === "daily-all" && part === groups.length - 1 && <p className="report-print-note">หากไม่มีรายชื่อตึก แสดงว่าในวันดังกล่าว ตึกยังไม่มีการบันทึกข้อมูล</p>}
  </section>)}</div>;
}
