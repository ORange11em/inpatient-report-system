export function entryFormHref(row) {
  return "/entries?" + new URLSearchParams({ ward: row.ward_id, date: row.service_date, shift: row.shift_type_id });
}
export function entryAccess(row, ward, user) {
  const confirmed = row.status === "confirmed";
  return { editable: !confirmed && Boolean(ward?.can_write), confirmable: !confirmed && Boolean(ward?.can_write), returnable: confirmed && Boolean(user?.is_admin) };
}
export function historyStatusCountsPath({ ward_id, date_from, date_to }) {
  const query = new URLSearchParams();
  if (ward_id) query.set("ward_id", ward_id);
  if (date_from) query.set("date_from", date_from);
  if (date_to) query.set("date_to", date_to);
  return "/entries/status-counts" + (query.size ? "?" + query : "");
}
export function groupEntriesByDate(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.service_date)) groups.set(row.service_date, []);
    groups.get(row.service_date).push(row);
  }
  return [...groups].map(([date, entries]) => ({ date, entries }));
}
