# เฟส 0: Audit UX/UI และ Responsive

วันที่ตรวจ: 19 พฤศจิกายน 2569 · ขอบเขต: อ่านและทำเอกสารเท่านั้น · ยังไม่เริ่มเฟส 1

## 1. ขอบเขตและแหล่งหลักฐาน

- อ่าน [AGENTS.md](../../AGENTS.md) ครบ และอ่าน spec ต้นฉบับครบ 356 บรรทัด รวมทั้งข้อกำหนดชุดแรก ชุดหลัง A–E ข้อจำกัด และเกณฑ์ตรวจรับ
- เริ่มงานพบ spec ที่ `new-system/ui-spec.md`; ระหว่าง Audit พบว่าต้นฉบับถูกย้ายมาเป็น `new-system/docs/ui-spec.md` โดยเนื้อหาก่อนเติมข้อมูลตรงกัน (SHA-256 `641454796D4EE95AF81E9D2E88A10A9A3CFCD9216F6540DBF2574B788862DEBC`) การย้ายนี้ไม่ใช่การแก้ไขของ Audit
- ไม่พบ `ui-progress.md` ก่อนเริ่ม จึงสร้าง [ไฟล์ความคืบหน้า](ui-progress.md) สำหรับงานนี้ คำว่า `docs/` ในรายงานนี้หมายถึง `new-system/docs/`
- อ่านทุก route ของ Next.js: `/`, `/login`, `/entries`, `/history`, `/indicators`, `/reports`, `/occupancy`; เมนูรอยืนยันเป็น query ของ `/history` ไม่ใช่ route เพิ่ม
- อ่าน components ที่มีทั้งหมด 4 ไฟล์ (`AppShell`, `AuthProvider`, `DateField`, `ReportViewer`), `lib/api.js`, `lib/census.js`, `app/layout.js`, CSS ทั้งไฟล์, `package.json`, lockfile, `jsconfig.json`, Next config และ backend ที่รองรับสิทธิ์ ฟอร์ม ตัวชี้วัด และรายงาน
- โค้ดที่เป็นหลักฐานอยู่ใต้ `../frontend/` และ `../backend/`; ระบบ PHP ใต้ `../../inpatient/` เป็นระบบอ้างอิงเดิม ไม่ใช่เป้าหมายแก้ UX/UI ในรอบนี้ ไม่อ่านข้อมูลรายบุคคลจากฐานข้อมูลจริง
- ข้อความใน spec เป็นความต้องการ ส่วนข้อความ “ยืนยันได้” ในรายงานหมายถึงพฤติกรรม/โครงสร้างที่พบในซอร์ส ไม่ใช่การรับรองกฎทางการพยาบาลหรือค่าของระบบที่ติดตั้งจริง
- สถานะทดสอบ: ตรวจภาพเดสก์ท็อปเดิมและตรวจซอร์ส ยังไม่ได้เปิดใช้งานด้วยบัญชีจริงหรือทดสอบ browser ที่แต่ละความกว้าง ผล build แยกอยู่ท้ายรายงาน

## 2. ภาพหน้าจอทั้ง 6 ภาพ

เก็บสำเนาที่ได้รับไว้ใน `screenshots/` ชื่อเดิม ภาพทั้งหมดเป็นเดสก์ท็อป จึงใช้ยืนยันพฤติกรรมบนมือถือไม่ได้ และไม่ใช้ตัวเลขบนภาพเป็นข้อมูลสำหรับ mock

| ภาพ | หน้าหรือบริบทที่พบ | สิ่งที่สังเกตได้ |
| --- | --- | --- |
| [105342](screenshots/Screenshot%202026-11-19%20105342.png) | ตัวชี้วัดเสริม รุ่นเมนูเดิม 4 รายการ | ข้อความอังกฤษ/ศัพท์ระบบจำนวนมาก; วันที่ ค.ศ. สลับคำอธิบาย พ.ศ.; ปุ่มบันทึกจางโดยไม่มีเหตุผลกำกับ; footnote ยังอธิบายความสัมพันธ์แบบเก่า |
| [144348](screenshots/Screenshot%202026-11-19%20144348.png) | บันทึกข้อมูลประจำวัน `/entries` | ตารางตัวเลข 16 + 13 ช่อง; คำย่อไม่มีคำขยาย; เตียงและข้อมูลรายเดือนว่างต่างจากช่องอื่น; ปุ่มบันทึกอยู่ชิด/พ้นขอบล่างภาพ |
| [144406](screenshots/Screenshot%202026-11-19%20144406.png) | ประวัติ `/history` | เมนูกับชื่อหน้าไม่ตรง; ตัวกรอง 4 ช่องแต่กริด 3 คอลัมน์; empty state ไม่มีทางไปต่อ |
| [144415](screenshots/Screenshot%202026-11-19%20144415.png) | ตัวชี้วัดเสริม `/indicators` รุ่นเมนู 7 รายการ | หน้าเดียวกับภาพแรก แต่ footnote ล่าสุดตรงกับโค้ดมากกว่า: แผลกดทับผูกเวรบ่ายและรายเดือนใช้ร่วมกัน; ไม่ควรยึดภาพแรกเป็นกฎ |
| [144427](screenshots/Screenshot%202026-11-19%20144427.png) | รายงาน `/reports` ชนิดรายวัน | หัวผลลัพธ์เป็น ISO; พิมพ์/ส่งออกได้แม้ผลลัพธ์ไม่มีแถว; การจัดตัวกรองเหมือนหน้าประวัติ |
| [144441](screenshots/Screenshot%202026-11-19%20144441.png) | `/occupancy` ใช้รายงานร่วม | ชื่อหน้าเป็น “รายงานผู้ป่วยใน”; หัวเดือนเป็น ISO; ช่อง `0/93 เวร` ซ้ำ/ตัดบรรทัด; คอลัมน์ท้ายถูกจำกัดพื้นที่ |

