/** Presentation helpers. Date-only values stay Gregorian ISO; never parse them in local time. */
export const THAI_LOCALE = "th-TH-u-ca-buddhist-nu-latn";
export const THAI_TIME_ZONE = "Asia/Bangkok";
const pad = value => String(value).padStart(2, "0");

export function parseISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function toISODate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  const year = date.getUTCFullYear();
  return year > 0 && year <= 9999 ? `${String(year).padStart(4, "0")}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` : "";
}

export function todayISO(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: THAI_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = name => parts.find(part => part.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDaysISO(value, days) {
  const date = parseISODate(value);
  if (!date || !Number.isInteger(days)) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function monthStartISO(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value) || (value.length === 10 && !parseISODate(value))) return "";
  const month = typeof value === "string" ? value.slice(0, 7) : "";
  return parseISODate(`${month}-01`) ? `${month}-01` : "";
}

export function parseThaiDate(value) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/[๐-๙]/g, digit => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit));
  let year, month, day;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (!match) return null;
    [, day, month, year] = match;
  }
  year = Number(year);
  if (year >= 2400) year -= 543;
  const iso = `${String(year).padStart(4, "0")}-${pad(Number(month))}-${pad(Number(day))}`;
  return parseISODate(iso) ? iso : null;
}

export function thaiDateInput(value) {
  const date = parseISODate(value);
  return date ? `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear() + 543}` : "";
}

export function formatThaiDate(value, { month = "short", year = "numeric" } = {}) {
  const date = parseISODate(value);
  return date ? new Intl.DateTimeFormat(THAI_LOCALE, { timeZone: "UTC", day: "numeric", month, year }).format(date) : "—";
}

export function formatThaiMonth(value, { short = false, shortYear = false } = {}) {
  const date = parseISODate(monthStartISO(value));
  return date ? new Intl.DateTimeFormat(THAI_LOCALE, { timeZone: "UTC", month: short ? "short" : "long", year: shortYear ? "2-digit" : "numeric" }).format(date) : "—";
}

export function formatThaiTime(value) {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    const [hour, minute] = value.split(":").map(Number);
    return hour < 24 && minute < 60 ? `${pad(hour)}:${pad(minute)} น.` : "—";
  }
  // A timestamp must include an explicit zone. A date-only string is not an instant.
  if (typeof value === "string" && !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return "—";
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("th-TH-u-nu-latn", { timeZone: THAI_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date) + " น." : "—";
}

export function formatThaiNumber(value, { digits = 0, percent = false } = {}) {
  if (value === null || value === undefined || value === "" || !["number", "string"].includes(typeof value) || !Number.isFinite(Number(value))) return "—";
  const places = percent ? 1 : digits;
  return new Intl.NumberFormat("th-TH-u-nu-latn", { minimumFractionDigits: places, maximumFractionDigits: places }).format(Number(value)) + (percent ? "%" : "");
}

/** Fiscal year is a Buddhist year in the UI. Conversion happens only at the boundary. */
export function fiscalYearForDate(value) {
  const date = parseISODate(value);
  return date ? date.getUTCFullYear() + 543 + (date.getUTCMonth() >= 9 ? 1 : 0) : null;
}

export function fiscalYearRange(buddhistYear) {
  if (!Number.isInteger(buddhistYear) || buddhistYear < 2400 || buddhistYear > 9999) return null;
  const endYear = buddhistYear - 543;
  return { from: `${endYear - 1}-10-01`, to: `${endYear}-09-30` };
}

export function formatFiscalYear(year) {
  const range = fiscalYearRange(year);
  return range ? `ปีงบประมาณ ${year} (${formatThaiMonth(range.from)} – ${formatThaiMonth(range.to)})` : "—";
}

export function dateRangePreset(preset, anchor = todayISO()) {
  const start = monthStartISO(anchor);
  if (!start || !parseISODate(anchor)) return null;
  if (preset === "last7") return { from: addDaysISO(anchor, -6), to: anchor };
  const next = parseISODate(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (preset === "month") return { from: start, to: addDaysISO(toISODate(next), -1) };
  if (preset === "previousMonth") {
    const end = addDaysISO(start, -1);
    return { from: monthStartISO(end), to: end };
  }
  return null;
}
