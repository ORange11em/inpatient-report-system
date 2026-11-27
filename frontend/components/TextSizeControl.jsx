"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const levels = [100, 112.5, 125];
const storageKey = "inpatient-text-size";
const validLevel = value => levels.includes(Number(value)) ? Number(value) : 100;

export function TextSizeControl() {
  const [level, setLevel] = useState(100);

  function apply(value) {
    const next = validLevel(value);
    document.documentElement.dataset.textSize = String(next);
    setLevel(next);
  }

  useEffect(() => {
    try { apply(localStorage.getItem(storageKey)); }
    catch { apply(100); }
    const sync = event => {
      if (event.key === storageKey || event.key === null) apply(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function change(next) {
    apply(next);
    try { localStorage.setItem(storageKey, String(next)); }
    catch { /* Text sizing still works when device storage is unavailable. */ }
  }

  const index = levels.indexOf(level);
  return <section className="text-size-control" aria-label="ปรับขนาดตัวอักษร">
    <span className="text-size-caption">ตัวอักษร <span role="status" aria-live="polite" aria-atomic="true"><span className="ui-sr-only">ขนาดปัจจุบัน </span><strong>{level}%</strong></span></span>
    <div className="text-size-buttons" role="group" aria-label="เลือกระดับขนาดตัวอักษร">
      <Button variant="secondary" aria-label="ลดขนาดตัวอักษร" title="ลดขนาดตัวอักษร" disabled={index === 0} onClick={() => change(levels[index - 1])}>ก−</Button>
      <Button variant="ghost" aria-label="ขนาดปกติ" aria-pressed={level === 100} onClick={() => change(100)}><span className="text-size-reset-full">ขนาดปกติ</span><span className="text-size-reset-short" aria-hidden="true">ปกติ</span></Button>
      <Button variant="secondary" aria-label="เพิ่มขนาดตัวอักษร" title="เพิ่มขนาดตัวอักษร" disabled={index === levels.length - 1} onClick={() => change(levels[index + 1])}>ก+</Button>
    </div>
  </section>;
}