ภาพทั้งหกมีหน้าตัวชี้วัดซ้ำ จึงครอบคลุมเนื้อหาต่างกัน 5 บริบท ไม่ได้มีภาพหน้าแรก หน้าเข้าสู่ระบบ หรือหน้ารอยืนยันโดยเฉพาะ วงกลม N เป็นตัวบอกโหมดพัฒนา ไม่ใช่ avatar ที่ต้องออกแบบใหม่

## 3. แผนที่เมนู → route → component → ฟังก์ชันเรียกข้อมูล

ทุก endpoint ในตารางยกเว้นที่ระบุเต็มจะมี prefix `/api/v1` ผ่าน [apiRequest](../frontend/lib/api.js) ซึ่งแนบ session cookie, `cache: no-store` และ CSRF header สำหรับคำขอที่มี `csrfToken`; [next.config.mjs](../frontend/next.config.mjs) rewrite ไป backend ต้องคง prefix วิธีส่ง และข้อมูลเดิม

| เมนู/หน้า | Route และไฟล์ | Component/ฟังก์ชันฝั่งหน้าเว็บ | คำขอและฟังก์ชันฝั่งบริการ |
| --- | --- | --- | --- |
| หน้าแรก / ข่าวประกาศ | `/` → [app/page.js](../frontend/app/page.js) | `HomePage`, effect โหลดข่าว, `save`, `remove`; ใช้ `AppShell`, `useAuth` | GET `/news` → `list_news`; POST `/news` → `add_news`; PUT/DELETE `/news/{id}?version=...` → `edit_news`/`remove_news` |
| บันทึกข้อมูลประจำวัน | `/entries` → [app/entries/page.js](../frontend/app/entries/page.js) | `EntriesPage`, effect `init`, `open`, `save`, `confirmEntry`; `DateField`; helpers จาก `lib/census.js` | GET `/wards` → `list_wards`; GET `/shifts?include_inactive=true` → `list_shifts`; GET `/entry-form?ward_id&service_date&shift_type_id` → `open_entry_form`; POST `/entries` → `create_entry`; PATCH `/entries/{id}` → `patch_entry`; POST `/entries/{id}/confirm` → `confirm_entry` |
| แก้ไข / ประวัติข้อมูล | `/history` → [app/history/page.js](../frontend/app/history/page.js) | `HistoryPage`, effect, `load(params,index)`, `action(row,confirm)`; `DateField` | GET หอ/เวรเหมือนหน้าบันทึก; GET `/entries?ward_id&date_from&date_to&status&offset&limit` → `list_entries`; POST `/entries/{id}/confirm` หรือ `/return` → `confirm_entry`/`return_entry`; แก้ไขผ่านลิงก์ `/entries?ward=...&date=...&shift=...` |
| รอยืนยันการส่งข้อมูล | `/history?status=unconfirmed` → ไฟล์ `history/page.js` เดิม | `HistoryPage` ตรวจ query ใน effect แล้วเรียก `load` อัตโนมัติ ล้างช่วงวันที่เพื่อโหลดทุกช่วงวัน; ปุ่มใช้ `action` เดิม | GET `/entries?status=unconfirmed&offset=0&limit=51`; badge มาจาก GET `/entries/pending-count` → `pending_count` ใน `AppShell` ไม่ใช่จำนวนแถวเฉพาะหน้าที่เห็น |
| ตัวชี้วัดเสริม | `/indicators` → [app/indicators/page.js](../frontend/app/indicators/page.js) | `IndicatorsPage`, effect โหลดหอ, `loadIndicators`, `savePressure`, `saveReadmission`, `validateCounts` | GET `/wards`; GET `/indicators/pressure/{ward}?date_from&date_to` → `list_pressure`; GET `/indicators/readmission/{ward}?month_from&month_to` → `list_readmission`; PUT `/indicators/pressure/{ward}/{date}` → `update_pressure`; PUT `/indicators/readmission/{ward}/{month}-01` → `update_readmission` |
| รายงานผู้ป่วยใน | `/reports` → [app/reports/page.js](../frontend/app/reports/page.js) | `ReportsPage` → [ReportViewer](../frontend/components/ReportViewer.jsx) (ค่าเริ่มต้น `daily`), effect โหลดหอ/เวร, `search`, `exportExcel` | GET `/wards`, `/shifts`; GET `/reports/summary/{kind}?selected&status&ward_id&shift_type_id&through` ตามชนิด → `summary_report` → `reports.build_report`; ถ้าเลือก occupancy ใช้ endpoint แถวถัดไป |
| อัตราครองเตียง | `/occupancy` → [app/occupancy/page.js](../frontend/app/occupancy/page.js) | `OccupancyPage` → `ReportViewer initialKind="occupancy"`, `search`, `occupancyTable`, `exportExcel`; ยังเปลี่ยนประเภทรายงานอื่นในหน้านี้ได้ | GET `/reports/occupancy?fiscal_year_end&status` → `occupancy_report` → `occupancy.compute_ward_series`/`compute_total_series`; ปีที่ส่งเป็น ค.ศ. |
| เข้าสู่ระบบ (ไม่มีในเมนู) | `/login` → [app/login/page.js](../frontend/app/login/page.js) | `LoginPage.submit`; ใช้ `fetch` โดยตรง แล้ว `AuthProvider.refresh` | POST `/api/v1/auth/login` → `login`; จากนั้น GET `/auth/me`, `/auth/csrf`; สำเร็จ `router.replace('/entries')` |

