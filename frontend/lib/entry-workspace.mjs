import { closingCount } from "./dashboard.mjs";

const flow = ["on", "in", "move", "home", "move_b", "send", "dead", "non_voluntary"];
const number = value => value === "" || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
export function changedFields(values, baseline) {
  return Object.keys(baseline).filter(key => String(values[key] ?? "") !== String(baseline[key] ?? ""));
}

export function entryReview(values) {
  const closing = Object.fromEntries(["pt", "nb"].map(group => [group, flow.every(key => number(values[`${group}_${key}`]) != null) ? closingCount(values, group) : null]));
  const types = [1, 2, 3, 4, 5].map(type => number(values[`patient_type${type}`]));
  const typeTotal = types.every(value => value != null) ? types.reduce((sum, value) => sum + value, 0) : null;
  const beds = number(values.amount_bed);
  const warnings = [];
  for (const group of ["pt", "nb"]) {
    if (closing[group] != null && closing[group] < 0) warnings.push({ key: group, text: `ยอดคงเหลือ ${group.toUpperCase()} ติดลบ กรุณาตรวจยอดรับและจำหน่าย`, field: `${group}_on` });
    if (beds > 0 && closing[group] > beds) warnings.push({ key: `${group}-beds`, text: `ยอดคงเหลือ ${group.toUpperCase()} เกินจำนวนเตียง กรุณาตรวจสอบ`, field: "amount_bed" });
  }
  if (typeTotal != null && closing.pt != null && typeTotal !== closing.pt) warnings.push({ key: "types", text: "ผลรวมประเภทผู้ป่วยต่างจากยอดคงเหลือ PT กรุณาตรวจสอบ", field: "patient_type5" });
  return { closing, typeTotal, beds, warnings };
}

export const DRAFT_PREFIX = "inpatient-entry-draft:v1:";
export const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export function draftScope(userId, selection) {
  if (!userId || !selection.ward_id || !selection.service_date || !selection.shift_type_id) return "";
  return DRAFT_PREFIX + [userId, selection.ward_id, selection.service_date, selection.shift_type_id].map(encodeURIComponent).join(":") + ":";
}
export function draftKey(scope, entry) { return scope ? `${scope}${encodeURIComponent(entry?.id || "new")}:${entry?.version ?? "new"}` : ""; }
export function makeDraft(key, baseline, values, now = Date.now()) { return { schema: 1, key, baseline, values, savedAt: now }; }
export function readDraft(raw, key, baseline, now = Date.now()) {
  try {
    const draft = JSON.parse(raw);
    if (!draft || draft.schema !== 1 || draft.key !== key || !Number.isFinite(draft.savedAt) || now - draft.savedAt > DRAFT_MAX_AGE || draft.savedAt > now + 60000) return { status: "invalid" };
    const keys = Object.keys(baseline).sort();
    if (!draft.values || !draft.baseline || JSON.stringify(Object.keys(draft.values).sort()) !== JSON.stringify(keys) || JSON.stringify(Object.keys(draft.baseline).sort()) !== JSON.stringify(keys)) return { status: "invalid" };
    if (keys.some(key => !["string", "number"].includes(typeof draft.values[key]) || String(draft.values[key]).length > 64 || (draft.values[key] !== "" && !Number.isFinite(Number(draft.values[key]))))) return { status: "invalid" };
    if (changedFields(draft.baseline, baseline).length) return { status: "stale", savedAt: draft.savedAt };
    return { status: "ready", values: draft.values, savedAt: draft.savedAt };
  } catch { return { status: "invalid" }; }
}

export const monthlyLabels = {
  readmit_count: "กลับมารักษาซ้ำด้วยโรคหรืออาการเดิมภายใน 28 วันหลังจำหน่าย",
  discharge_count: "จำนวนผู้ป่วยที่จำหน่ายทั้งหมดในเดือนก่อนหน้า",
};
