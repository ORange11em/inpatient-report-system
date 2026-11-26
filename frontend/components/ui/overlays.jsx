"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./primitives";

let locks = 0;
let previousOverflow = "";
let previousPadding = "";
function lockScroll() {
  if (locks++ === 0) {
    previousOverflow = document.body.style.overflow;
    previousPadding = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
  }
  return () => { if (--locks === 0) { document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPadding; } };
}

export function Dialog({ open, onClose, title, description, children, actions, variant = "dialog", busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!open) return;
    const returnFocus = document.activeElement;
    dialog.showModal();
    const unlock = lockScroll();
    return () => { dialog.close(); unlock(); if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus(); };
  }, [open]);
  return <dialog ref={ref} className={`ui-overlay ui-overlay--${variant}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      event.stopPropagation();
      const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]')].filter(element => element.tabIndex >= 0 && element.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onCloseRef.current?.(); }}
    onClick={event => { const box = event.currentTarget.getBoundingClientRect(); if (!busy && event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) onCloseRef.current?.(); }}>
    <div className="ui-overlay-heading"><h2 id={titleId}>{title}</h2><Button variant="ghost" icon="close" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={onClose}> <span className="ui-sr-only">ปิด</span></Button></div>
    {description && <p id={descriptionId} className="ui-overlay-description">{description}</p>}<div className="ui-overlay-body">{children}</div>{actions && <div className="ui-overlay-actions">{actions}</div>}
  </dialog>;
}

export function ConfirmDialog({ open, onClose, onConfirm, title = "ยืนยันการดำเนินการ", description, confirmLabel = "ยืนยัน", destructive = false, loading = false, children }) {
  return <Dialog {...{ open, onClose, title, description }} busy={loading} actions={<><Button variant="secondary" disabled={loading} onClick={onClose}>ยกเลิก</Button><Button variant={destructive ? "destructive" : "primary"} loading={loading} icon={destructive ? "warning" : "check"} onClick={onConfirm}>{confirmLabel}</Button></>}>{children}</Dialog>;
}

export function Drawer(props) { return <Dialog {...props} variant="drawer" />; }
export function BottomSheet(props) { return <Dialog {...props} variant="sheet" />; }

export function Toast({ open = true, tone = "success", title, description, onClose }) {
  // The live region remains mounted so a newly inserted notification is announced.
  return <div className="ui-toast-region" aria-live={tone === "danger" ? "assertive" : "polite"} aria-atomic="true">{open && <div className={`ui-toast ui-tone--${tone}`}>
    <div><strong>{title}</strong>{description && <p>{description}</p>}</div>{onClose && <Button variant="ghost" icon="close" aria-label="ปิดข้อความแจ้งเตือน" onClick={onClose} />}
  </div>}</div>;
}
