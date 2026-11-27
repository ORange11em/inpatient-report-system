export class ApiError extends Error {
  constructor(status, detail) {
    super("API request failed");
    this.status = status;
    this.detail = detail;
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.csrfToken) headers.set("X-CSRF-Token", options.csrfToken);

  const response = await fetch("/api/v1" + path, {
    method: options.method || "GET",
    credentials: "include",
    cache: "no-store",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new ApiError(response.status, data && (data.code || data.detail));
  return data;
}

const messages = {
  readmission_changed: "ข้อมูลการกลับมารักษาซ้ำเดือนนี้ถูกแก้ไขแล้ว กรุณาเปิดรายการอีกครั้งก่อนบันทึก",
  afternoon_entry_required: "กรุณาบันทึกเวรบ่ายของวันที่เลือกก่อน หากยืนยันแล้วให้ผู้ดูแลส่งกลับแก้ไข",
  afternoon_fields_only: "ข้อมูลแยกสาขาและแผลกดทับบันทึกได้ในเวรบ่าย",
  bed_count_required: "กรุณาระบุจำนวนเตียง",
  authentication_required: "หมดเวลาใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง",
  csrf_validation_failed: "การยืนยันคำขอหมดอายุ กรุณาโหลดหน้าใหม่",
  ward_access_denied: "บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลหอผู้ป่วยที่เลือก",
  ward_write_denied: "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลหอผู้ป่วยที่เลือก",
  daily_entry_already_exists: "รายการนี้มีอยู่แล้ว กรุณาเปิดรายการเดิมจากประวัติ",
  confirmed_entry_is_read_only: "รายการยืนยันแล้ว แก้ไขไม่ได้",
  entry_version_conflict: "รายการถูกเปลี่ยนจากหน้าต่างอื่น กรุณาโหลดข้อมูลใหม่",
  entry_state_or_version_conflict: "สถานะรายการเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่",
  occupancy_rules_not_approved: "ยังไม่เปิดคำนวณอัตราการครองเตียง เพราะรอยืนยันสูตรและฐานจำนวนเตียง",
  capacity_period_overlap: "ช่วงวันที่ความจุเตียงซ้อนกับช่วงที่บันทึกไว้",
  shift_mapping_missing_or_inactive: "ยังไม่มีประเภทเวรที่จับคู่กับรหัสนี้",
  ward_mapping_missing_or_inactive: "ยังไม่มีหอผู้ป่วยที่จับคู่กับรหัสนี้",
  invalid_current_password: "รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
  password_policy_violation: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ตัวพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว และอักษรพิเศษอย่างน้อย 1 ตัว",
  username_or_role_already_exists: "ชื่อบัญชีนี้มีอยู่แล้ว หรือมีการกำหนดสิทธิ์หอผู้ป่วยซ้ำกัน",
  user_not_found: "ไม่พบบัญชีผู้ใช้ที่ต้องการ",
  cannot_modify_own_admin_access: "ไม่สามารถปิดใช้งานหรือถอดสิทธิ์ผู้ดูแลระบบของบัญชีที่กำลังใช้งานอยู่ได้",
  system_admin_required: "หน้านี้สำหรับผู้ดูแลระบบเท่านั้น",
  ward_not_found_or_inactive: "ไม่พบหอผู้ป่วยที่เลือก หรือหอผู้ป่วยถูกปิดใช้งาน",
  ward_code_already_exists: "รหัสหอผู้ป่วยนี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น",
  shift_code_or_legacy_id_already_exists: "รหัสเวรนี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น",
  shift_not_found: "ไม่พบข้อมูลประเภทเวรที่ต้องการแก้ไข",
  capacity_date_order_invalid: "วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มใช้งาน"
};

export function getErrorMessage(error, fallback = "ทำรายการไม่สำเร็จ กรุณาลองใหม่") {
  if (error && error.status === 401) return messages.authentication_required;
  if (error && error.status === 403 && error.detail === "ward_access_denied") return messages.ward_access_denied;
  if (error && error.status === 403 && error.detail === "ward_write_denied") return messages.ward_write_denied;
  if (error && error.status === 403 && error.detail === "system_admin_required") return messages.system_admin_required;
  if (error && typeof error.detail === "string" && messages[error.detail]) return messages[error.detail];
  if (error && Array.isArray(error.detail)) {
    const joined = error.detail.map(item => String(item?.msg || "")).join(" ");
    if (joined.includes("password_policy_violation")) return messages.password_policy_violation;
  }
  if (error && error.status === 422) return "ข้อมูลไม่ผ่านการตรวจ กรุณาตรวจช่องที่กรอกแล้วลองอีกครั้ง";
  if (error && error.status === 409) return "ข้อมูลขัดแย้งกับรายการที่บันทึกไว้ กรุณาโหลดข้อมูลใหม่";
  if (error && error.status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง";
  return fallback;
}
