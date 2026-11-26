# เฟส 3a — บันทึกประจำวัน: บริบท โครงฟอร์ม และ layout

อัปเดต 19 พฤศจิกายน 2569 ทำเฉพาะ presentation ของ `/entries` ยังไม่ทำพฤติกรรมกรอกขั้นถัดไป เช่น draft, hotkey, auto-load, คำเตือนยอด หรือเปลี่ยน validation/การบันทึก

## สิ่งที่เปลี่ยน

- แถบบริบทใช้ Select, ThaiDatePicker และ ShiftSelector กลาง เปิดแบบฟอร์มด้วยปุ่มเดิมที่เปลี่ยนชื่อเป็น “เปิดแบบฟอร์ม” ไม่เพิ่ม GET และไม่โหลดเมื่อเปลี่ยนตัวเลือก
- บนจอเล็กแสดงหอ/เวร/วัน พ.ศ. แบบย่อ ปุ่มเปลี่ยนเปิด shared BottomSheet; บนจอใหญ่แถบย่อเมื่อเลื่อน และปุ่มเปลี่ยนพากลับส่วนเลือกบริบท
- หัวฟอร์มแสดงสถานะจริง โหมดสร้างใหม่/แก้ไข/อ่านอย่างเดียว และแหล่งยกยอดตาม `source_date/source_shift_id` ที่บริการส่ง ไม่เปลี่ยนเป็นคำว่าเวรก่อนหน้าโดยไม่มีหลักฐาน
- แยกส่วนยกมา การรับ การจำหน่าย A&D ประเภทผู้ป่วย เตียง เจ้าหน้าที่ สาขา แผลกดทับ และข้อมูลรายเดือนร่วม โดยใช้ Card/StatusBadge/Legend/InfoCallout/StickyActionBar จากเฟส 1
- ปุ่มโหมดกรอกบนมือถือซ่อน bottom nav และมีปุ่มกลับสู่เมนูหลัก ปุ่มบันทึก/ยืนยันยังเรียก handler เดิมและใช้เงื่อนไข disabled เดิม
- วันที่ใหม่บนจอใช้ util กลางเป็น พ.ศ.; ค่าที่เก็บใน selection และส่งยังเป็น ISO
- แต่ละ field มี input ใน DOM เพียงหนึ่งตัว ไม่สร้างฟอร์ม desktop/mobile ซ้ำ เมื่อ resize หรือพับส่วนข้อมูล ค่าไม่ถูกล้าง

ไม่พบชื่อ `screenshots/02-daily-entry.png` ตอนเริ่ม แต่มีภาพบันทึกประจำวันเดิม `Screenshot 2026-11-19 144348.png` จึงตรวจจากภาพนั้นและทำสำเนาเป็น [02-daily-entry.png](screenshots/02-daily-entry.png) ให้ชื่ออ้างอิงตรงกัน โดยเก็บต้นฉบับเดิมไว้

## Layout ตามพื้นที่ฟอร์มจริง

ใช้ named container query `daily-entry` ไม่ใช้ viewport อย่างเดียว เพราะ sidebar ย่อ/ขยายได้

| พื้นที่ฟอร์ม | รูปแบบ | ขนาด viewport ที่ตรวจ |
| --- | --- | --- |
| ต่ำกว่า 600px | accordion หนึ่งคอลัมน์ พร้อมยอดย่อ PT/NB และแยกช่องคู่ | 360px |
| 600–999px | การ์ดสองคอลัมน์ แถวชื่อรายการ + PT/NB | 768px, 1024px |
| ตั้งแต่ 1000px | กริดตารางกลุ่มยกมา/รับ/จำหน่าย และกริดประเภท/เตียง/เจ้าหน้าที่ | 1440px |

ทุกขนาดไม่เกิด page overflow ช่องตัวเลขสูงอย่างน้อย 44px ฟอนต์ 16px ช่องที่แคบที่สุดที่ตรวจได้กว้าง 55px บนจอกว้าง; controls ของแถบบริบทและ disclosure ใช้งานด้วยคีย์บอร์ดได้ การปิด accordion ไม่เปลี่ยน required/min/max/step และจะเปิดส่วนที่มีช่องไม่ผ่าน validation ก่อน browser ย้ายโฟกัส

