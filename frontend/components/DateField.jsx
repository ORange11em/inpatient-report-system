"use client";

export function todayISO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function monthStartISO(value) {
  return value ? value.slice(0, 7) + "-01" : "";
}

export function thaiDateLabel(value) {
  if (!value) return "ยังไม่ได้เลือกวันที่";
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "";
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function DateField({ label, value, onChange, required = false }) {
  return (
    <label className="field">
      <span>{label}{required && <em> *</em>}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      <small className="field-help">
        {value ? "วันที่แสดงแบบไทย: " + thaiDateLabel(value) : "ส่งวันที่ไป API ในรูปแบบ Gregorian ISO"}
      </small>
    </label>
  );
}