ฟังก์ชันบริการในตารางอยู่ใน [backend/app/api.py](../backend/app/api.py); สูตรและรายงานแยกอยู่ใน [reports.py](../backend/app/reports.py) และ [occupancy.py](../backend/app/occupancy.py)

### การเรียกที่ใช้ร่วมทุกหน้า

- [RootLayout](../frontend/app/layout.js) ครอบทุก route ด้วย [AuthProvider](../frontend/components/AuthProvider.jsx): effect/`refresh` เรียก GET `/auth/me` และ `/auth/csrf`; `logout` เรียก POST `/auth/logout`
- [AppShell](../frontend/components/AppShell.jsx) ครอบทุกหน้าหลังเข้าใช้; effect `load` เรียก GET `/entries/pending-count` เมื่อ authenticated และเมื่อรับ event `inpatient-entries-changed`; `signOut` เรียก `logout` และไป `/login`
- `save`/`confirmEntry` ในหน้าบันทึก และ `action` ในหน้าประวัติส่ง event ข้างต้น ต้องคงไว้เพื่ออัปเดตตัวนับ
- `window.print()` และ `exportExcel(result)` ทำใน browser ไม่มี endpoint พิมพ์หรือส่งออก
- มี GET `/reports/daily` (`daily_report`) ในบริการ แต่ไม่มีหน้าเว็บปัจจุบันเรียก endpoint นี้ ห้ามถือว่าหน้าแรกมีข้อมูลรายวันอยู่แล้ว
- มีบริการบริหารผู้ใช้ หอ เวร และความจุเตียง แต่ไม่มี route หน้าบ้านสำหรับจัดการหรือโปรไฟล์ ไม่สร้าง route เหล่านี้ในงาน UX โดยพลการ

### ประเภทรายงานที่มีจริง 15 ประเภท

| รูปแบบตัวกรอง | รหัสใน `ReportViewer.catalog` | เงื่อนไขที่ต้องรักษา |
| --- | --- | --- |
| วัน | `daily`, `daily-all`, `census-day` | `daily-all` เพิ่มเวร; `census-day` เฉพาะผู้ดูแลระบบ |
| เดือน | `monthly`, `productivity`, `pressure-detail` | เดือนส่งเป็นวันแรก; `pressure-detail` ไม่มีตัวกรองสถานะ |
| ช่วงเดือน | `census-month`, `specialty` | ส่ง `selected` และ `through` เป็นวันแรกของเดือน; `census-month` เฉพาะผู้ดูแล |
| ปีงบประมาณ | `turnover`, `los`, `occupancy`, `skill-mix`, `nursing-hours`, `pressure`, `readmission` | `pressure`/`readmission` ไม่มีสถานะ; occupancy แยก endpoint และไม่มีตัวกรองหอรายตัว |