ตัวเลขยังใช้ native input `type=number` เดิม เพิ่มเฉพาะ class `ui-input ui-number` เพื่อใช้ foundation styling ไม่เปลี่ยนเป็น NumberInput แบบกรองข้อความในเฟสนี้ เพราะต้องคงการรับค่าและ validation เดิมทั้งหมด

## ยืนยันว่าข้อมูลส่งทุก field ยังเหมือนเดิม

ตรวจสองระดับ: เทียบซอร์สที่ทำงานเดิมทุกตัวอักษร และจับคำขอจาก browser ก่อนแก้แล้วรันข้อมูลสมมติชุดเดียวกันหลังแก้ เปรียบเทียบแบบ deep equality ทั้ง method/path/query, ชื่อ key, ชนิดค่า, ค่า 0/ว่าง/null, ลำดับ array และ CSRF ไม่ใช่เทียบเพียงจำนวน key

### ช่องหลัก 29 ช่อง — ชื่อและการแปลงเดิมทั้งหมด

| กลุ่ม | field ที่ส่งก่อนและหลังเหมือนกัน | จำนวน |
| --- | --- | --- |
| PT | `pt_on`, `pt_in`, `pt_move`, `pt_home`, `pt_move_b`, `pt_send`, `pt_dead`, `pt_non_voluntary`, `pt_ad` | 9 |
| NB | `nb_on`, `nb_in`, `nb_move`, `nb_home`, `nb_move_b`, `nb_send`, `nb_dead`, `nb_non_voluntary`, `nb_ad` | 9 |
| ประเภทผู้ป่วย | `patient_type5`, `patient_type4`, `patient_type3`, `patient_type2`, `patient_type1` | 5 |
| เตียง | `amount_bed` | 1 |
| เจ้าหน้าที่ | `em_hn`, `em_rn`, `em_tn`, `em_pn`, `em_aid` | 5 |

`countFields` 28 ตัวและ `amount_bed` ยังคงสร้างด้วย `Number(values[key])` ใน `save` เดิม ไม่เปลี่ยน default หรือสูตร `patientDays` ช่องหลักทั้งหมด required, min 0 ยกเว้นเตียง min 1, max 2147483647 และ step 1 เหมือนเดิม

### ช่องเพิ่มเติมและข้อมูลประกอบ — เงื่อนไขเดิมทั้งหมด

| รายการ | ก่อนและหลัง |
| --- | --- |
| `specialties` | ส่งเฉพาะเวรที่ `legacy_shift_id === 3`; 13 รหัส × 2 ห้อง = 26 ค่า แต่ละสมาชิกยังมี `specialty_code`, `category_code`, `count_value: Number(...)` |
| รหัสสาขา | `obs`, `nb`, `gyn`, `surg`, `med`, `psych`, `skin`, `ped`, `ortho`, `eye`, `ent`, `dent`, `neuro_surg` ครบและเรียงตาม `specialties` เดิม |
| ประเภทห้อง | `n` และ `s` ตามลำดับเดิมใน array ส่ง แม้จัดช่องบนจอใหม่เป็นคู่ต่อสาขา |
| `pressure` | เฉพาะเวรบ่ายเหมือนเดิม: `stage2_4_cases`, `at_risk_patient_days` เป็นตัวเลขทั้งคู่ รวมกรณี 0 |
| `readmission` | `readmit_count`, `discharge_count` ยัง optional ในช่องกรอก; ส่งคู่เมื่อมีค่าและเปลี่ยนจากเดือนเดิม ตามเงื่อนไขเดิมเท่านั้น |
| `previous_readmission` | ส่ง snapshot `context.readmission` คู่กับการแก้รายเดือนเหมือนเดิม รวม null เมื่อเดิมไม่มีข้อมูล ไม่สร้าง version รายเดือนใหม่ |
| สร้างใหม่ | `POST /entries` ยังเพิ่ม `ward_id`, `service_date` ISO และ `shift_type_id: shift.id` ที่เป็นตัวเลข ไม่ใช้ legacy id แทน primary key |
| แก้ไข | `PATCH /entries/{entry.id}` ยังเพิ่ม `expected_version: entry.version` และไม่เพิ่ม ward/date/shift ลง PATCH เอง |
| ยืนยัน | `POST /entries/{entry.id}/confirm` ยังส่งเฉพาะ `{ expected_version: entry.version }` |
| Headers/event/สิทธิ์ | CSRF, `inpatient-entries-changed`, `readonly = !ward.can_write || confirmed`, เงื่อนไข dirty/busy และ window.confirm เดิมไม่เปลี่ยน |

