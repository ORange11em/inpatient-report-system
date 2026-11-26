export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;
export const PASSWORD_SPECIAL_PATTERN = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

export function evaluatePasswordPolicy(password = "") {
  const value = String(password);
  const minLength = value.length >= PASSWORD_MIN_LENGTH;
  const maxLength = value.length <= PASSWORD_MAX_LENGTH;
  const hasUppercase = /[A-Z]/.test(value);
  const hasSpecial = PASSWORD_SPECIAL_PATTERN.test(value);
  const rules = [
    { key: "minLength", label: "ความยาวอย่างน้อย 8 ตัวอักษร", passed: minLength },
    { key: "hasUppercase", label: "มีตัวอักษรพิมพ์ใหญ่ (A–Z) อย่างน้อย 1 ตัว", passed: hasUppercase },
    { key: "hasSpecial", label: "มีอักษรพิเศษอย่างน้อย 1 ตัว (เช่น ! @ # $ % & * _ -)", passed: hasSpecial },
  ];
  return {
    minLength,
    maxLength,
    hasUppercase,
    hasSpecial,
    valid: minLength && maxLength && hasUppercase && hasSpecial,
    rules,
  };
}

export const GLOBAL_ROLE_OPTIONS = [
  { value: "", label: "ไม่มีสิทธิ์ระดับระบบ (กำหนดตามหอผู้ป่วย)" },
  { value: "system_admin", label: "ผู้ดูแลระบบ — เข้าถึงและจัดการได้ทุกหอผู้ป่วย" },
  { value: "auditor", label: "ผู้ตรวจสอบ — บทบาทตรวจสอบระดับระบบ" },
];

export const WARD_ROLE_OPTIONS = [
  { value: "ward_recorder", label: "ผู้บันทึกประจำหอ" },
  { value: "report_reader", label: "ผู้ดูรายงาน" },
];

export const ROLE_LABELS = {
  system_admin: "ผู้ดูแลระบบ",
  auditor: "ผู้ตรวจสอบ",
  ward_recorder: "ผู้บันทึกประจำหอ",
  report_reader: "ผู้ดูรายงาน",
};

export const ROLE_GUIDE = [
  {
    code: "system_admin",
    title: "ผู้ดูแลระบบ",
    scope: "ทั้งระบบ",
    description: "เข้าถึง บันทึก แก้ไข และยืนยันได้ทุกหอผู้ป่วย ส่งกลับรายการที่ยืนยันแล้ว ดูรายงานสำมะโน จัดการข่าวประกาศ และจัดการบัญชีผู้ใช้",
  },
  {
    code: "ward_recorder",
    title: "ผู้บันทึกประจำหอ",
    scope: "รายหอผู้ป่วย",
    description: "บันทึก แก้ไข และยืนยันข้อมูลประจำวันและตัวชี้วัด รวมถึงดูประวัติและรายงานเฉพาะหอผู้ป่วยที่ได้รับมอบหมาย",
  },
  {
    code: "report_reader",
    title: "ผู้ดูรายงาน",
    scope: "รายหอผู้ป่วย",
    description: "ดูข้อมูลประวัติ ตัวชี้วัด และรายงานเฉพาะหอผู้ป่วยที่ได้รับมอบหมายแบบอ่านอย่างเดียว ไม่สามารถบันทึกหรือแก้ไขได้",
  },
  {
    code: "auditor",
    title: "ผู้ตรวจสอบ",
    scope: "บทบาทระดับระบบ",
    description: "บทบาทตรวจสอบระดับระบบ หากต้องการให้ดูข้อมูลหอผู้ป่วยใด กรุณากำหนดสิทธิ์ผู้ดูรายงานในหอผู้ป่วยนั้นร่วมด้วย",
  },
];

export function summarizeUserRoles(user, wardMap = new Map()) {
  const globalLabel = user?.global_role ? ROLE_LABELS[user.global_role] || user.global_role : "—";
  if (user?.global_role === "system_admin") {
    return {
      globalLabel,
      wardSummary: "ทุกหอผู้ป่วย (สิทธิ์ผู้ดูแลระบบ)",
      wardItems: [],
    };
  }
  const wardItems = (user?.ward_roles || []).map(item => {
    const ward = wardMap.get(item.ward_id);
    return {
      key: `${item.ward_id}:${item.role_code}`,
      wardId: item.ward_id,
      wardName: ward?.name || "หอผู้ป่วยไม่ทราบชื่อ",
      wardShortName: ward?.short_name || null,
      roleCode: item.role_code,
      roleLabel: ROLE_LABELS[item.role_code] || item.role_code,
    };
  });
  return {
    globalLabel,
    wardSummary: wardItems.length ? wardItems.map(item => `${item.wardName} (${item.roleLabel})`).join(", ") : "ยังไม่ได้กำหนดหอผู้ป่วย",
    wardItems,
  };
}
