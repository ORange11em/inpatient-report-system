// Presentation calculations only. They do not change stored values or reporting formulas.
const paid = ["home", "move_b", "send", "dead", "non_voluntary"];
const count = (row, field) => Number(row[field] ?? 0);
export function closingCount(row, group = "pt") {
  return count(row, `${group}_on`) + count(row, `${group}_in`) + count(row, `${group}_move`) - paid.reduce((sum, key) => sum + count(row, `${group}_${key}`), 0);
}
export function dailySnapshot(entries, shifts, throughLegacy = Infinity) {
  const legacy = id => shifts.find(shift => shift.id === id)?.legacy_shift_id;
  const ordered = entries.filter(row => legacy(row.shift_type_id) <= throughLegacy).slice().sort((a, b) => legacy(a.shift_type_id) - legacy(b.shift_type_id));
  if (!ordered.length) return null;
  const last = ordered[ordered.length - 1];
  const closing = closingCount(last);
  const beds = last.amount_bed;
  return {
    latestShift: last.shift_type_id,
    latestLegacy: legacy(last.shift_type_id),
    closing,
    received: ordered.reduce((sum, row) => sum + count(row, "pt_in") + count(row, "pt_move"), 0),
    discharged: ordered.reduce((sum, row) => sum + paid.reduce((value, key) => value + count(row, `pt_${key}`), 0), 0),
    vacant: beds == null ? null : beds - closing,
    occupancy: beds > 0 ? closing * 100 / beds : null,
  };
}
export function sameShiftComparison(entries, shifts, latestShift) {
  const match = entries.find(row => row.shift_type_id === latestShift);
  const limit = shifts.find(shift => shift.id === latestShift)?.legacy_shift_id;
  return match && limit ? dailySnapshot(entries, shifts, limit) : null;
}
export function wardCompletion(entries, wards, shifts) {
  const ids = shifts.filter(shift => shift.is_active).map(shift => shift.id);
  if (!ids.length) return null;
  const completed = wards.filter(ward => ids.every(id => entries.some(row => row.ward_id === ward.id && row.shift_type_id === id && row.status === "confirmed")));
  return { total: wards.length, complete: completed.length, missing: wards.filter(ward => !completed.includes(ward)) };
}