รวม 15 ประเภท; ผู้ใช้ทั่วไปเห็นได้ 13 ประเภท ข้อ C6 ที่ให้ใช้แท็บเมื่อมีไม่เกิน 5 ประเภทจึงไม่เข้าเงื่อนไข ควรคงตัวเลือกที่รองรับทั้งชุดและจัดรูปแบบให้อ่านง่าย ไม่ตัดเหลือเฉพาะรายวันกับครองเตียง

## 4. ฟิลด์ สถานะ สิทธิ์ และเวลา: ยืนยันได้แค่ไหน

เติมผลลง [ข้อมูลระบบใน spec](ui-spec.md) แล้ว โดยไม่แทนคำตอบที่ยังไม่ทราบด้วยค่าที่คาดเดา

| หัวข้อ | ผลตรวจและหลักฐาน | สิ่งที่ยังต้องให้เจ้าของงานตอบ |
| --- | --- | --- |
| Tech stack | Next.js/React JavaScript + CSS ปกติ; ไม่มี Tailwind — package/lockfile และ `globals.css` | การเพิ่มเครื่องมือคุณภาพ/ไอคอน → Q15 |
| สิทธิ์ | `system_admin`, `auditor`, `ward_recorder`, `report_reader`; ผู้มีสิทธิ์เขียนยืนยันได้ด้วย — `models.py`, `permissions.py`, `api.confirm_entry` | ความต้องการจำกัดผู้ยืนยันเฉพาะหัวหน้าหอขัดกับโค้ด → Q02 |
| เวร | seed จับคู่ ดึก=legacy 1, เช้า=2, บ่าย=3; primary key อาจต่าง; UI ใช้รายการจากบริการ — migration 0003, `ShiftOut` | ไม่มีเวลาเริ่ม/สิ้นสุดหรือกติกาข้ามวัน → Q03 |
| เวลาตัดรอบ | ไม่มีฟิลด์หรือการบังคับเวลาในโค้ดระบบใหม่ | เวลาแยกเวร ข้อยกเว้น และนิยามเลยกำหนด → Q04 |
| สถานะ | เก็บเฉพาะ `unconfirmed`/`confirmed`; ไม่มีรายการคือยังไม่บันทึก; การส่งกลับกลับมา `unconfirmed` | อย่าส่ง `not-recorded`/`overdue`/`returned` เป็นตัวกรองใหม่ → Q04/Q10 |
| ยอดคงเหลือ | `closing_count` ไม่รวม A&D; `patientDays` รวม A&D เพิ่ม; ยืนยันทั้ง PT/NB | จะใช้ตัวใดใน KPI และเทียบเมื่อวานต้องยืนยันบริบทเวร → Q10 |
| คำย่อ | มีรหัส PT/NB และ HN/RN/TN/PN/AID จริง; HN เป็นตัวนับเจ้าหน้าที่ | คำขยายและเกณฑ์ประเภทผู้ป่วย 1–5 ไม่มีพจนานุกรมในระบบใหม่ → Q05 |
| รายการรอยืนยัน | บันทึกสำเร็จแล้ว รอการยืนยัน; ไม่ใช่ offline queue; badge นับทุกช่วงวัน | ไม่ต้องทำ UI “ส่งอีกครั้ง” โดยสมมติว่าข้อมูลส่งไม่สำเร็จ |
| สีครองเตียง | ไม่มีการแบ่งสีตามร้อยละ; `complete` แยกจากค่าอัตรา | ขอบ 85% ซ้อนกันในข้อเสนอเดิม; สูตรปัจจุบันมีสถานะชั่วคราว → Q07 |
| ชื่อโรงพยาบาล | ไม่มีในหน้าบ้าน/ข้อมูลตอบกลับที่ใช้พิมพ์ | ชื่อทางการ/หัวกระดาษ → Q08 |

### ความสัมพันธ์ของฟอร์มที่กระทบ UX

