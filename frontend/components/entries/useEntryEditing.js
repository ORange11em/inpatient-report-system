"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { changedFields, draftKey, draftScope, makeDraft, readDraft } from "@/lib/entry-workspace.mjs";

export function focusEntryField(field) {
  const section = field?.closest("details");
  if (section) section.open = true;
  requestAnimationFrame(() => { field?.focus(); field?.scrollIntoView({ block: "center", behavior: "instant" }); });
}

export function useEntryEditing({ userId, selection, context, values, setValues, setDirty, readonly, busy, initialValues, select, open, error }) {
  const formRef = useRef(null);
  const errorRef = useRef(null);
  const latest = useRef(null);
  const allowedNavigation = useRef(false);
  const pendingRef = useRef(null);
  const locallyWritten = useRef(null);
  const lastContextFocus = useRef(null);
  const baseline = useMemo(() => context ? initialValues(context) : {}, [context, initialValues]);
  const changed = useMemo(() => context ? changedFields(values, baseline) : [], [values, baseline, context]);
  const scope = draftScope(userId, selection);
  const key = draftKey(scope, context?.entry);
  const enabled = Boolean(context && userId && !readonly);
  const isDirty = enabled && changed.length > 0;
  const [candidate, setCandidate] = useState(null);
  const [storedAt, setStoredAt] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const [pending, setPending] = useState(null);
  const [resetToken, setResetToken] = useState(0);
  const [invalid, setInvalid] = useState([]);
  latest.current = { enabled, isDirty, busy, key, scope, baseline, values };
  useEffect(() => { setDirty(isDirty); }, [isDirty, values, baseline, setDirty]);

  function clearStored() {
    if (!scope) return;
    try { for (const item of Object.keys(localStorage)) if (item.startsWith(scope)) localStorage.removeItem(item); }
    catch { setStorageError("ลบค่าค้างในเครื่องไม่สำเร็จ กรุณาตรวจสิทธิ์การจัดเก็บของเบราว์เซอร์"); }
  }
  function persist() {
    const current = latest.current;
    if (!current.enabled || !current.isDirty || !current.key) return;
    try {
      const draft = makeDraft(current.key, current.baseline, current.values);
      localStorage.setItem(current.key, JSON.stringify(draft));
      locallyWritten.current = current.key;
      setStoredAt(draft.savedAt); setStorageError("");
    } catch { setStorageError("เก็บค่าค้างในเครื่องไม่ได้ กรุณาเปิดใช้การจัดเก็บของเบราว์เซอร์หรือบันทึกข้อมูลก่อนออก"); }
  }
  useEffect(() => {
    locallyWritten.current = null;
    setCandidate(null); setStoredAt(null); setInvalid([]);
    if (!enabled || !key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = readDraft(raw, key, baseline);
        if (draft.status === "invalid") localStorage.removeItem(key);
        else { setCandidate({ ...draft, key, baseline }); return; }
      }
      if (Object.keys(localStorage).some(item => item.startsWith(scope) && item !== key)) setCandidate({ status: "stale", key });
    } catch { setStorageError("อ่านค่าค้างในเครื่องไม่ได้ กรุณาตรวจสิทธิ์การจัดเก็บของเบราว์เซอร์"); }
  }, [key, baseline, enabled, scope]);
  useEffect(() => {
    if (enabled && !isDirty && locallyWritten.current === key) {
      try { localStorage.removeItem(key); locallyWritten.current = null; setStoredAt(null); setCandidate(null); }
      catch { setStorageError("ลบค่าค้างในเครื่องไม่สำเร็จ กรุณาตรวจสิทธิ์การจัดเก็บของเบราว์เซอร์"); }
    } else persist();
  }, [values, baseline, key, enabled, isDirty]);

  function requestAction(action, kind = "context") {
    if (pendingRef.current) return;
    if (latest.current.enabled && latest.current.isDirty) {
      persist();
      const focusTarget = document.activeElement === document.body ? lastContextFocus.current : document.activeElement;
      pendingRef.current = { action, kind, focusTarget }; setPending(pendingRef.current);
    }
    else action();
  }
  function cancelPending() {
    const target = pendingRef.current?.focusTarget;
    pendingRef.current = null; setPending(null); setResetToken(value => value + 1);
    requestAnimationFrame(() => { if (target?.isConnected && target.getClientRects().length) target.focus(); else document.querySelector(".entry-context-bar button")?.focus(); });
  }
  function continuePending() {
    const action = pending?.action;
    if (pending?.kind === "navigation") allowedNavigation.current = true;
    pendingRef.current = null; setPending(null); action?.();
  }
  useEffect(() => {
    function beforeUnload(event) {
      if (!latest.current.isDirty || allowedNavigation.current) return;
      persist(); event.preventDefault(); event.returnValue = "";
    }
    function leave(event) {
      if (!latest.current.isDirty || allowedNavigation.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target.closest?.('a[href], button[data-confirm-leave]');
      if (!target) return;
      if (target.tagName === "A" && (target.target === "_blank" || target.hasAttribute("download") || target.getAttribute("href").startsWith("#"))) return;
      if (target.tagName === "A") {
        const destination = new URL(target.href);
        if (!["http:", "https:"].includes(destination.protocol) || destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search && destination.hash !== location.hash) return;
      }
      event.preventDefault(); event.stopPropagation();
      requestAction(() => {
        if (target.tagName === "A") window.location.assign(target.href);
        else { allowedNavigation.current = true; try { target.click(); } finally { allowedNavigation.current = false; } }
      }, target.tagName === "A" ? "navigation" : "button");
    }
    function keyboard(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s" || !formRef.current) return;
      event.preventDefault();
      if (event.repeat || document.querySelector("dialog[open]")) return;
      if (latest.current.enabled && !latest.current.busy) formRef.current.requestSubmit();
    }
    const rememberFocus = event => { if (event.target.closest?.(".entry-context-form")) lastContextFocus.current = event.target; };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leave, true);
    document.addEventListener("keydown", keyboard);
    document.addEventListener("focusin", rememberFocus);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", leave, true); document.removeEventListener("keydown", keyboard); document.removeEventListener("focusin", rememberFocus); };
  }, []);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const wheel = event => { if (event.target.type === "number" && event.target === document.activeElement) event.preventDefault(); };
    form.addEventListener("wheel", wheel, { passive: false });
    return () => form.removeEventListener("wheel", wheel);
  }, [context, userId, readonly]);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const bar = form.querySelector(".entry-actions");
    function measure() {
      const viewport = window.visualViewport;
      const offset = viewport && viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      const keyboard = offset > 120 && form.contains(document.activeElement);
      form.dataset.keyboardOpen = String(keyboard);
      form.style.setProperty("--entry-keyboard-offset", `${keyboard ? offset : 0}px`);
      form.style.setProperty("--entry-actions-height", `${bar?.getBoundingClientRect().height || 0}px`);
      form.closest(".entry-page")?.style.setProperty("--entry-actions-height", `${bar?.getBoundingClientRect().height || 0}px`);
    }
    const observer = new ResizeObserver(measure);
    if (bar) observer.observe(bar);
    window.visualViewport?.addEventListener("resize", measure); window.visualViewport?.addEventListener("scroll", measure);
    form.addEventListener("focusin", measure); form.addEventListener("focusout", measure); measure();
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure); form.removeEventListener("focusin", measure); form.removeEventListener("focusout", measure); };
  }, [context, userId, readonly]);
  useEffect(() => {
    if (!error) return;
    const monthlyMissing = /ทั้งสองช่อง/.test(error) ? ["readmit_count", "discharge_count"].map(name => formRef.current?.querySelector(`[name="${name}"]`)).find(field => field && field.value === "") : null;
    const field = formRef.current?.querySelector(":invalid") || monthlyMissing;
    if (field) { setInvalid([field.name]); focusEntryField(field); }
    else errorRef.current?.focus();
  }, [error, context, userId]);

  function moveField(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !["Enter", "Tab"].includes(event.key) || event.target.type !== "number") return;
    const fields = [...formRef.current.querySelectorAll('input[type="number"]:not(:disabled)')];
    const next = fields[fields.indexOf(event.target) + (event.shiftKey ? -1 : 1)];
    if (next) { event.preventDefault(); focusEntryField(next); }
    else if (event.key === "Enter") { event.preventDefault(); formRef.current.querySelector('button[type="submit"]')?.focus(); }
  }
  function fieldProps(name) {
    return {
      className: `ui-input ui-number ${changed.includes(name) ? "entry-input--changed" : ""}`,
      "aria-describedby": invalid.includes(name) ? error ? "entry-error" : "entry-number-hint" : changed.includes(name) ? "entry-changed-hint" : undefined,
      "aria-invalid": invalid.includes(name) || undefined,
      onFocus: event => event.target.select(),
      onInvalid: event => { setInvalid(old => [...new Set([...old, name])]); if (formRef.current?.querySelector(":invalid") === event.target) focusEntryField(event.target); },
    };
  }
  return {
    formRef, errorRef, changed, isDirty, candidate: candidate?.key === key ? candidate : null, storedAt, storageError, pending, resetToken,
    lastSavedAt: lastSaved?.scope === scope ? lastSaved.time : null,
    fieldProps, moveField, cancelPending, continuePending,
    changeSelection: (name, value) => { if (String(selection[name]) !== String(value)) requestAction(() => select(name, value)); },
    openForm: event => { event.preventDefault(); requestAction(() => open(event)); },
    restore: () => {
      if (enabled && candidate?.status === "ready" && candidate.key === key) requestAction(() => {
        const current = latest.current;
        if (!current.enabled || current.key !== candidate.key || changedFields(candidate.baseline, current.baseline).length) return;
        setValues({ ...candidate.values }); setCandidate(null); setDirty(true);
      });
    },
    discard: () => { clearStored(); setCandidate(null); setStoredAt(null); },
    saved: () => { clearStored(); locallyWritten.current = null; setCandidate(null); setStoredAt(null); setInvalid([]); setLastSaved({ scope, time: new Date() }); },
    fieldChanged: name => setInvalid(old => old.filter(item => item !== name)),
  };
}
