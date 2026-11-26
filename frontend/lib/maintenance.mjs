export const HOSPITAL_DISPLAY_NAME = "โรงพยาบาลอากาศอำนวย";
export const SYSTEM_DISPLAY_NAME = "ระบบรายงานจำนวนผู้ป่วยใน";

export function isMaintenanceModeEnabled(rawValue = process.env.NEXT_PUBLIC_MAINTENANCE_MODE) {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "on"].includes(normalized);
}

export function getMaintenanceContent(options = {}) {
  const customNote = String(options.note ?? process.env.NEXT_PUBLIC_MAINTENANCE_NOTE ?? "").trim();
  return {
    hospitalName: HOSPITAL_DISPLAY_NAME,
    systemName: SYSTEM_DISPLAY_NAME,
    badgeLabel: "แจ้งปิดปรับปรุงชั่วคราว",
    title: "แจ้งปิดปรับปรุงระบบชั่วคราว",
    description:
      "ขณะนี้ระบบกำลังอยู่ระหว่างการปรับปรุงและตรวจสอบความถูกต้องของข้อมูล เพื่อความต่อเนื่องในการปฏิบัติงานของหอผู้ป่วย กรุณาเว้นช่วงการใช้งานชั่วคราวและลองเข้าใหม่อีกครั้งในภายหลัง",
    guidance:
      customNote ||
      "กรุณารอสักครู่แล้วกด “ลองเข้าใช้งานอีกครั้ง” หากมีเรื่องเร่งด่วนสามารถติดต่อศูนย์คอมพิวเตอร์หรือผู้ดูแลระบบของโรงพยาบาลได้โดยตรง",
    contactLabel: "ศูนย์คอมพิวเตอร์ โรงพยาบาลอากาศอำนวย",
  };
}