1. ฟอร์มหลัก 29 ช่อง และเฉพาะเวรบ่ายเพิ่มสาขา 26 ช่องกับแผลกดทับ 2 ช่อง; ข้อมูลรายเดือน 2 ช่องใช้ร่วมข้ามเวร ไม่ผูกเฉพาะเวรที่กำลังกรอก — `lib/census.js`, `EntriesPage`, `api.save_entry_supplements`
2. ค่าจำนวนทั่วไปเป็นจำนวนเต็มไม่ติดลบและไม่เกิน 2,147,483,647; เตียงรายการใหม่ต้องมากกว่า 0 การเปลี่ยน NumberInput เป็นข้อความต้องรักษาค่าว่าง ความจำเป็นต้องกรอก ขอบเขต และการแปลงเป็นตัวเลข ห้ามทำให้ค่าว่างกลายเป็นศูนย์โดยเงียบ — `schemas.DailyEntryCreate`/`DailyEntryPatch`, `EntriesPage.input`/`save`
3. `pt_on`/`nb_on` คือยอดตั้งต้น ในประวัติแสดงสองฟิลด์นี้ตรง ๆ; หากจะใช้คำว่า “คงเหลือ” ต้องคำนวณแสดงผลแยก ห้ามเปลี่ยนชื่อคอลัมน์จนความหมายตัวเลขคลาดเคลื่อน
4. ยกยอดและเตียงจากรายการล่าสุดในวันที่ไม่เกินวันที่เลือก อาจไม่ใช่เวรก่อนหน้าทางปฏิทินเมื่อกรอกย้อนหลัง; ไม่ได้เติมเตียงจาก endpoint ความจุหอ — `api.open_entry_form` → Q13
5. แผลกดทับหน้าแยก PUT ได้ต่อเมื่อมีเวรบ่ายวันนั้นและยังไม่ยืนยัน; ปัจจุบันหน้าตัวชี้วัดไม่ได้รับสถานะเวรบ่าย จึงไม่รู้เหตุผลการล็อกล่วงหน้า — `api.update_pressure`, `schemas.PressureOut` → Q13
6. `ReadmissionMonthly` เป็นชุดเดียวกันทั้งสองหน้า ยืนยันแล้ว; แต่ความหมาย `discharge_count` ว่าเป็นเดือนก่อนเป็นเพียง label และกฎอัตราส่วนไม่ได้ตรวจเดือนของตัวหาร ไม่ยืนยันนิยามทางงานจากชื่อฟิลด์ — Q06
7. บันทึกเวรส่ง `expected_version` สำหรับแก้ไข/ยืนยัน และ `previous_readmission` เมื่อเปลี่ยนข้อมูลรายเดือน; หน้าแยก PUT รายเดือนไม่ใช้กลไกเดียวกัน ห้ามทำ payload ของสองหน้าให้เหมือนกันเอง
8. สถานะยืนยันแล้วล็อกฟอร์มเวร; ผู้ดูแลส่งกลับพร้อมเหตุผลได้ การยืนยันไม่ใช่การกดบันทึกครั้งที่สอง และไม่มี endpoint ยืนยันหลายรายการในคำขอเดียว

## 5. ช่องว่างระหว่าง spec กับระบบปัจจุบัน

