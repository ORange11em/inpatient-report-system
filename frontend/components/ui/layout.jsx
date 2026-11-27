"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { Button, EmptyState, ErrorState, Skeleton, useMobile } from "./primitives";
import { BottomSheet } from "./overlays";

export function PageHeader({ title, description, breadcrumbs = [], actions }) {
  const mobile = useMobile();
  return <header className="ui-page-header"><div>{breadcrumbs.length > 0 && <nav aria-label="เส้นทางหน้าปัจจุบัน"><ol className="ui-breadcrumbs">{breadcrumbs.map((item, index) => <li key={item.label}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>{item.label}</span>}</li>)}</ol></nav>}
    <h1>{title}</h1>{description && <p className="ui-muted">{description}</p>}</div>
    {actions && (mobile ? <details className="ui-page-actions"><summary className="ui-button ui-button--secondary" aria-label="การดำเนินการเพิ่มเติม"><Icon name="more" /></summary><div>{actions}</div></details> : <div className="ui-actions">{actions}</div>)}
  </header>;
}

/** URL syncing is opt-in. Existing pages can keep their original request handlers. */
export function FilterBar({ children, chips = [], onApply, onReset, query, syncToUrl = false, loading = false, applyLabel = "แสดงข้อมูล" }) {
  const [open, setOpen] = useState(false);
  const mobile = useMobile();
  useEffect(() => { if (!mobile) setOpen(false); }, [mobile]);
  function apply(event) {
    event.preventDefault();
    if (syncToUrl && query) {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(query)) { if (value === "" || value === null || value === undefined) url.searchParams.delete(key); else url.searchParams.set(key, String(value)); }
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    onApply?.(); setOpen(false);
  }
  const form = <form onSubmit={apply} className="ui-filter-form"><div className="ui-filter-fields">{children}</div><div className="ui-actions"><Button type="submit" loading={loading} icon="filter">{applyLabel}</Button><Button variant="ghost" disabled={loading} onClick={onReset}>ล้างตัวกรอง</Button></div></form>;
  return <div className="ui-filter-bar">{mobile ? <><Button variant="secondary" icon="filter" onClick={() => setOpen(true)}>ตัวกรอง ({chips.length})</Button><BottomSheet {...{ open }} onClose={() => setOpen(false)} title="ตัวกรองข้อมูล">{form}</BottomSheet></> : form}
    {chips.length > 0 && <ul className="ui-chips" aria-label="ตัวกรองที่ใช้อยู่">{chips.map(chip => <li key={chip.label}><span>{chip.label}</span>{chip.onRemove && <Button variant="ghost" icon="close" aria-label={`ลบตัวกรอง ${chip.label}`} onClick={chip.onRemove} />}</li>)}</ul>}
  </div>;
}

export function DataTable({ label = "ตารางข้อมูล", columns, rows = [], rowKey = "id", summary, state, onRetry, mobileCards = true, emptyTitle, emptyDescription, mobileView, onMobileViewChange, showViewToggle = true }) {
  const [sort, setSort] = useState(null);
  const [localView, setLocalView] = useState("cards");
  const view = mobileView ?? localView;
  const setView = value => { setLocalView(value); onMobileViewChange?.(value); };
  const mobile = useMobile();
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(item => item.key === sort.key);
    return [...rows].sort((a, b) => {
      const result = column.compare ? column.compare(a, b) : column.numeric ? Number(a[sort.key] ?? 0) - Number(b[sort.key] ?? 0) : String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "th");
      return sort.direction === "ascending" ? result : -result;
    });
  }, [rows, columns, sort]);
  if (state === "loading") return <Skeleton lines={5} label={`กำลังโหลด${label}`} />;
  if (state === "error") return <ErrorState onRetry={onRetry} />;
  if (state === "empty" || !rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const cell = (column, row) => column.render ? column.render(row[column.key], row) : row[column.key] ?? "—";
  function changeSort(key) { setSort(old => ({ key, direction: old?.key === key && old.direction === "ascending" ? "descending" : "ascending" })); }
  return <div className="ui-data-table">{mobile && mobileCards && showViewToggle && <div className="ui-actions ui-view-toggle"><Button variant={view === "cards" ? "primary" : "secondary"} aria-pressed={view === "cards"} onClick={() => setView("cards")}>การ์ด</Button><Button variant={view === "table" ? "primary" : "secondary"} aria-pressed={view === "table"} onClick={() => setView("table")}>ตาราง</Button></div>}
    {mobile && mobileCards && view === "cards" ? <div className="ui-record-cards" aria-label={label}>{sorted.map(row => <article className="ui-record-card" key={row[rowKey]}><h3>{cell(columns[0], row)}</h3><dl>{columns.slice(1).map(column => <div key={column.key}><dt>{column.label}</dt><dd className={column.numeric ? "ui-numeric" : ""}>{cell(column, row)}</dd></div>)}</dl></article>)}{summary && <article className="ui-record-card"><h3>รวม</h3><dl>{columns.slice(1).map(column => <div key={column.key}><dt>{column.label}</dt><dd>{cell(column, summary)}</dd></div>)}</dl></article>}</div> :
      <div className="ui-table-scroll" role="region" aria-label={`${label} เลื่อนดูคอลัมน์เพิ่มเติมได้`} tabIndex={0}><table className="ui-table"><caption className="ui-sr-only">{label}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col" className={column.numeric ? "ui-numeric" : ""} aria-sort={column.sortable ? sort?.key === column.key ? sort.direction : "none" : undefined}>{column.sortable ? <button type="button" className="ui-sort-button" onClick={() => changeSort(column.key)}>{column.label}<Icon name="sort" /></button> : column.label}</th>)}</tr></thead>
        <tbody>{sorted.map(row => <tr key={row[rowKey]}>{columns.map((column, index) => { const Tag = index === 0 ? "th" : "td"; return <Tag key={column.key} scope={index === 0 ? "row" : undefined} className={column.numeric ? "ui-numeric" : ""}>{cell(column, row)}</Tag>; })}</tr>)}</tbody>
        {summary && <tfoot><tr>{columns.map((column, index) => <td key={column.key} className={column.numeric ? "ui-numeric" : ""}>{index === 0 ? <strong>{cell(column, summary)}</strong> : cell(column, summary)}</td>)}</tr></tfoot>}
      </table></div>}
  </div>;
}

export function TableScroll({ label = "ตารางข้อมูล", children }) { return <div className="ui-table-scroll" role="region" tabIndex={0} aria-label={label}>{children}</div>; }

export function StickyActionBar({ children, summary, className = "" }) {
  return <div className={`ui-sticky-actions ${className}`} aria-label="การดำเนินการกับแบบฟอร์ม"><div>{summary}</div><div className="ui-actions">{children}</div></div>;
}
