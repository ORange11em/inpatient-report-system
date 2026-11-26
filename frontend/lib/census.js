export const flowFields = [
  ["on", "คงพยาบาล", "วานนี้"], ["in", "การรับ", "รับใหม่"], ["move", "การรับ", "รับย้าย"],
  ["home", "จำหน่าย", "กลับบ้าน"], ["move_b", "จำหน่าย", "ย้ายตึก"], ["send", "จำหน่าย", "ส่งต่อ"],
  ["dead", "จำหน่าย", "ตาย"], ["non_voluntary", "จำหน่าย", "ไม่สมัครใจอยู่"]
];
export const types = [5, 4, 3, 2, 1];
export const staff = ["HN", "RN", "TN", "PN", "AID"];
export const specialties = ["obs","nb","gyn","surg","med","psych","skin","ped","ortho","eye","ent","dent","neuro_surg"];
export const groups = ["pt", "nb"];
export const countFields = [
  ...groups.flatMap(group => [...flowFields.map(([code]) => code), "ad"].map(code => group + "_" + code)),
  ...types.map(i => "patient_type" + i), ...staff.map(s => "em_" + s.toLowerCase())
];

export function patientDays(values, group) {
  const count = key => Number(values[group + "_" + key] || 0);
  const paid = ["home", "move_b", "send", "dead", "non_voluntary"].reduce((sum, key) => sum + count(key), 0);
  return count("on") + count("in") + count("move") - paid + count("ad");
}