| ส่วน | ข้อเท็จจริงปัจจุบัน | ผลต่อเฟสที่จะทำ |
| --- | --- | --- |
| ข้อกำหนดซ้ำ | มีแผนเฟส 2 ชุด และ max-width 1440/1600 ต่างกัน | Q01: ตกลงให้ A–E/แผน 0–7 เป็นหลักก่อนเฟส 1 |
| App Shell | เมนูทุกคนเห็นเหมือนกัน; ไม่มี rail/bottom nav/drawer; active ใช้ `usePathname() === href` จึงทำเครื่องหมายเมนูรอยืนยันที่มี query ไม่ถูก; header และ badge เชื่อมต่อเป็นข้อความคงที่ | เปลี่ยนการแสดงเมนู/active ได้ใน presentation แต่ห้ามเปลี่ยนปลายทางหรือสิทธิ์; สถานะเชื่อมต่อ/ซิงก์ต้องกำหนดแหล่งข้อมูล Q14 |
| ข้อมูลผู้ใช้ | `/auth/me` มี id, username, is_active, is_admin; `/wards` มี can_write แต่ไม่มีตำแหน่งงานหรือหอที่เลือกส่วนกลาง | แสดงบทบาทพยาบาล/หัวหน้าหอตามคาดเดาไม่ได้; เมนูโปรไฟล์ยังไม่มีหน้า; การแชร์หอปัจจุบันต้องตกลง Q14 |
| หน้าแรก | เรียกเฉพาะข่าว ไม่มีข้อมูลเวร/KPI/กราฟ/เวลา deadline | การเพิ่ม GET แม้ใช้ endpoint เดิมก็เปลี่ยนการเรียกข้อมูล ต้องอนุญาตก่อน; ไม่อ้างว่าหน้าแรกพร้อมแสดงข้อมูลจริง Q10/Q11 |
| ข่าว | ปุ่มเพิ่มข่าวถูกจำกัด `user.is_admin` อยู่แล้ว ทั้ง frontend และ backend; ไม่มี author/pinned/important | ข้อความใน spec ชุดแรกที่บอกว่าทุกบทบาทเห็นปุ่มไม่ตรงซอร์สล่าสุด; ข้อมูลที่ขาดต้องเลือกซ่อนหรือ mock ชัดเจน Q11 |
| โหลดข้อมูล | ฟอร์มเปิดผ่านปุ่ม ยกเว้นมี query ครบ; ประวัติปกติไม่โหลดรายการเมื่อเปิด (ช่วงเริ่มเดือนถึงวันนี้); คิวรอยืนยันโหลดทันทีทุกช่วงวัน; ตัวชี้วัด/รายงานโหลดผ่านปุ่ม | ข้อเสนอ auto-load, ประวัติเริ่ม 7 วัน และแยกเดือน/วันตัวชี้วัดเปลี่ยนจังหวะ/เงื่อนไขคำขอ → Q10/Q13 |
| ตัวกรองสถานะ | ประวัติค้นได้เฉพาะรายการที่มีอยู่และ 2 สถานะ; limit/offset มีแล้ว; ชิปยอดรวมทุกสถานะ/หอที่ขาดไม่มีในคำขอเดิม | ห้ามใช้จำนวน 50 แถวที่โหลดเป็นยอดจริงทั้งระบบ หรือส่งสถานะที่บริการไม่รับ → Q10/Q11 |
| ข้อมูลบันทึกล่าสุด | DailyEntryOut มี created_at/updated_at แต่ไม่มี actor หรือ confirmed_at; DB มีข้อมูลผู้ดำเนินการ/SubmissionEvent แต่ไม่มีข้อมูลตอบกลับครบ; ตัวชี้วัดไม่ส่ง updated_at/updated_by | ใช้ updated_at แทนเวลายืนยันหรือชื่อบัญชีปัจจุบันแทนชื่อผู้บันทึกไม่ได้ → Q11 |
| พฤติกรรมฟอร์ม | dirty มีเพื่อกันยืนยันขณะยังไม่บันทึก แต่ไม่มีเตือนก่อนเปลี่ยนบริบท/ออกจากหน้า ไม่มีเก็บ draft หรือ hotkey | ต้องตกลงขอบเขต behavior ฝั่งหน้าเว็บตาม Q12 ก่อน ไม่เรียกว่าเปลี่ยน CSS อย่างเดียว |
| ครองเตียง | บริการส่ง complete, จำนวนเวร, ค่าอัตรา, รวมปี/ปีก่อน และ total; frontend แปลงเป็นตารางข้อความและทิ้งโครงสร้างบางส่วน | ทำสี/progress จากข้อมูลเดิมได้โดยไม่คำนวณสูตรใหม่ ต้องรักษา null และกฎแสดงเฉพาะ complete; สูตร `legacy_monthly_temporary_v1` ยังระบุไม่ผ่านอนุมัติ Q07 |
| รายงานอื่น | คืน `columns`/`rows` อาจมี ISO อยู่ในเซลล์; ไม่ใช่ข้อมูลแบบรายวันมีชื่อฟิลด์ครบทุกชุด | ต้องทำ presentation ตามชนิดรายงาน ไม่ replace ตัวเลขปี/ข้อความทุกเซลล์แบบเหมารวม; การทำ completeness/KPI เพิ่มต้องตกลง Q10/Q11 |
| ส่งออก/พิมพ์ | Excel XML Spreadsheet `.xml`, ใช้ผลเดียวกับตาราง; print มี landscape แต่ไม่ระบุ A4, ตัวอักษร 8px และไม่มีหัวโรงพยาบาล/ผู้พิมพ์ | `.xlsx` ไม่ใช่แค่เปลี่ยนชื่อไฟล์; ต้องตัดสินใจ Q09; หัวพิมพ์ต้องใช้ข้อมูลที่ยืนยัน Q08 |
| Login | มี route จริงแต่ C1–C6 ไม่ระบุเฟสเฉพาะ; มีข้อความ session/API ถึงผู้ใช้ | รวมไว้ใน inventory/QA; รอระบุขอบเขตปรับใน Q16 |

## 6. ไลบรารีและสิ่งที่ต้องเพิ่ม

ตรวจทั้ง dependencies ที่ประกาศ lockfile การ import และ `npm ls --depth=0`; ไม่ติดตั้งหรืออัปเดตแพ็กเกจในเฟส 0