รวม input ใน DOM: ดึก/เช้า **31** = หลัก 29 + รายเดือน 2; บ่าย **59** = หลัก 29 + สาขา 26 + แผลกดทับ 2 + รายเดือน 2 แต่ข้อมูลส่งมี nested objects/array ตามสัญญาเดิม ไม่ส่ง input ทั้งหมดเป็นชุดใหม่

### ผลเทียบคำขอจริงจาก browser ที่ใช้ข้อมูลสมมติ

| กรณี | จำนวน input | ผลก่อน–หลัง |
| --- | --- | --- |
| สร้างเวรดึก ไม่กรอกเดือน | 31 | POST ตรงกัน 32 top-level keys ไม่มี readmission/pressure/specialties |
| สร้างเวรเช้า กรอกเดือน | 31 | POST ตรงกัน 34 keys รวม previous_readmission null |
| สร้างเวรบ่าย กรอกเดือน | 59 | POST ตรงกัน 36 keys รวม nested specialties/pressure/readmission |
| แก้เวรเช้า เดือนเดิมไม่เปลี่ยน | 31 | PATCH ตรงกัน 30 keys; ยืนยันส่ง expected_version หลังบันทึกเหมือนเดิม |
| แก้เวรบ่าย เปลี่ยนเดือน | 59 | PATCH ตรงกัน 34 keys; ยืนยันตรงกัน |
| แก้เวรบ่าย เดือนเดิมไม่เปลี่ยน | 59 | PATCH ตรงกัน 32 keys ไม่ส่ง readmission ซ้ำ; ยืนยันตรงกัน |
| รายการยืนยันแล้ว | 59 | ช่อง disabled ทั้งหมด ไม่มีปุ่มบันทึก/ไม่มีคำขอเขียน |
| บัญชีอ่านอย่างเดียว | 31 | ช่อง disabled ทั้งหมด ไม่มีปุ่มบันทึก/ไม่มีคำขอเขียน |

หลักฐานข้อมูลสมมติ: [คำขอก่อนแก้](screenshots/phase-3a/request-before.json), [คำขอหลังแก้และผลเทียบ](screenshots/phase-3a/request-comparison.json) และ [hash ส่วนโค้ดที่ต้องคงเดิม](screenshots/phase-3a/protected-source.json)

`initialValues`, ส่วน state/init/select/open, `save` และ `confirmEntry` ตรงกับซอร์สก่อนเริ่มทุกตัวอักษร ส่วน `input` ต่างเฉพาะ CSS class เท่านั้น ฟังก์ชันสร้าง body, การแปลงตัวเลข, previous_readmission และ expected_version ไม่ถูกแก้

## การทดสอบและไฟล์

- ตรวจ `/entries` ที่ 360/768/1024/1440px: mode compact/medium/medium/wide ตามตาราง ไม่ล้นแนวนอนและมีครบ 59 inputs ทุกขนาดในเวรบ่าย
- กรอกค่าแยกทุก field แล้วสลับทั้งสี่ขนาดก่อนบันทึก ค่าไม่หายและคำขอยังตรงต้นฉบับ
- มือถือเปิด bottom sheet ด้วยปุ่มเปลี่ยน, Esc/scroll lock และ resize ถึง tablet แล้วปิด/ปลดล็อกได้; โหมดกรอกซ่อนและคืน bottom nav ได้
- ช่องเตียงว่างใน accordion ที่ปิดทำให้ browser ไม่ส่งคำขอ และเปิดส่วนเตียงเพื่อแก้ไขได้ เงื่อนไข min/max/step/required ของช่องตัวเลขตรงก่อนแก้ทั้งหมด
- กรอก `20/11/2569` แล้วเลือกเวรเช้า ยังไม่โหลดแบบฟอร์มจนกดปุ่ม; GET เดิมส่ง `service_date=2026-11-20`, `shift_type_id=12` และหอเดิมใน fixture
- ใช้ Edge headless ผ่าน Playwright ที่มีใน runtime ทุกบริการถูก intercept ด้วยข้อมูลสมมติ ไม่มีการอ่านหรือเขียนข้อมูลผู้ป่วยจริง ผลนี้ไม่แทนการตรวจ backend จริงหรือ iPhone/คีย์บอร์ดจริง
- `npm run test:ui` ผ่าน 15/15; `npm run build` ผ่าน
- `npm run lint` ยังรันไม่ได้เพราะไม่มี script เดิม; `npx --no-install tsc --noEmit` ยังไม่มี compiler/config เดิม ไม่ติดตั้ง dependency เพิ่ม

