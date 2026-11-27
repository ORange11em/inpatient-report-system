export const WARD_PREFERENCE_KEY = "inpatient-preferred-ward";
export function preferredWard(wards) {
  try { const saved = window.localStorage.getItem(WARD_PREFERENCE_KEY); return wards.find(ward => ward.id === saved)?.id || ""; }
  catch { return ""; }
}
export function rememberWard(id) { try { window.localStorage.setItem(WARD_PREFERENCE_KEY, id); } catch { /* Preference storage is optional. */ } }

export const navigation = [
  { href: "/", label: "หน้าแรก", short: "หน้าแรก", icon: "home", group: "งานประจำวัน" },
  { href: "/entries", label: "บันทึกข้อมูลประจำวัน", short: "บันทึก", icon: "edit", group: "งานประจำวัน" },
  { href: "/history", label: "ตรวจสอบและยืนยันข้อมูล", short: "ประวัติ", icon: "history", group: "งานประจำวัน" },
  { href: "/history?status=unconfirmed", label: "รอยืนยันการส่งข้อมูล", short: "รอยืนยัน", icon: "checklist", group: "งานประจำวัน", pending: true },
  { href: "/indicators", label: "ตัวชี้วัดเสริม", short: "ตัวชี้วัด", icon: "activity", group: "ข้อมูลและรายงาน" },
  { href: "/reports", label: "รายงานผู้ป่วยใน", short: "รายงาน", icon: "report", group: "ข้อมูลและรายงาน" },
  { href: "/occupancy", label: "อัตราการครองเตียง", short: "ครองเตียง", icon: "bed", group: "ข้อมูลและรายงาน" },
  { href: "/users", label: "จัดการผู้ใช้และสิทธิ์", short: "ผู้ใช้", icon: "users", group: "การจัดการระบบ", adminOnly: true },
  { href: "/admin/master", label: "จัดการหอผู้ป่วยและเวร", short: "ตั้งค่า", icon: "settings", group: "การจัดการระบบ", adminOnly: true },
];
export function pageContext(pathname, search = "") {
  const pending = pathname === "/history" && new URLSearchParams(search).get("status") === "unconfirmed";
  return navigation.find(item => pending ? item.pending : item.href === pathname) || navigation[0];
}