| หมวด | มีอยู่จริง | แนวทาง/สิ่งที่ขาด |
| --- | --- | --- |
| Framework | `next ^16.1.0`, `react`/`react-dom ^19.2.0`; resolved `16.4.6`/`19.3.1` | ใช้ App Router และ React เดิม คง config/rewrite |
| UI และรูปแบบ | CSS ธรรมดาใน globals, CSS variables สีเบื้องต้น, native controls; `next/font` ยังไม่ถูกใช้ | ขยาย tokens/typography และสร้าง shared components ในเฟส 1; ไม่จำเป็นต้องเพิ่ม Tailwind หรือ UI kit เพื่อทำ responsive |
| ไอคอน | ไม่มี icon package; ใช้จุดเมนู ตัวอักษร IP และ ↗ | spec ระบุ `lucide-react`; เสนอพิจารณาเพิ่มเฉพาะหมวดนี้เพราะต้องมีไอคอนสม่ำเสมอทั้งระบบ ต้องตกลง Q15 ก่อน; ทางเลือกคือชุด inline SVG กลางโดยไม่เพิ่ม dependency |
| วันที่/ตัวเลข | native Date/Intl และ DateField; todayISO ใช้ Asia/Bangkok, thaiDateLabel ใช้ UTC สำหรับ date-only; มี monthStartISO; ไม่มี date-fns/dayjs/picker package | สร้าง util/picker กลางตาม A2 โดยใช้ Intl เดิมได้ ไม่ต้องเพิ่มไลบรารีวันที่จากความต้องการ format อย่างเดียว; parse พ.ศ./ค.ศ. ต้องคงค่า ISO และ validation |
| ตาราง | native table + `.table-scroll`; ไม่มี table/grid package | sticky, card view, sorting และ pagination เชิงแสดงผลทำต่อจากเดิมได้; ไม่จำเป็นต้องเพิ่ม data-grid package และไม่เปลี่ยน limit/offset |
| Excel | `exportExcel` เขียน XML ด้วย Blob และ browser download; ไม่มี xlsx/ExcelJS หรือแพ็กเกจส่งออก | หากยืนยัน `.xlsx` ต้องเลือกและอนุญาตเพิ่มตัวสร้างไฟล์ XLSX หรืออนุญาตงานส่งออกแยก; หากคง XML ไม่ต้องเพิ่ม dependency → Q09 |
| Dialog/Drawer/Toast | native confirm/prompt, alert/status ในหน้า; ไม่มี shared dialog/toast package | ต้องสร้าง accessible components ให้ครบ Esc/focus trap/focus return/scroll lock; native `<dialog>` เป็นแนวทางไม่เพิ่ม dependencyที่ต้องตรวจบน browser เป้าหมายก่อน |
| ฟอนต์ | Leelawadee UI/Tahoma และชื่อ Inter เป็น fallback ไม่ได้โหลดไฟล์; ไม่มีฟอนต์ไทย bundled | เลือกฟอนต์และวิธีโหลด Q15; next/font ที่มาพร้อม Next.js อาจใช้ได้โดยไม่เพิ่ม npm package แต่ต้องมีแหล่งไฟล์/การเชื่อมต่อที่เหมาะกับการติดตั้ง |
| เครื่องมือคุณภาพ | ไม่มี lint script, ESLint, TypeScript, tsconfig หรือ devDependencies | ต้องอนุญาตเพิ่ม/กำหนด lint config และแนวทางตรวจ JavaScript (เช่น TypeScript แบบ checkJs หากเลือกใช้) ก่อนตั้งเป็นเกณฑ์ที่รันได้; ไม่จำเป็นต้องย้ายโค้ดทั้งแอปเป็น TypeScript → Q15 |

`npm ls` แสดง `@emnapi/runtime` และ `@img/sharp-wasm32` เป็น extraneous ในเครื่องนี้ ไม่ใช่ UI dependency ที่โปรเจกต์ประกาศ ไม่ลบหรือปรับ dependency เหล่านี้ใน Audit

สิ่งที่ต้องสร้างแน่นอนคือ tokens/util/components ตามรายการใน `ui-progress.md`; ยังไม่มี dependency ใหม่ที่อนุมัติหรือจำเป็นต้องติดตั้งสำหรับเฟส 0 ทั้ง lucide, XLSX และ tooling เป็นข้อเสนอสำหรับการตัดสินใจ ไม่ใช่งานที่ทำแล้ว

## 7. แผนดำเนินการและการตรวจแต่ละเฟส

ใช้ checklist เฟส 0–7 ใน [ui-progress.md](ui-progress.md) เป็นแผนเตรียมงาน จบเฟส 0 แล้วรอคำตอบก่อนรับงานเฟสถัดไป โดยเฉพาะสิทธิ์/เวลา/การเรียกข้อมูล/แพ็กเกจ ห้ามนำแผนไปตีความเป็นอนุญาตแก้ logic

### ผล Audit ด้าน responsive จาก CSS ปัจจุบัน