ภาพเริ่มหน้า: [360](screenshots/phase-3a/daily-entry-360.png), [768](screenshots/phase-3a/daily-entry-768.png), [1024](screenshots/phase-3a/daily-entry-1024.png), [1440](screenshots/phase-3a/daily-entry-1440.png)

ภาพบริเวณช่องกรอก: [360 accordion](screenshots/phase-3a/daily-form-360.png), [768 การ์ด](screenshots/phase-3a/daily-form-768.png), [1024 การ์ด](screenshots/phase-3a/daily-form-1024.png), [1440 กริด](screenshots/phase-3a/daily-form-1440.png)

| ไฟล์ | การเปลี่ยน |
| --- | --- |
| `frontend/app/entries/page.js` | imports, class input และ JSX ส่วนแสดงผล; handler เดิมคงไว้ |
| `frontend/components/entries/EntryContextBar.jsx` | ตัวเลือกบริบท sticky/ย่อ/BottomSheet โดยเรียก select/open เดิม |
| `frontend/components/entries/EntryLayout.jsx` | layout observer, disclosure, field rows และโหมดกรอก เป็น state การแสดงผลเท่านั้น |
| `frontend/styles/entries.css` | named container queries, grid/cards/accordion และโหมดกรอก |
| `frontend/components/ui/primitives.jsx` | เพิ่ม optional required ให้ shared ShiftSelector ใช้ native radios เพื่อคง required validation ของตัวเลือกเวร; การใช้งานเดิมที่ไม่ส่ง required ไม่เปลี่ยน |
| `frontend/styles/foundation.css` | รูปแบบ native radios ของ ShiftSelector ด้วย tokens เดิม |
| `docs/ui-progress.md`, `docs/ui-phase-3a.md`, `docs/screenshots/` | สถานะ ขอบเขต ภาพ และหลักฐานเทียบข้อมูลสมมติ |

เทียบ SHA-256 กับ snapshot ก่อนเริ่ม: ไฟล์เดิม 214 ไฟล์ เปลี่ยนเฉพาะ 3 ไฟล์ frontend ตามตารางและ `docs/ui-progress.md` รวม 4 ไฟล์ อีก 210 ไฟล์ตรงกัน ไม่ลบไฟล์ และลิงก์เอกสารที่เพิ่ม/แก้ไม่มีลิงก์เสีย

ไม่แก้ backend, census, lib API, AuthProvider, routing, package/lock/config หรือส่วนสร้างข้อมูลส่ง ไม่มี dependency ใหม่

## เรื่องที่ค้างสำหรับขั้นถัดไป

ยังไม่แต่งชั่วโมงเวร/เวลาตัดรอบ (Q03/Q04), ชื่อผู้บันทึก/ผู้ยืนยัน (Q11), คำขยายรหัสและเกณฑ์พยาบาลที่ยังไม่อนุมัติ (Q05) หรือเปลี่ยนความหมายตัวหารรายเดือน (Q06) จึงใช้ชื่อเวร/รหัสและคำอธิบายที่ยืนยันได้เท่านั้น

Dirty guard, draft, hotkey/Enter, auto-load, คำเตือนยอด และทางลัดหลังบันทึก อยู่ในงานขั้นถัดไปและ Q10/Q12 ไม่เพิ่มล่วงหน้า การปรับค่าตั้งต้น/ยกยอดหรือสูตรยังคงต้องแยกจากงาน presentation