| ความกว้าง | กฎที่โค้ดปัจจุบันใช้ | ข้อสังเกตและสิ่งที่ต้องทดสอบใน browser ภายหลัง |
| --- | --- | --- |
| 360px | max-width 1000 และ 700 ทำงาน; sidebar กลายเป็นแถวเมนูเลื่อนแนวนอนด้านบน; ฟอร์มเลือก 1 คอลัมน์ | ยังไม่มี bottom nav/drawer/focus mode; ตารางยัง min-width 720px (กริดตัวเลขกว้างกว่านี้ได้); ตรวจว่าเลื่อนในกรอบเท่านั้นและปุ่มไม่ถูกคีย์บอร์ดบัง |
| 768px | max-width 1000 ทำงานแต่ 700 ไม่ทำงาน; ตัวกรองยัง 3 คอลัมน์ | ไม่มี rail ตาม spec; ต้องตรวจพื้นที่ข้อความไทยและช่องวัน/หอ รวมถึงเข้าถึงออกจากระบบ (CSS ซ่อน sidebar-bottom) |
| 1024px | ไม่มีสอง breakpoint ข้างต้นทำงาน; sidebar 250px คงที่ | พื้นที่เนื้อหาเหลือราว 774px ก่อน padding; ต้องใช้ container queries ปรับฟอร์ม/ตารางตามพื้นที่จริงและมีจุดเลื่อนในกรอบ |
| 1440px | sidebar 250px; page-content max-width 1250px รวม padding | เนื้อหาด้านในยังจำกัด; ตรวจตารางรายงานกว้าง sticky หัว/หอ และไม่ตัดคอลัมน์ท้าย; Dashboard ยังไม่มี layout ตาม spec |

ตารางนี้เป็นการอ่านกฎ CSS ไม่ใช่ผลผ่านการทดสอบ viewport จริง หน้า `/`, `/login`, `/entries`, `/history`, `/history?status=unconfirmed`, `/indicators`, `/reports`, `/occupancy` ต้องตรวจที่ทั้งสี่ความกว้างในเฟสที่เกี่ยวข้องและตรวจรวมเฟส 7 เพิ่ม 390/1280/1920px แท็บเล็ตแนวนอน และซูม 200% ตาม spec

ตรวจแต่ละหน้าอย่างน้อย loading/empty/error/success/read-only ตามที่มีจริง, ใช้ keyboard ล้วน, touch target, focus/aria, ตัวหนังสือไทยไม่ถูกตัด, contrast, ปฏิทิน พ.ศ., reduced motion และการพิมพ์ขาวดำหลายหน้า รายละเอียด checklist อยู่ในไฟล์ความคืบหน้า

## 8. ผลตรวจโครงการและขอบเขตการเปลี่ยนแปลง

รันจาก `new-system/frontend` ด้วย Node `v24.14.1` และ npm `11.11.0`:

| คำสั่ง | ผลในเฟส 0 | ข้อจำกัด |
| --- | --- | --- |
| `npm run lint` | ไม่ผ่าน: `Missing script: "lint"` | package.json เดิมไม่มี script/ESLint จึงไม่มีผล lint ให้รับรอง; ไม่เพิ่ม config ในงานเอกสาร |
| `npx --no-install tsc --noEmit` | รันไม่ได้: ไม่มี package/compiler ในโปรเจกต์ | ใช้ `--no-install` เพื่อไม่ติดตั้งแพ็กเกจนอกขอบเขต; ไม่มี TypeScript/tsconfig จึงไม่ใช่ typecheck ที่ผ่าน |
| `npm run build` | ผ่าน exit 0 | Next.js 16.4.6 สร้างครบทั้ง 7 route และ not-found; ข้อความ “Running TypeScript” ภายใน build ไม่ทดแทน standalone typecheck และไม่ยืนยันสิทธิ์/ข้อมูลจริง |

ไม่ได้แก้ source, business logic, API, routing, model, dependency, config หรือ AGENTS.md และไม่ได้รันทดสอบที่บันทึกข้อมูลลงระบบจริง เปรียบเทียบ SHA-256 ของไฟล์นอกเอกสารกับ snapshot ก่อนเขียน และตรวจ diff เอกสารก่อนจบ (workspace ไม่มี Git repository จึงใช้ hash และ diff จากสำเนาต้นฉบับ) ผลสุดท้ายบันทึกใน `ui-progress.md`

ไฟล์ที่งานนี้เปลี่ยน/เพิ่ม: `docs/ui-spec.md`, `docs/ui-audit.md`, `docs/ui-progress.md` และสำเนาภาพเดิม 6 ไฟล์ใต้ `docs/screenshots/` รายการคำถามที่ยังไม่ตกลงทั้งหมดอยู่ใน Q01–Q16 ของไฟล์ความคืบหน้า
