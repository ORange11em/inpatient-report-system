# ความคืบหน้า UX/UI

## 27 พฤศจิกายน 2569 — รายงานผลการตรวจรับ QA UX/UI ทั้งระบบ (ตรวจอย่างเดียว ไม่แก้โค้ด)

- **ขอบเขตการตรวจ:** ตรวจครบทั้ง **11 เส้นทางผู้ใช้** (`/login`, `/maintenance`, `/`, `/entries`, `/history`, `/history?status=unconfirmed`, `/indicators`, `/reports`, `/occupancy`, `/users`, `/admin/master` ครบทั้ง 3 แท็บ) ที่ความกว้าง **360 / 768 / 1024 / 1440px** ทั้งขนาดตัวอักษร **100% และ 125%** (รวมถึง `1920px` สำหรับ `/occupancy` และ `/reports`) บน Microsoft Edge headless พร้อมบริการจำลอง โดยไม่แก้ไขไฟล์โค้ดใด ๆ
- **ผลการรันคำสั่งและตรวจข้อผิดพลาด:**
  - `npm run test:ui`: **ผ่าน 50/50**
  - `npm run build`: **ผ่านครบทั้ง 12 เส้นทาง**
  - Console error / Hydration warning / Page error: **ผ่าน (0 รายการ)**
  - `npm run lint` และ `npx --no-install tsc --noEmit`: **ยังไม่ได้รัน** (ไม่มี script `lint` และไม่มีแพ็กเกจ TypeScript compiler ติดตั้งในโปรเจกต์เดิม)
- **สรุปผลการตรวจอัตโนมัติบนเบราว์เซอร์ (เทียบกับข้อบกพร่อง F01–F05 เดิมใน `ui-phase-7.md`):**
  - **การเลื่อนแนวนอน (`scrollWidth <= clientWidth`)**: **ผ่าน** ทุกหน้า ทุกความกว้าง (`360 / 768 / 1024 / 1440px` ทั้ง `100%` และ `125%`) และตาราง `/occupancy` ที่ `1920px` แสดงครบ 16 คอลัมน์พอดี (`1500/1500px`)
  - **วันที่ พ.ศ. และคำศัพท์มาตรฐาน A5**: **ผ่าน** ไม่พบวันที่ ISO/ค.ศ. หรือศัพท์เทคนิค (`API`, `payload`, `session cookie`, `INPATIENT DATA`, `ward`, `pressure`, `ระบบหลังบ้าน`) บนหน้าจอ งานพิมพ์ A4 แนวนอน และไฟล์ส่งออก Excel XML ทั้ง 15 ชนิด (F01 และ F02 เดิมแก้ไขครบแล้ว) ชื่อเมนูตรงกับ `h1` ครบทั้ง 8 หน้าคงที่ และ `/reports` เปลี่ยนหัวข้อตามประเภทรายงานตามสเปก C6
  - **ขนาดปุ่ม/ช่องกรอก `≥ 44×44px`, `:focus-visible` และ Contrast WCAG AA**: **ผ่าน (ในขอบเขตที่วัดได้บนเบราว์เซอร์)** ทุกปุ่มและช่องกรอกที่แสดงผลมีขนาด `≥ 44×44px` (`smallTargets = 0`, F04 แก้แล้ว) มี `:focus-visible` เส้นทึบ `3px solid #246fbe` ชัดเจน (F03 แก้แล้ว) ข้อความปกติบนพื้นทึบ `≥ 4.5:1` (`lowTextContrast = 0`) และขอบช่องกรอก/ปุ่มรอง `≥ 3:1` (`lowBorderContrast = 0`)
  - **`ConfirmDialog` และ `Toast`**: **ผ่าน** กักโฟกัส `Tab` ไว้ในหน้าต่าง ปิดด้วย `Esc` ได้ มี `aria-live="polite"` และบน `/entries` ที่ `360px` และ `1440px` ไม่บังปุ่มบันทึกหรือแถบเมนูมือถือ (F05 แก้แล้ว)
  - **การกรอก `/entries` ด้วยคีย์บอร์ดล้วน และ `PasswordInput`**: **ผ่าน** เลื่อนโฟกัสด้วย `Enter`/`Tab` ครบทั้ง **59/59 ช่อง** ของเวรบ่ายจนถึงปุ่มบันทึก และกด `Ctrl+S` ยืนยันบันทึกสำเร็จทั้งที่ `1440px` และ `360px`; `PasswordInput` สลับแสดง/ซ่อนรหัสผ่านได้ครบทั้ง **8 ช่องใน 4 จุด** (`/login`, หน้าต่างเปลี่ยนรหัสผ่านใน `ShellFrame`, เพิ่มผู้ใช้ใหม่ และตั้งรหัสผ่านใหม่ใน `/users`)
- **รายการที่รอตรวจบนอุปกรณ์และซอฟต์แวร์จริง (ยังไม่ได้รันในสภาพแวดล้อมนี้):**
  - **Lighthouse Accessibility ≥ 95 ทุกหน้า**: ยังไม่ได้รัน CLI เนื่องจากไม่มีแพ็กเกจ `lighthouse` ในเครื่อง (`npx --no-install lighthouse --version` แจ้งไม่มีแพ็กเกจ) ต้องรันผ่าน Chrome DevTools บนเครื่องจริงตามขั้นตอน M04
  - **มือถือจริง iOS Safari / Android Chrome + แป้นพิมพ์สัมผัสจริง** (M02), **โปรแกรมอ่านหน้าจอจริง NVDA / VoiceOver** (M03), **ซูมเบราว์เซอร์จริง 200%** (M01), **เครื่องพิมพ์จริง A4 แนวนอนขาวดำ** (M05) และ **การเปิดไฟล์ `.xml` ใน Microsoft Excel จริง** (M06)
- **หมายเหตุไฟล์สคริปต์ทดสอบ/โค้ดเก่าที่คงค้าง (ไม่กระทบผู้ใช้จริง):**
  - สคริปต์ทดสอบเบราว์เซอร์รุ่นเก่า 4 ไฟล์ยังมี selector ก่อนปรับ UX รอบล่าสุด: `tests/browser/entry-editing.cjs:63`, `tests/browser/history.cjs:48`, `tests/browser/indicators.cjs:37`, `tests/browser/text-size.cjs:127`
  - ไฟล์โค้ดเก่าที่ไม่มีการเรียกใช้แล้ว: `components/DateField.jsx:1-32` และกฎสไตล์เดิมใน `app/globals.css:3-133`

## 27 พฤศจิกายน 2569 — เพิ่มหน้าผู้ดูแลระบบ `/admin/master` สำหรับจัดการหอผู้ป่วย ประเภทเวร และความจุเตียงมาตรฐาน

- **1) เส้นทางใหม่และเมนูตั้งค่าสำหรับผู้ดูแลระบบ:**
  - `new-system/frontend/lib/workspace.mjs`, `new-system/frontend/components/ui/Icon.jsx` และ `new-system/frontend/components/shell/ShellFrame.jsx`: เพิ่มเมนู `"จัดการหอผู้ป่วยและเวร"` (ชื่อย่อ `"ตั้งค่า"`, ไอคอน `settings`, `adminOnly: true`) ในกลุ่ม `"การจัดการระบบ"` ชี้ไปยัง `/admin/master` พร้อมรองรับ active state บนปุ่ม `"เมนู"` ของมือถือ และเพิ่ม unit test `pageContext` ใน `new-system/frontend/tests/admin-master.test.mjs`
  - `new-system/frontend/lib/api.js`: เพิ่มข้อความภาษาไทยสำหรับรหัสข้อผิดพลาดของข้อมูลพื้นฐาน (`ward_code_already_exists`, `shift_code_or_legacy_id_already_exists`, `shift_not_found`, `capacity_date_order_invalid`)
- **2) หน้า `/admin/master` (`new-system/frontend/app/admin/master/page.js`, `new-system/frontend/styles/master.css`):**
  - แสดง `EmptyState` ล็อกสิทธิ์เหมือนหน้า `/users` หากผู้ใช้ไม่ใช่ผู้ดูแลระบบ (`!user?.is_admin`)
  - แบ่งเนื้อหาเป็น 3 แท็บ (`role="tablist"` / `role="tab"` / `role="tabpanel"` รองรับคีย์บอร์ดลูกศรซ้าย–ขวา `Home` / `End`) ด้วย shared components และ design tokens เดิมทั้งหมด:
    1. **แท็บหอผู้ป่วย**: ตารางแสดงรหัส ชื่อเต็ม ชื่อย่อ และสถานะ พร้อมค้นหาและหน้าต่างเพิ่มหอผู้ป่วยใหม่ (`POST /wards` พร้อม `csrfToken`) ส่วนรายการเดิมแสดงแบบอ่านอย่างเดียวตามที่ระบบหลังบ้านรองรับ
    2. **แท็บประเภทเวร**: โหลดรายการทั้งหมดรวมเวรที่ปิดใช้งาน (`GET /shifts?include_inactive=true`) เพิ่มเวรใหม่ (`POST /shifts`) และปรับชื่อเวร ลำดับแสดงผล หรือเปิด/ปิดการใช้งาน (`PATCH /shifts/{id}`) ส่วนรหัสเวรแสดงแบบอ่านอย่างเดียวหลังสร้างรายการ
    3. **แท็บความจุเตียงมาตรฐาน**: เลือกหอผู้ป่วย โหลดประวัติช่วงความจุเตียง (`GET /wards/{ward_id}/capacity`) แสดงวันที่เริ่ม–สิ้นสุดเป็น พ.ศ. ผ่าน `formatThaiDate` และเพิ่มช่วงความจุเตียงใหม่ (`POST /wards/{ward_id}/capacity`) ด้วย `ThaiDatePicker` (ส่ง ISO `YYYY-MM-DD`) และ `NumberInput`
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **50/50** และ `npm run build` ผ่านครบ **12 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามเดิม)
  - ทดสอบบน Microsoft Edge headless ที่ความกว้าง **360 / 768 / 1024 / 1440px** ทั้งขนาดตัวอักษร **100% และ 125%** ครบทั้ง 3 แท็บ: ยืนยันการซ่อนเมนูและล็อกหน้าสำหรับผู้ใช้ทั่วไป การส่ง `X-CSRF-Token` และข้อมูลตาม schema จริงของ `POST /wards`, `POST /shifts`, `PATCH /shifts/{id}` และ `POST /wards/{ward_id}/capacity` การแจ้งเตือนรหัสซ้ำและช่วงวันที่ความจุเตียงซ้อนทับเป็นภาษาไทยสุภาพ และไม่เกิด horizontal scroll หรือ page error
- **ไฟล์ที่สร้าง/แก้:** `new-system/frontend/app/admin/master/page.js`, `new-system/frontend/styles/master.css`, `new-system/frontend/lib/workspace.mjs`, `new-system/frontend/components/shell/ShellFrame.jsx`, `new-system/frontend/components/ui/Icon.jsx`, `new-system/frontend/lib/api.js`, `new-system/frontend/tests/admin-master.test.mjs`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง / ข้อจำกัดของระบบหลังบ้านปัจจุบัน:** ปัจจุบันฝั่งหลังบ้านยังไม่มีช่องทางสำหรับแก้ไขหรือปิดใช้งานหอผู้ป่วยเดิม (`PATCH /wards/{id}` และ `GET /wards` คืนเฉพาะหอที่เปิดใช้งาน) รวมถึงยังไม่มีช่องทางแก้ไขหรือลบประวัติช่วงความจุเตียงเดิม จึงแสดงรายการที่บันทึกไว้แล้วของทั้งสองส่วนแบบอ่านอย่างเดียวตามกติกา

## 27 พฤศจิกายน 2569 — ป้าย “ประเภท 5 (วิกฤต)” สถานะรายเวรบน `ShiftSelector` ซ่อนตัวเลือกหอซ้ำบน Header และช่วงปีงบประมาณถึง พ.ศ. 2553

- **1) ติดป้าย “ประเภท 5 (วิกฤต)” ตามหลักฐานระบบเก่า (`inpatient/edit_data.php` บรรทัด 364):**
  - `new-system/frontend/app/entries/page.js`: ปรับป้ายและ `aria-label` ของช่อง `patient_type5` ในส่วนที่ 5 เป็น `"ประเภท 5 (วิกฤต)"` โดยคง `name="patient_type5"` ลำดับ 5 → 1 และป้าย `"ประเภท 4"` ถึง `"ประเภท 1"` เดิม
  - `new-system/frontend/components/history/HistoryEntryDialog.jsx`: แสดง `<dt>` เป็น `"ประเภท 5 (วิกฤต)"` ให้ตรงกันในหน้าต่างตรวจสอบรายละเอียด
- **2) แสดงสถานะจริงของแต่ละเวรบน `ShiftSelector` ในหน้า `/entries`:**
  - `new-system/frontend/app/entries/page.js`, `new-system/frontend/components/entries/EntryContextBar.jsx`, `new-system/frontend/components/ui/primitives.jsx` และ `new-system/frontend/styles/entries.css`: อ่านสถานะรายเวรของหอและวันที่ที่เลือกผ่าน `GET /reports/daily?service_date=<วันที่ที่เลือก>&ward_id=<หอที่เลือก>` แล้วส่ง `status` (`"confirmed"` / `"unconfirmed"` / `"unrecorded"`) แสดงเป็น `StatusBadge` ในแต่ละตัวเลือกของ `ShiftSelector` (ไม่แสดงช่วงเวลาเวรและไม่แสดงสถานะเลยกำหนด) รีเฟรชอัตโนมัติเมื่อเกิด event `inpatient-entries-changed` ซ่อน badge เงียบ ๆ เมื่อโหลดไม่สำเร็จโดยไม่บล็อกการเลือกเวรหรือปุ่ม “เปิดแบบฟอร์ม” ผูก `aria-label` / `aria-describedby` บนปุ่มวิทยุของเวร และปรับกริด `.entry-context-fields` ไม่ให้ badge ล้นกรอบทุกขนาดจอและขนาดตัวอักษร
- **3) ลดความซ้ำซ้อนของตัวเลือก “หอผู้ป่วยปัจจุบัน” บน Header:**
  - `new-system/frontend/components/shell/ShellFrame.jsx` และ `new-system/frontend/styles/shell.css`: แสดง dropdown `"หอผู้ป่วยปัจจุบัน"` บน Header เฉพาะหน้า `/` และซ่อนบนหน้าอื่นที่มีตัวเลือกหอของตัวเองหรือแสดงทุกหอ (`/entries`, `/indicators`, `/history`, `/reports`, `/occupancy`, `/users`) โดยคงสถานะ `selectedWardId` ใน `WorkspaceContext` และจัดตำแหน่งเครื่องมือบน Header ให้ชิดขวาเรียบร้อยทุกขนาดจอ
- **4) ปรับช่วงปีงบประมาณในหน้ารายงานตามระบบเก่า (`inpatient/bed_rate.php` บรรทัด 52):**
  - `new-system/frontend/components/ReportViewer.jsx`: ปรับรายการปีงบประมาณเป็นช่วงตั้งแต่ปีงบประมาณปัจจุบันย้อนลงไปถึง พ.ศ. `2553` พร้อมคงการรองรับปีจาก URL query หากอยู่นอกช่วงดังกล่าว และคงพฤติกรรมการโหลดของ `/reports`, `/occupancy` และ `/history` เดิมทั้งหมด
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **49/49** และ `npm run build` ผ่านครบ **11 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามเดิม)
  - ทดสอบบน Microsoft Edge headless ที่ความกว้าง **360 / 768 / 1024 / 1440px** ทั้งขนาดตัวอักษร **100% และ 125%** (รวมถึงรัน `tests/browser/reports.cjs` ผ่านครบ 18 หัวข้อ): ยืนยันว่า `ShiftSelector` แสดงสถานะรายเวรจริง อัปเดตทันทีหลังบันทึก/ยืนยัน ซ่อนเงียบเมื่อโหลดไม่สำเร็จ และไม่ล้นกรอบการ์ดหรือ BottomSheet ทุกขนาดจอ; ช่อง `patient_type5` และหน้าต่างตรวจสอบแสดง `"ประเภท 5 (วิกฤต)"`; หน้า `/` เลือกหอผู้ป่วยบน Header ได้และส่งต่อค่าเริ่มต้นใน `WorkspaceContext` ส่วนหน้าอื่นไม่มีช่องเลือกหอซ้ำบน Header; และตัวเลือกปีงบประมาณแสดงปีปัจจุบันถึง พ.ศ. 2553 พร้อมรองรับปีจาก URL query นอกช่วงได้ปกติ
- **ไฟล์ที่แก้:** `new-system/frontend/app/entries/page.js`, `new-system/frontend/components/entries/EntryContextBar.jsx`, `new-system/frontend/components/history/HistoryEntryDialog.jsx`, `new-system/frontend/components/shell/ShellFrame.jsx`, `new-system/frontend/styles/shell.css`, `new-system/frontend/components/ReportViewer.jsx`, `new-system/frontend/components/ui/primitives.jsx`, `new-system/frontend/styles/entries.css`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** สคริปต์ทดสอบเบราว์เซอร์เดิม `tests/browser/history.cjs` (บรรทัด 48) เคยตรวจ `getByLabel('หอผู้ป่วยปัจจุบัน')` บน Header หลังจากคลิกแก้ไขเข้ามาหน้า `/entries` ซึ่งปัจจุบันซ่อนตัวเลือกหอซ้ำบน Header ของ `/entries` ตามคำสั่งรอบนี้แล้ว หากต้องการให้ปรับ selector ในไฟล์ทดสอบดังกล่าวในรอบถัดไปสามารถแจ้งยืนยันได้

## 27 พฤศจิกายน 2569 — ปรับปรุง UX หน้ารายงาน/อัตราการครองเตียง ตารางประวัติ แท็บตัวชี้วัดเสริม และหน้าแรก

- **1) หน้ารายงานและอัตราการครองเตียง (`/reports`, `/occupancy`):**
  - `new-system/frontend/components/ui/primitives.jsx`: ขยาย `Select` ให้รองรับ prop `groups` (`<optgroup>`) ทั้งโหมดปกติและโหมด `readOnly` โดยไม่กระทบการใช้งาน `options` เดิม
  - `new-system/frontend/components/ReportViewer.jsx`: จัดกลุ่มรายงาน 15 ประเภทเป็น 4 หมวดด้วย `<optgroup>` (`รายงานประจำวันและประจำเดือน`, `ยอดคงพยาบาล` เฉพาะผู้ดูแลระบบ, `อัตราเตียงและกำลังคนทางการพยาบาล`, `ตัวชี้วัดความปลอดภัย`); ปรับตัวเลือกปีงบประมาณจาก 1,001 ปีเหลือช่วงที่ใช้งานจริง 17 ปี (ปีงบประมาณปัจจุบัน + ล่วงหน้า 1 ปี + ย้อนหลัง 15 ปี พร้อมรวมปีจาก URL query หากอยู่นอกช่วง) และใช้ป้ายเดือนย่อในตัวเลือก (`ปีงบประมาณ 2570 (ต.ค. 69 – ก.ย. 70)`) โดยไม่แก้ `formatFiscalYear`; เพิ่ม `onRemove` บนชิปหอผู้ป่วยและชิปสถานะข้อมูลเพื่อรีเซ็ตตัวกรอง ซิงก์ URL และโหลดรายงานใหม่ทันที; แสดงชื่อเต็มของผู้พิมพ์ (`user?.full_name?.trim() || user?.username || "—"`) บนหัวกระดาษพิมพ์; และแสดง `Toast` ยืนยัน `"ส่งออกไฟล์รายงานแล้ว"` เมื่อส่งออก Excel XML สำเร็จ
  - `new-system/frontend/styles/reports.css`: เพิ่ม `.reports-toast` ลอยมุมขวาล่างมาตรฐานเดียวกับหน้าอื่น และขยายความกว้างคอลัมน์ชื่อหอผู้ป่วยแรกของ `.occupancy-table` บนจอ `≥ 1024px` เป็น `calc(var(--compact-column-width) + var(--space-12))` (`13rem`) โดยยังคงแสดงครบทั้ง 16 คอลัมน์พอดีบนจอ `1920px`
- **2) หน้าประวัติการบันทึก (`/history`):**
  - `new-system/frontend/components/history/HistoryResults.jsx`: เปิด `sortable: true` พร้อมฟังก์ชัน `compare` ตามค่าจริงในคอลัมน์ `service_date` (เรียงตามวันที่ ISO และลำดับเวร), `ward_id` (เรียงชื่อหอผู้ป่วยภาษาไทย), `amount_bed` (เรียงตามจำนวนตัวเลข รองรับค่าว่าง) และ `updated_at` (เรียงตามเวลา timestamp)
- **3) หน้าตัวชี้วัดเสริม (`/indicators`):**
  - `new-system/frontend/app/indicators/page.js` และ `new-system/frontend/styles/indicators.css`: เพิ่มแถบแท็บสลับ `"แผลกดทับ (รายวัน)"` และ `"การกลับมารักษาซ้ำ (รายเดือน)"` บนจอ `< 1024px` (`role="tablist"` / `role="tab"` / `role="tabpanel"`, รองรับปุ่มลูกศรซ้าย/ขวา `Home` และ `End`) โดยคงทั้งสองฟอร์มไว้ใน DOM เพื่อรักษาค่าที่แก้ไขค้างไว้เมื่อสลับแท็บ และคงเลย์เอาต์ 2 คอลัมน์ข้างกันบนจอ `≥ 1024px`
- **4) หน้าแรก (`/`):**
  - `new-system/frontend/components/home/Dashboard.jsx`: เพิ่มเส้นตารางอ้างอิงแนวนอน (`0%`, `50%`, `100%`) พร้อมป้ายแกน Y และเพิ่ม `<title>` ในจุด `<circle>` ของ `TrendCard` เพื่อแสดงวันที่ พ.ศ. แบบเดือนเต็มคู่กับค่าร้อยละเมื่อวางเมาส์
  - `new-system/frontend/app/page.js` และ `new-system/frontend/styles/home.css`: เพิ่มช่องค้นหาข่าวประกาศฝั่ง client เมื่อมีข่าวมากกว่า 3 รายการ พร้อมข้อความกรณีไม่พบคำค้นและปุ่มล้างคำค้นหา และเพิ่มข้อความตัวอย่างเนื้อหาข่าว 2 บรรทัด (`.home-news-preview`) ใต้หัวข้อข่าวเมื่อพับอยู่
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **49/49** และ `npm run build` ผ่านครบ **11 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามเดิม)
  - รันสคริปต์ `tests/browser/reports.cjs` ผ่านครบทุกข้อ (พารามิเตอร์รายงานทั้ง 15 ประเภท การส่งออก Excel XML ทั้ง 15 ไฟล์ การจัดหน้า A4 แนวนอน สิทธิ์ผู้ใช้ทั่วไป 13 รายงาน และความกว้าง **360 / 768 / 1024 / 1440 / 1920px** ที่แสดงครบ 16 คอลัมน์บนจอ 1920px) และรันสคริปต์ตรวจสอบเพิ่มเติมบน Microsoft Edge headless ยืนยัน `<optgroup>`, ปีงบประมาณ 17 ปี + query นอกช่วง, การกดลบชิปตัวกรอง, ชื่อผู้พิมพ์ `full_name`, `Toast` ส่งออกไฟล์, การเรียงลำดับตาราง `/history` ทั้ง 4 คอลัมน์, แท็บ `/indicators` ที่ `< 1024px` และการคงค่าค้างเมื่อสลับแท็บ, รวมถึงเส้นแกนกราฟและช่องค้นหาข่าวหน้า `/` โดยไม่เกิด horizontal scroll หรือ page error
- **ไฟล์ที่แก้:** `new-system/frontend/components/ui/primitives.jsx`, `new-system/frontend/components/ReportViewer.jsx`, `new-system/frontend/styles/reports.css`, `new-system/frontend/components/history/HistoryResults.jsx`, `new-system/frontend/app/indicators/page.js`, `new-system/frontend/styles/indicators.css`, `new-system/frontend/components/home/Dashboard.jsx`, `new-system/frontend/app/page.js`, `new-system/frontend/styles/home.css`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** สคริปต์ทดสอบเบราว์เซอร์เดิม `tests/browser/indicators.cjs` (บรรทัด 37) ยังตรวจตำแหน่งการ์ดซ้อนกันแนวตั้งบนจอ `< 1024px` ตามดีไซน์ก่อนมีแท็บ หากต้องการให้ปรับ assertion ในไฟล์ทดสอบดังกล่าวให้สอดคล้องกับแท็บใหม่ในรอบถัดไปสามารถแจ้งยืนยันได้

## 27 พฤศจิกายน 2569 — เปลี่ยนช่องตัวเลขหน้า `/entries` เป็น `type="text" inputMode="numeric"` เพิ่มคำอธิบายปุ่มยืนยัน และลดความรกของฟอร์ม

- **1) เปลี่ยนช่องกรอกตัวเลขใน `/entries` เป็น `type="text" inputMode="numeric"` ตามสเปก A3/D:**
  - `new-system/frontend/app/entries/page.js`: สร้าง `EntryNumberInput` (`type="text" inputMode="numeric" pattern="[0-9]*" data-entry-number="true"`) ป้องกันอักขระที่ไม่ใช่ตัวเลข (`e`, `+`, `-`, `.`) แปลงเลขไทย `๐-๙` เป็นอารบิกอัตโนมัติ คงความต่างระหว่าง `""` กับ `0` และตั้ง `setCustomValidity(...)` ตามเงื่อนไข `required`, `min` (จำนวนเตียง ≥ 1, ช่องอื่น ≥ 0), `max` (`2147483647`) และจำนวนเต็ม เพื่อให้ browser validation, `revealInvalidField` และ `onInvalid` ทำงานเหมือนเดิมทุกประการ
  - `new-system/frontend/components/entries/useEntryEditing.js` และ `new-system/frontend/styles/entries.css`: เปลี่ยนตัวตรวจจับจาก `type === "number"` / `input[type="number"]` เป็น `dataset.entryNumber === "true"` / `input[data-entry-number="true"]` ทั้งในตัวกัน scroll wheel, `moveField` (`Tab` / `Enter` / `Shift+Tab` / `Shift+Enter` ครบ 59 ช่อง) และกฎ CSS (`font-size`, `min-height`, `scroll-margin-block`)
- **2) อธิบายเหตุผลเมื่อปุ่ม “ยืนยันการส่งข้อมูล” กดไม่ได้:**
  - `new-system/frontend/app/entries/page.js` และ `new-system/frontend/styles/entries.css`: เมื่อมีรายการเดิมและ `dirty === true` แสดงข้อความช่วย `"บันทึกการแก้ไขก่อน จึงจะยืนยันการส่งข้อมูลได้"` ใน `StickyActionBar` พร้อมผูก `aria-describedby="entry-confirm-disabled-reason"` กับปุ่มยืนยัน
- **3) ปรับสัดส่วนและลดความรกในหน้าฟอร์ม:**
  - `new-system/frontend/styles/entries.css`: ลด `min-height` และ `padding` ของหัวกล่อง `.entry-flow-section > summary` และ `.entry-core-sections .entry-section > summary` บนจอกว้าง (`@container daily-entry (min-width: 1000px)`) พร้อมปรับสัดส่วนคอลัมน์ให้หัวตารางทั้งสองแถวสูงเสมอกัน (~68px จากเดิม 108px) โดยไม่เหลือพื้นที่ว่างสีเทาเกินจำเป็น
  - `new-system/frontend/app/entries/page.js`: เพิ่ม `placeholder="ระบุจำนวน"` ในช่อง `amount_bed` และ `placeholder="เว้นว่างได้หากยังไม่บันทึก"` ในช่อง `readmit_count` และ `discharge_count`
  - `new-system/frontend/components/entries/EntryReview.jsx` และ `new-system/frontend/app/entries/page.js`: แทนที่การ์ดใหญ่หลังบันทึกด้วยแถบกะทัดรัดบรรทัดเดียว `EntrySavedBanner` (`.entry-saved-bar` สูง ~62px) แสดงเวลาบันทึกล่าสุดพร้อมปุ่มทางลัด `บันทึกเวรถัดไป` / `เลือกวันและเวรถัดไป` และ `ไปหน้ารอยืนยัน` โดยไม่ซ้ำหัวข้อใหญ่กับ `Toast`
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **49/49** และ `npm run build` ผ่านครบ **11 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามเดิม)
  - ทดสอบบน Microsoft Edge headless ที่ความกว้าง **360 / 768 / 1024 / 1280 / 1440px**: เลื่อนช่องเวรบ่ายด้วยคีย์บอร์ดล้วน (`Tab` / `Enter` / `Shift+Tab`) ครบทั้ง **59 ช่อง** ทั้งจอกว้าง 1440px และมือถือ 360px จนถึงปุ่มบันทึก พิมพ์ `e`/`-`/`+`/`.` ไม่เข้า แปลงเลขไทย `๑๕` → `15` อัตโนมัติ กันค่า `amount_bed = ""` และ `amount_bed = "0"` ก่อนเปิด `ConfirmDialog` คงช่องรายเดือนว่างเป็น `""` โดยไม่ปลอมเป็น `0` และส่ง JSON body เดิมทุกฟิลด์
- **ไฟล์ที่แก้:** `new-system/frontend/app/entries/page.js`, `new-system/frontend/components/entries/useEntryEditing.js`, `new-system/frontend/components/entries/EntryReview.jsx`, `new-system/frontend/styles/entries.css`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** สคริปต์ทดสอบเบราว์เซอร์เดิม 2 ไฟล์ (`tests/browser/entry-editing.cjs` บรรทัด 63 และ `tests/browser/history.cjs` บรรทัด 48) มี selector นับ `input[type=number][name]` ซึ่งยังไม่ได้แตะเนื่องจากอยู่นอกไฟล์เป้าหมายของรอบนี้ หากต้องการให้ปรับ selector เป็น `input[data-entry-number="true"][name]` ในรอบถัดไปสามารถแจ้งยืนยันได้

## 27 พฤศจิกายน 2569 — ลดความซ้ำซ้อนของหัวข้อ/Breadcrumb ปรับ `TextSizeControl` บนมือถือ ปรับหน้าต่างโปรไฟล์ หน้า `/users` และใช้ `next/link`

- **1) ลดความซ้ำซ้อนของหัวข้อหน้าและ Breadcrumb:**
  - `new-system/frontend/components/shell/ShellFrame.jsx`, `new-system/frontend/styles/shell.css`, `new-system/frontend/components/ui/layout.jsx` และ `new-system/frontend/app/users/page.js`: ถอด `.shell-page-title` ที่ซ้ำกับ `h1` ของ `PageHeader` ออก ให้แถบหัวของ `ShellFrame` แสดงเฉพาะไอคอนหน้าปัจจุบัน เส้นทางหน้าปัจจุบัน (Breadcrumb) วันที่ พ.ศ. หอผู้ป่วยปัจจุบัน และสถานะการเชื่อมต่อ บนมือถือซ่อน `.shell-heading` เพื่อให้ Header กะทัดรัดเหลือแถวเดียว และป้องกันการแสดง Breadcrumb ซ้อน 2 ชุดบน `/reports`, `/occupancy` และ `/users`
- **2) ลดความสูงของแถบปรับขนาดตัวอักษร (`TextSizeControl`) บนมือถือ:**
  - `new-system/frontend/components/TextSizeControl.jsx` และ `new-system/frontend/styles/text-size.css`: ปรับการจัดวางบนจอ `< 768px` ให้เรียงบรรทัดเดียว (`flex-wrap: nowrap`) ลดระยะขอบแนวตั้งเป็น `--space-1` และแสดงข้อความสั้น `"ปกติ"` บนจอแคบ (คง `aria-label="ขนาดปกติ"` คงระดับ 100% / 112.5% / 125% การจำค่าใน `localStorage` และขนาดกดปุ่ม ≥ 44×44px ทุกขนาดจอ)
- **3) ปรับหน้าต่าง “โปรไฟล์” ใน `ShellFrame.jsx`:**
  - แสดงหัวข้อ “หอผู้ป่วยที่เข้าถึงได้” จากรายการ `wards` ที่มีอยู่ใน `ShellFrame`: หากเป็น `user.is_admin` แสดงข้อความ `"เข้าถึงและจัดการได้ทุกหอผู้ป่วย"` หากเป็นผู้ใช้ทั่วไปแสดงรายชื่อแต่ละหอผู้ป่วยพร้อมป้ายสิทธิ์ `"บันทึกและยืนยันได้"` (`can_write: true`) หรือ `"อ่านอย่างเดียว"` (`can_write: false`)
- **4) ปรับ UX หน้าจัดการผู้ใช้และสิทธิ์ (`/users`):**
  - `new-system/frontend/app/users/page.js` และ `new-system/frontend/styles/users.css`: เปลี่ยนป้าย `"บัญชีปัจจุบัน"` และป้ายขอบเขตสิทธิ์ใน `ROLE_GUIDE` จาก `StatusBadge` (ที่มีไอคอนนาฬิกา) เป็น `.ui-badge` โทน `ui-tone--info` / `ui-tone--neutral` ธรรมดา; เปลี่ยนส่วนคำอธิบายบทบาทเป็น `<details>` ที่พับเก็บไว้เป็นค่าเริ่มต้นพร้อมหัวข้อ `"ดูคำอธิบายบทบาทและขอบเขตสิทธิ์"`; เพิ่มตัวกรองฝั่ง client ตาม `"สถานะบัญชี"` (ทั้งหมด / ใช้งานอยู่ / ปิดใช้งาน) และ `"บทบาท"` (ทั้งหมด / ผู้ดูแลระบบ / ผู้ตรวจสอบ / ผู้บันทึกประจำหอ / ผู้ดูรายงาน) ควบคู่ช่องค้นหาเดิมพร้อมปุ่มล้างตัวกรอง; และเปลี่ยนปุ่ม `"กลับหน้าแรก"` กรณีไม่มีสิทธิ์เป็น `<Link href="/">`
- **5) ปรับลิงก์ภายในเป็น `next/link` อย่างปลอดภัย:**
  - เปลี่ยนลิงก์ภายในใน `ShellFrame.jsx` (ตราชื่อระบบ เมนูหลัก Breadcrumb เมนูมือถือ และ Drawer) และ `PageHeader` (`layout.jsx`) เป็น `<Link href>` ของ Next.js (คง `<a target="_blank">` สำหรับลิงก์ภายนอกความพึงพอใจ และ `<a href="#main-content">` สำหรับ skip link) พร้อมรองรับการสลับ query ภายใน `/history` ↔ `/history?status=unconfirmed`
  - ยืนยันผลบนเบราว์เซอร์จริงว่าตัวดักข้อมูลค้าง `document.addEventListener("click", leave, true)` ใน `useEntryEditing.js` (`/entries`) และ `app/indicators/page.js` (`/indicators`) ทำงานใน capture phase ก่อน `<Link>` บล็อกการเปลี่ยนหน้าและเปิด `ConfirmDialog` เตือนข้อมูลที่ยังไม่บันทึกได้ครบถ้วน
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **49/49** และ `npm run build` ผ่านครบ **11 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามเดิม)
  - ทดสอบด้วย Microsoft Edge headless บนเซิร์ฟเวอร์บิลด์จริงครบ **56 กรณี** (`/login`, `/`, `/entries`, `/history`, `/reports`, `/occupancy`, `/users` × ความกว้าง **360 / 768 / 1024 / 1440px** × ขนาดตัวอักษร **100% และ 125%**) ไม่พบ horizontal scroll มี `h1` เดียวและไม่มี Breadcrumb ซ้อนทุกหน้า แถบ `TextSizeControl` บนจอ 360px ไม่ตัดขึ้นบรรทัดใหม่แม้ที่ 125% ปุ่มทุกปุ่ม ≥ 44×44px ตัวกรอง `/users` หน้าต่างโปรไฟล์ และตัวดักข้อมูลค้างของ `<Link>` ทำงานถูกต้อง ไม่มี page error
- **ไฟล์ที่แก้:** `new-system/frontend/components/shell/ShellFrame.jsx`, `new-system/frontend/components/TextSizeControl.jsx`, `new-system/frontend/styles/shell.css`, `new-system/frontend/styles/text-size.css`, `new-system/frontend/app/users/page.js`, `new-system/frontend/styles/users.css`, `new-system/frontend/components/ui/layout.jsx`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** ไม่มีสำหรับงานชุดนี้

## 27 พฤศจิกายน 2569 — แทน `window.confirm` ด้วย `ConfirmDialog` และปรับ `Toast` ให้ปิดอัตโนมัติและแสดงผลตำแหน่งเดียวกันทุกหน้า

- **1) แทน `window.confirm` ด้วย shared `ConfirmDialog` ครบทั้ง 3 จุด:**
  - `new-system/frontend/app/page.js`: เปลี่ยนการยืนยันลบข่าวจาก `window.confirm` เป็น `ConfirmDialog` แบบ `destructive` แสดงหัวข้อข่าวที่จะลบ ปุ่มยืนยัน `"ลบข่าวประกาศ"` พร้อม `loading={busy}` และปรับปุ่ม `"ลบข่าว"` ให้มีไอคอน `close` และโทนสี `danger` (`variant="ghost" className="ui-tone--danger"`) แยกจากปุ่ม `"แก้ไขข่าว"` ชัดเจน โดยคง `DELETE /news/{id}?version=...` เดิม
  - `new-system/frontend/app/entries/page.js`: คงลำดับตรวจ HTML constraint validity และคู่ช่องการกลับมารักษาซ้ำให้ผ่านก่อน แล้วเปิด `ConfirmDialog` ตอนบันทึกข้อมูล (แสดงสรุป `หอผู้ป่วย · เวร · วันที่ พ.ศ.` และหาก `review.warnings.length > 0` แสดง `InfoCallout tone="warning"` ข้อความ `"พบข้อควรตรวจสอบ X จุด (ยังสามารถบันทึกได้)"`) และตอนยืนยันการส่งข้อมูล (แสดงสรุปบริบทพร้อมคำเตือนว่าเมื่อยืนยันแล้วจะไม่สามารถแก้ไขได้จนกว่าผู้ดูแลระบบจะส่งกลับ) รองรับ `loading={busy}` ปิดด้วย `Esc` และ focus trap โดยคง payload `POST/PATCH /entries` และ `POST /entries/{id}/confirm` เดิมทุกฟิลด์
- **2) ปรับ shared `Toast` ให้ปิดอัตโนมัติและแสดงผลตำแหน่งลอยมาตรฐานเดียวกันทุกหน้า:**
  - `new-system/frontend/components/ui/overlays.jsx` และ `new-system/frontend/styles/foundation.css`: เพิ่ม prop `duration = 4500` ให้ `Toast` ปิดอัตโนมัติเมื่อ `open === true` และ `tone !== "danger"` (กรณี `danger` ให้ผู้ใช้กดปิดเอง) หยุดนับเวลาเมื่อเมาส์วางทับ (`hover`) หรือมีโฟกัสอยู่ภายใน (`focus`) พร้อมล้าง timer ใน cleanup และตั้ง `pointer-events: none` บน `.ui-toast-region` เพื่อไม่ให้กรอบว่างบังการคลิก
  - `new-system/frontend/app/users/page.js` และ `new-system/frontend/styles/users.css`: ย้าย `<Toast>` ออกจากกลางหน้าไปไว้ใน `.users-toast` ลอยมุมขวาล่าง (`position: fixed` และหลบ `--mobile-nav-height` บนจอ `< 768px`)
  - `new-system/frontend/app/indicators/page.js` และ `new-system/frontend/styles/indicators.css`: เพิ่ม `<Toast>` แจ้งเตือนเมื่อบันทึกข้อมูลแผลกดทับหรือการกลับมารักษาซ้ำสำเร็จใน `.indicators-toast` ลอยมุมขวาล่างมาตรฐานเดียวกัน พร้อมเว้นระยะด้านล่างของ `.indicators-page` ไม่ให้บังปุ่มบันทึก และคงข้อความสถานะเดิมในการ์ดไว้
- **3) ปรับ selector ของ `ConfirmDialog` ในสคริปต์ทดสอบเบราว์เซอร์:**
  - `new-system/frontend/tests/browser/daily-workflow.cjs`, `daily-readback.cjs`, `entry-editing.cjs`, `text-size.cjs`: ปรับเฉพาะขั้นตอนกดปุ่มยืนยันใน `ConfirmDialog` แทนการพึ่ง `page.on('dialog')` ของ native confirm โดยไม่เปลี่ยน assertion ของข้อมูลหรือ API payload
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **49/49** และ `npm run build` ผ่านครบ **11 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามเดิม)
  - ตรวจ `git diff` ยืนยันว่าแก้เฉพาะ presentation layer และ selector ของ `ConfirmDialog` ในสคริปต์ทดสอบเบราว์เซอร์ ไม่แตะ backend สูตรคำนวณ หรือ payload API
  - วิธีทดสอบที่ **360 / 768 / 1024 / 1440px**: เปิด `/` (ผู้ดูแล) ทดลองกด “ลบข่าว” ตรวจสีปุ่ม/ไอคอน กด `Esc` ปิด `ConfirmDialog` ทดสอบ Tab วน focus trap และกดยืนยันลบ; เปิด `/entries` ทดลองกรอกค่าให้เกิดคำเตือนแล้วกดบันทึก ตรวจสรุปหอ/เวร/วันที่ พ.ศ. และข้อความเตือน X จุด รวมถึงกด “ยืนยันการส่งข้อมูล” ตรวจข้อความล็อกการแก้ไขและสถานะ `busy` กันกดซ้ำ; เปิด `/indicators` และ `/users` บันทึกข้อมูลแล้วตรวจว่า `Toast` ลอยมุมขวาล่าง ไม่บังปุ่มบันทึกหรือ bottom nav หยุดเวลาเมื่อวางเมาส์หรือโฟกัส และปิดเองหลัง ~4.5 วินาที
- **ไฟล์ที่แก้:** `new-system/frontend/components/ui/overlays.jsx`, `new-system/frontend/app/page.js`, `new-system/frontend/app/entries/page.js`, `new-system/frontend/app/indicators/page.js`, `new-system/frontend/app/users/page.js`, `new-system/frontend/styles/foundation.css`, `new-system/frontend/styles/users.css`, `new-system/frontend/styles/indicators.css`, `new-system/frontend/tests/browser/daily-workflow.cjs`, `new-system/frontend/tests/browser/daily-readback.cjs`, `new-system/frontend/tests/browser/entry-editing.cjs`, `new-system/frontend/tests/browser/text-size.cjs`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** ไม่มีสำหรับงานชุดนี้

## 27 พฤศจิกายน 2569 — ปรับคำศัพท์มาตรฐาน A5 เลิกใช้สไตล์เก่า และเพิ่มปุ่มแสดง/ซ่อนรหัสผ่าน (`PasswordInput`)

- **1) ปรับคำศัพท์ให้ตรงมาตรฐาน A5 และตัดศัพท์เทคนิค:**
  - `new-system/frontend/lib/api.js`: เปลี่ยนข้อความแจ้งเตือน `"รีแอดมิต"` → `"การกลับมารักษาซ้ำ"`, `"อัตราครองเตียง"` → `"อัตราการครองเตียง"`, และ `"ระบบหลังบ้านขัดข้องชั่วคราว"` → `"ระบบขัดข้องชั่วคราว"` โดยคง key และ status code เดิมทั้งหมด
  - `new-system/frontend/app/entries/page.js`: เปลี่ยนข้อความแจ้งเตือน `"ในส่วนรีแอดมิต"` → `"ในส่วนการกลับมารักษาซ้ำ"`
  - `new-system/frontend/components/home/Dashboard.jsx`: เปลี่ยนข้อความหมายเหตุ `"อัตราครองเตียง"` → `"อัตราการครองเตียง"`
  - `new-system/frontend/app/users/page.js`: เปลี่ยนข้อความเตือน `"เซสชันที่เปิดค้างอยู่"` → `"อุปกรณ์อื่นที่เข้าสู่ระบบค้างไว้"` ให้สอดคล้องกับหน้าต่างเปลี่ยนรหัสผ่าน
  - `new-system/frontend/app/layout.js` และ `new-system/frontend/app/login/page.js`: ใช้ชื่อระบบตรงกันเป็น `"ระบบรายงานจำนวนผู้ป่วยใน"`
- **2) เลิกใช้สไตล์และ helper เก่าในจุดที่ค้าง:**
  - `new-system/frontend/app/login/page.js`: เปลี่ยนกล่องแจ้งข้อผิดพลาดจาก `<div className="alert error" role="alert">` เป็น `InfoCallout tone="danger" role="alert"` โดยไม่แตะ logic `submit`
  - `new-system/frontend/app/entries/page.js`: ย้ายการ import `todayISO` และการจัดรูปแบบวันที่ไทยจาก `@/components/DateField` ไปใช้ `todayISO` และ `formatThaiDate(..., { month: "long" })` จาก `@/lib/thai-date.mjs` (คงไฟล์ `DateField.jsx` ไว้ยังไม่ได้ลบ)
- **3) เพิ่มปุ่มแสดง/ซ่อนรหัสผ่าน (`PasswordInput`):**
  - `new-system/frontend/components/ui/Icon.jsx`: เพิ่มไอคอน `eye` และ `eyeOff`
  - `new-system/frontend/components/ui/primitives.jsx`, `new-system/frontend/components/ui/index.js`, `new-system/frontend/styles/foundation.css`: เพิ่มและ export `PasswordInput` บนโครงสร้าง `FormField` + `.ui-input-action` สลับ `type="password"` / `type="text"` ด้วยปุ่ม `type="button"` พร้อม `aria-label` (“แสดงรหัสผ่าน” / “ซ่อนรหัสผ่าน”), `aria-pressed`, touch target ≥ 44×44px (ผ่าน `--control-height`), เชื่อม `aria-describedby` ร่วมกับข้อความ error/hint และซ่อน `::-ms-reveal` ซ้ำของเบราว์เซอร์
  - นำ `PasswordInput` ไปใช้แทน `TextInput type="password"` ครบทั้ง 8 ช่องใน `app/login/page.js` (1 ช่อง), `components/shell/ShellFrame.jsx` (เปลี่ยนรหัสผ่าน 3 ช่อง) และ `app/users/page.js` (เพิ่มผู้ใช้ใหม่ 2 ช่อง และตั้งรหัสผ่านใหม่ 2 ช่อง)
- **การตรวจสอบและวิธีทดสอบ:**
  - `npm run test:ui` ผ่าน **49/49** และ `npm run build` ผ่านครบ **11 เส้นทาง** (ส่วน `npm run lint` และ `npx tsc --noEmit` ยังไม่มีสคริปต์และ compiler ในโปรเจกต์ตามข้อจำกัดเดิม โดยไม่เพิ่ม dependency)
  - ตรวจ `git diff` ยืนยันว่าแก้เฉพาะ presentation layer ไม่แตะ backend, สูตรคำนวณ, API contract หรือ routing
  - วิธีทดสอบ Responsive ที่ **360 / 768 / 1024 / 1440px**: เปิด `/login` ตรวจชื่อหัวเรื่อง กล่อง `InfoCallout` เมื่อกรอกผิด และปุ่มแสดง/ซ่อนรหัสผ่าน (ขนาดกด ≥ 44×44px ไม่ส่งฟอร์มเอง); เข้าสู่ระบบตรวจหน้าต่าง “เปลี่ยนรหัสผ่าน” จากเมนูผู้ใช้/Drawer ทั้ง 3 ช่อง; เปิด `/users` (บัญชีผู้ดูแลระบบ) ตรวจหน้าต่าง “เพิ่มผู้ใช้ใหม่” และ “ตั้งรหัสผ่านใหม่” พร้อมข้อความเตือนอุปกรณ์อื่น; เปิด `/` และ `/entries` ตรวจข้อความอัตราการครองเตียง การกลับมารักษาซ้ำ และกล่องยืนยันวันที่ พ.ศ. แบบเดือนเต็ม
- **ไฟล์ที่แก้:** `new-system/frontend/lib/api.js`, `new-system/frontend/app/layout.js`, `new-system/frontend/app/login/page.js`, `new-system/frontend/app/entries/page.js`, `new-system/frontend/app/users/page.js`, `new-system/frontend/components/home/Dashboard.jsx`, `new-system/frontend/components/shell/ShellFrame.jsx`, `new-system/frontend/components/ui/Icon.jsx`, `new-system/frontend/components/ui/primitives.jsx`, `new-system/frontend/components/ui/index.js`, `new-system/frontend/styles/foundation.css`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** ปัจจุบันไม่มีไฟล์หรือชุดทดสอบใน `new-system/frontend` ที่ import `@/components/DateField` แล้ว คงไฟล์ `DateField.jsx` ไว้ก่อนตามคำสั่ง หากต้องการให้ลบไฟล์ออกในรอบถัดไปสามารถแจ้งยืนยันได้

## 27 พฤศจิกายน 2569 — สถานะหลังตรวจทั้งสี่เฟส

- ผลเทียบรายงานเตียงทั้งสามช่องทางมีแล้ว รอหัวหน้าหอรับรองเกณฑ์เตียงเวรล่าสุดรายหอสำหรับแถวรวม ส่วน Productivity หน้าจอตรง 124 ช่อง รอตัวอย่างใบพิมพ์หรือ Excel เดิมที่สร้างจบเพื่อยืนยันตัวเลขและแถวรวมท้ายตาราง
- ทางเข้าความพึงพอใจผ่านตัวรับทดสอบในเครื่อง รอปลายทางทดสอบ วิธีระบุตัวผู้ใช้ และบัญชีที่ทราบหอ พร้อมยืนยันว่าบนหน้าบันทึกเวรเมนูหลักควรอิงหอในแถบหัวหรือหอในฟอร์ม
- ซ้อมย้ายครบหกตารางและกู้คืนบนฐานแยกผ่าน รอสำเนาที่ได้รับอนุญาต ตารางจับคู่บัญชี หอผู้ป่วยตรวจรับ และการซ้อมกู้คืนบนเครื่องเป้าหมายพร้อมแผนรองรับรายการที่กรอกหลังสลับระบบ
- รอบนี้แก้เฉพาะบันทึกนี้และตรวจผลของสี่เฟส Build ผ่าน ส่วน lint และ typecheck แยกยังขาดเครื่องมือเดิม ใช้หลักฐานเบราว์เซอร์เดิมที่ 360/768/1024/1440px ไม่ได้ทดสอบหน้าจอซ้ำ

## 26 พฤศจิกายน 2569 — ตรวจความพร้อมข้อมูลย้อนหลังและกู้คืน

- ตรวจ SHA-256 และส่วนข้อมูลใน `inpatient/db/db_inpatient.sql` ซ้ำ พบ 0 แถวทั้งหกตารางและไม่มีช่วงวันที่ พบเพียงไฟล์ SQL นี้กับแม่แบบ ยังรอสำเนาที่โรงพยาบาลอนุญาต ผลสำรวจจำนวนและช่วงวันที่จริง ไฟล์ CSV หกตาราง ตารางบัญชี `legacy_account_id,target_username` และรหัสหอ/เวรอ้างอิง [รายการขอจากฝ่ายไอทีและตารางผลกระทบยอด](rollout/readiness-2026-11-26.md)
- ซ้อม dry-run → apply → กระทบยอด → รันซ้ำด้วยตัวนำเข้าเดิมบน PostgreSQL แยก ข้อมูลสมมติผ่าน `data_all` 13, `data_confirm` 3, `data_split_patient` 5 (เป็น 130 ช่องปลายทาง), `pressure` 4, `readmit` 4, `tb_news` 2 รันซ้ำเพิ่ม 0 ทั้งหกตาราง คงสถานะยืนยัน 8/รอยืนยัน 5 และตรวจประวัติครบ 3 เหตุการณ์ แยกเตียง NULL และแถวแผลกดทับ 0/0 จากช่องว่างที่ถูกปฏิเสธ
- กู้สำเนาหลังนำเข้าลงฐานใหม่แล้วจำนวนและเนื้อหา 10 ตารางตรง เปิดรายงานและอ่านประวัติได้ตรงเดิม กู้สำเนาก่อนนำเข้าลงอีกฐานแล้วทั้ง 10 ตารางกลับเป็น 0 ตรวจ `/reports?kind=daily-all` ที่ 360/768/1024/1440px ทั้งฐานนำเข้าและฐานกู้คืน ยอด 12/18 ตรงที่จอและ Excel XML รวม 16 กรณี [ผลรันและกู้คืน](rollout/readiness-evidence-2026-11-26.json)
- หอผู้ป่วยมีตัวอย่างรายเวร ประวัติ สาขา แผลกดทับ กลับมารักษาซ้ำ และข่าวสำหรับตรวจตามแล้ว ยังไม่มีผลตรวจรับโดยพยาบาลหรือหัวหน้าหอจากสำเนาจริง ให้ลงชื่อผู้ตรวจและบันทึกผลต่างหลังเลือกวันและเดือนจากสำเนาเดียวกัน การสลับใช้งานจริงรออนุมัติแยก
- แก้เฉพาะ `docs/ui-progress.md` และเพิ่ม `docs/rollout/readiness-2026-11-26.md`, `docs/rollout/readiness-evidence-2026-11-26.json` ชุดทดสอบหน้าบ้านผ่าน 48/48 หลังบ้านผ่าน 34/34 และ build ผ่าน 11 เส้นทาง โครงการไม่มีสคริปต์ lint และ TypeScript compiler สำหรับรันแยก

## 26 พฤศจิกายน 2569 — ตรวจทางเข้าอัตราความพึงพอใจ

- PHP เปิด `../contentment/index.php?ward=…&id=…` โดยใช้รหัสหอจากเซสชันและ `account.id` จากคุกกี้ ของใหม่คำนวณลิงก์ผ่าน `satisfactionLink` ทั้งเมนูหลักและ `/entries` เมื่อ URL เป็น HTTP/HTTPS หอมีรหัสเดิม และบัญชีมีสิทธิ์บันทึก ฟังก์ชันกำหนด `ward` และคงพารามิเตอร์ที่ตั้งไว้ใน URL ปลายทาง [เมนู PHP](../../inpatient/menu.php#L21) · [ที่มารหัสบัญชี PHP](../../inpatient/login_check.php#L34) · [สร้างลิงก์ใหม่](../frontend/lib/satisfaction.mjs) · [เมนูใหม่](../frontend/components/shell/ShellFrame.jsx#L47) · [หน้าบันทึกเวร](../frontend/app/entries/page.js#L49)
- **เปิดลิงก์จากระบบใหม่ได้** ทดสอบ Edge ที่ 360/768/1024/1440px บน Next.js และ FastAPI กับ PostgreSQL แยก ใช้บัญชีสมมติสามแบบ ผู้บันทึกสองหอ ผู้ใช้อ่านอย่างเดียว และผู้บันทึกหอ 10 แต่อ่านอย่างเดียวในหอ 11 เมื่อกำหนด URL ตรวจ 56 กรณีในสองทางเข้า เปิดแท็บไปยังตัวรับทดสอบในเครื่องจริง 32 ครั้ง ตัวรับแสดงรหัสหอตามตัวเลือกของทางเข้านั้นและได้รับเฉพาะพารามิเตอร์ทดสอบที่ตั้งไว้กับ `ward` บัญชีอ่านอย่างเดียวและหอที่อ่านได้อย่างเดียวซ่อนลิงก์ เมื่อไม่กำหนด URL ทั้งสองทางเข้าซ่อนลิงก์ครบ 16 กรณี
- **ตัวเลือกหอทั้งสองจุดเป็นคนละตัว** เมนูใช้ “หอผู้ป่วยปัจจุบัน” ในแถบหัวหน้า ส่วน `/entries` ใช้ “หอผู้ป่วย” ในแบบเลือกวันและเวร ในหน้าเดียวกันเมื่อเปลี่ยนเฉพาะหอในฟอร์มจาก 10 เป็น 11 ลิงก์ฟอร์มเปิดหอ 11 และลิงก์เมนูยังเปิดหอ 10 เมื่อเปลี่ยนเฉพาะตัวเลือกแถบหัวหน้า ลิงก์เมนูเปลี่ยนตามและลิงก์ฟอร์มยังอิงหอในฟอร์ม หากต้องการให้ลิงก์เมนูบน `/entries` อิงหอในฟอร์มด้วย ต้องยืนยันก่อนปรับ เพราะเปลี่ยนทั้งรหัสหอที่ส่งและการแสดงลิงก์เมื่อสิทธิ์ของสองหอต่างกัน
- **ตรวจผู้ใช้และหอที่ปลายทางจริงยังรอผู้ดูแล** พบเพียงตัวแปร `NEXT_PUBLIC_SATISFACTION_URL` ในเอกสารและไฟล์ตัวอย่าง ยังไม่พบโปรแกรมปลายทาง URL ทดสอบที่ได้รับอนุญาต หรือข้อกำหนดระบุตัวผู้ใช้ ขอ URL ทดสอบ วิธีเข้าสู่ระบบหรือส่งต่อการยืนยันตัวตนที่โปรแกรมรองรับ และบัญชีทดสอบพร้อมรหัสหอที่อนุญาตและผลคาดหวังเมื่อสลับหอ ตัวรับในเครื่องสะท้อนค่า `ward` เพื่อยืนยันการส่งเท่านั้น [ตัวอย่างการตั้งค่า](../frontend/.env.example) · [รายการตรวจรับ W11](../INPATIENT_PARITY_TH.md#L63)
- แก้เฉพาะ `docs/ui-progress.md` ชุดทดสอบหน้าบ้านผ่าน 48/48 รวมทดสอบลิงก์ 5 กรณี หลังบ้านผ่าน 34/34 และ build ผ่าน 11 เส้นทางทั้งสองแบบ โครงการไม่มีสคริปต์ lint และ TypeScript compiler สำหรับรันแยก

## 26 พฤศจิกายน 2569 — ตรวจรายงานผลผลิตทางการพยาบาล (Productivity)

- ตรวจเฉพาะรายงาน Productivity ตามปุ่มพิมพ์และ Excel ใน `inpatient/productivity.php` ไปที่ `inpatient/report/productivity_r.php` ทั้งสองโหมด ใช้ข้อมูลสมมติชุดเดียวกันสำหรับหอทั่วไป 10 และหอ 12, 13, 28 [ตารางผลรายวัน รวมเดือน และเทียบช่องทาง](productivity-report-parity.md)
- หน้าจอ PHP และระบบใหม่ตรงกันครบ 124 ช่องตัวเลข PHP โหมดพิมพ์และ Excel สร้างหัวตาราง 32 คอลัมน์ได้และหยุดก่อนตัวเลขวันแรกที่บรรทัด 81 เพราะอ่าน `$result` แทน `$result5` ผลนิพจน์ที่แยกรันตรงกับ PDF และ XML ของใหม่ หอ 28 รวมเดือนบนหน้าจอ 76.72% และใบพิมพ์/Excel ใหม่ 52.91% ตามน้ำหนักของแต่ละช่องทาง
- ตรวจแถวรวมทุกหอแยกจากคอลัมน์รวมเดือน หน้าจอ PHP รอบปกติและระบบใหม่แสดงเฉพาะแถวรายหอ โหมดพิมพ์/Excel PHP มีเงื่อนไขสำหรับแถวรวมในซอร์สและรันไปไม่ถึง รอตัวอย่างตารางใบพิมพ์หรือ Excel เดิมที่ลบข้อมูลระบุตัวบุคคล เพื่อยืนยันค่ารายหอและช่วงท้ายตาราง
- ตรวจ `/reports?kind=productivity&month=2026-11&status=all` ที่ 360/390/768/1024/1280/1440/1920px รวมมุมมองการ์ดและเลื่อนตาราง ตรวจ PDF A4 แนวนอน 4 หน้าและ Excel XML ที่ดาวน์โหลดจริง ชุดทดสอบหน้าบ้าน 48/48 หลังบ้าน 34/34 และ build ผ่าน 11 เส้นทาง โครงการไม่มีสคริปต์ lint และ TypeScript compiler สำหรับรันแยก
- รอบนี้แก้สองไฟล์คือ `docs/productivity-report-parity.md` และ `docs/ui-progress.md` หากเอกสารจากโรงพยาบาลแสดงสูตรหรือแถวรวมต่างจากผลที่ตรวจ ให้สรุปผลกระทบและขออนุมัติก่อนเปลี่ยนการคำนวณ

## 26 พฤศจิกายน 2569 — ตรวจอัตราครองเตียงและอัตราหมุนเวียนเตียง

- รันหน้าจอ ใบพิมพ์ และ Excel ของ PHP และระบบใหม่บนฐานทดสอบแยก ใช้หอสมมติ A/B ชุด P1 และอีกสี่เดือนที่ครอบคลุมเตียงคงที่/เพิ่มกลางเดือน × เวรครบ/ขาดหนึ่งเวร [ตารางตัวตั้ง เตียง และผลรายหอ/รวม](bed-report-parity.md) · [ค่าที่อ่านได้แยกช่องทาง](bed-report-evidence.json)
- เดือนมิถุนายนครบ 180/180 เวร รวม 480 วันนอน PHP รอบแรกใช้ 30 เตียง ได้ 53.33% ระบบใหม่ใช้ 35 เตียง ได้ 45.71% เดือนกันยายนขาดเวรดึกของ A หนึ่งเวร PHP เว้นว่างที่ A และรวม ระบบใหม่แสดง 89/90 และ 179/180 ส่วน B ครบและได้ 60.00% ทั้งคู่
- ตัวอย่างหมุนเวียน P1 รวม 7 ราย PHP รอบแรกได้ 7 ÷ (20 + 10) = 0.23 ระบบใหม่ได้ 7 ÷ (25 + 10) = 0.20 เมื่อนำเข้ารายการเดิมย้อนลำดับ PHP เปลี่ยนเป็น 0.20 ทั้งจอ ใบพิมพ์ และ Excel คำค้นแถวรวมไม่ได้ผูกเตียงกับเวรใดแน่นอน
- เปิด `/occupancy?year=2570` และ `/reports?kind=turnover&year=2570` ที่ 360/768/1024/1440px ตรวจตัวเลขในตารางทั้งสองหน้า ใบพิมพ์ PDF และ Excel XML ที่ส่งออกจริง ชุดทดสอบหน้าบ้านผ่าน 48/48 หลังบ้านผ่าน 34/34 และ build ผ่าน 11 เส้นทาง คำสั่ง lint ขาดสคริปต์ใน package.json และ typecheck แยกขาด TypeScript compiler ในโปรเจกต์
- ไฟล์ที่แก้คือ `docs/ui-progress.md`, `docs/bed-report-parity.md` และ `docs/bed-report-evidence.json` รออนุมัติว่าจะรับรองฐานเตียงท้ายงวดของแต่ละหอสำหรับแถวรวมทั้งสองรายงานหรือไม่ สูตรและวิธีเลือกเตียงในระบบยังเป็นรุ่นที่ตรวจ

## 26 พฤศจิกายน 2569 — ตรวจว่าระบบใหม่ยังขาดอะไรเมื่อเทียบกับระบบเก่า

- เทียบเมนูของระบบเก่าใน `inpatient/` กับ [ตารางเทียบงานและรายงาน](../INPATIENT_PARITY_TH.md) และโค้ดปัจจุบัน งานบันทึกสามเวร แก้ไข ยืนยัน ส่งกลับ ตรวจรายการค้าง และประกาศข่าวมีในระบบใหม่ รายงานมีครบ 15 แบบ
- เมนูอัตราความพึงพอใจมีทั้งในแถบนำทางและหน้าบันทึกเวร ของเดิมส่งรหัสหอและรหัสบัญชีไปยังโปรแกรมภายนอก ของใหม่ส่งเฉพาะรหัสหอเมื่อกำหนดปลายทางและมีสิทธิ์บันทึก ยังขาดการทดสอบว่าผู้ใช้เข้าถึงหอที่ถูกต้องที่ปลายทางจริง
- [รายงานที่ยังรอตรวจรับ](parity-phase-6-acceptance.md) มี 3 กรณี ได้แก่ ยอดรวมอัตราหมุนเวียนเตียง (ตัวอย่างเดิม 0.23 ใหม่ 0.20 เพราะใช้ฐาน 30 และ 35 เตียงตามลำดับ) อัตราครองเตียงรวมเมื่อจำนวนเตียงเปลี่ยนระหว่างเดือน และใบพิมพ์/Excel ของ Productivity ซึ่งใช้ไฟล์ PHP เดียวกันที่สร้างผลไม่จบ
- [เครื่องมือนำเข้า](../backend/docs/legacy_import.md) รองรับข้อมูลเวร ประวัติยืนยัน สาขาผู้ป่วย แผลกดทับ การกลับมารักษาซ้ำ และข่าวครบ 6 ตาราง มีผลซ้อมด้วยข้อมูลสมมติแล้ว ตรวจค่า SHA-256 ของไฟล์ SQL ตรงกับ [ผลสำรวจต้นทาง](rollout/source-inventory.json) ซึ่งพบ 0 แถวในตารางงานทั้งหก ยังรอสำเนาที่โรงพยาบาลอนุญาตและการจับคู่บัญชีเพื่อยืนยันยอดและผู้ทำรายการย้อนหลัง
- ตรวจรอบนี้ด้วย unit tests หน้าบ้าน 48/48 หลังบ้าน 34/34 และ build ผ่าน ลินต์และ typecheck แยกรันไม่ได้เพราะโปรเจกต์ไม่มีคำสั่ง lint และไม่มี TypeScript compiler รอบนี้ตรวจซอร์สและหลักฐานเดิม ไม่ได้เทียบสดกับระบบโรงพยาบาลหรือทดสอบหน้าจอซ้ำ ผลเดิมครอบคลุมหน้าบันทึก ประวัติ และรายงานที่ 360/768/1024/1440px
- ไฟล์ที่แก้ในรอบนี้มีเฉพาะบันทึกนี้ เรื่องรอตรวจรับคือปลายทางความพึงพอใจ ตัวอย่างรายงานสามกรณี ข้อมูลย้อนหลัง และการทดลองงานโดยหอผู้ป่วยก่อนสลับระบบ

## 25 พฤศจิกายน 2569 — แก้บัคแถบเลือกบริบท (`EntryContextBar`) กระพริบและเด้งย่อ–ขยายเวลาเลื่อนหน้า `/entries`

- **สาเหตุ:** เดิม `EntryContextBar` ใช้ `IntersectionObserver` จับ `.entry-context-marker` แล้วใส่คลาส `.is-condensed` เพื่อซ่อน `.entry-context-expanded` ด้วย `display: none` ใน container ที่เป็น `position: sticky` ทำให้ `scrollHeight` ของเอกสารหดตัวทันทีและเบราว์เซอร์ดึงตำแหน่ง scroll กลับจน marker เข้าหน้าจอ เกิดลูปย่อ–ขยายสลับไปมา (โดยเฉพาะหน้าสั้นอย่างเวรดึก/เวรเช้า)
- **การแก้ไข (เฉพาะ presentation layer):**
  - [EntryContextBar.jsx](file:///c:/Users/Ult_Orange/Desktop/โฟลเดอร์ใหม่/new-system/frontend/components/entries/EntryContextBar.jsx): คงฟอร์มเลือกบริบทแบบเต็ม (`.entry-context-expanded`) ไว้ใน normal document flow ตลอดเวลาโดยไม่ซ่อนด้วย `display: none` และแยกแถบย่อ (`.entry-context-collapsed`) ออกมาเป็นชั้น sticky ลอยด้านบน (`.entry-context-sticky-track`) ที่แสดงเฉพาะบนเดสก์ท็อป (`!mobile && hasContext && condensed`) เมื่อฟอร์มเต็มเลื่อนพ้นขอบบนของ viewport แล้ว (`!item.isIntersecting && item.boundingClientRect.top < 0`) พร้อมรองรับปุ่ม “เปลี่ยน” และ `requestToken` ให้เลื่อนกลับไปที่ฟอร์มเต็มและย้ายโฟกัสเข้าฟอร์ม โดยเคารพ `prefers-reduced-motion` และคงพฤติกรรม `BottomSheet` บนมือถือ (`< 768px`) ตามเดิม
  - [entries.css](file:///c:/Users/Ult_Orange/Desktop/โฟลเดอร์ใหม่/new-system/frontend/styles/entries.css): เพิ่ม `position: relative` ให้ `.entry-page`, ถอด `.entry-context-marker` และการซ่อน `.entry-context-expanded`, ใช้ `.entry-context-sticky-track` (`position: absolute; inset: 0; pointer-events: none; z-index: var(--z-sticky)`) ร่วมกับ `.entry-context-collapsed` (`position: sticky; top: var(--space-2)`) ที่ซ่อนด้วย `visibility`/`opacity` โดยไม่กระทบ `scrollHeight` และไม่ใช้ค่าสีหรือขนาดนอก design tokens เดิม พร้อมคง `.entry-context-bar` แบบ sticky บนมือถือ (`<= 767px`) และซ่อนแถบลอยใน `@media print` / ปิด transition ภายใต้ `prefers-reduced-motion: reduce`
- **การตรวจสอบ:**
  - `npm run test:ui` ผ่าน **48/48** และ `npm run build` ผ่านครบ **11 เส้นทาง**
  - `npm run lint` ขาด script `"lint"` และ `npx --no-install tsc --noEmit` ขาด compiler `tsc` ตามข้อจำกัดเดิมของโปรเจกต์ (ไม่ได้ติดตั้ง dependency เพิ่ม)
  - ทดสอบบน Microsoft Edge headless ด้วยข้อมูลสมมติทั้งเวรดึก (หน้าสั้น) และเวรบ่าย (หน้ายาว) ที่ขนาด **360 / 768 / 1024 / 1440px** รวมถึงปุ่ม “เปลี่ยน”, ปุ่ม “เลือกวันและเวรถัดไป” (`requestToken`) และ `prefers-reduced-motion: reduce` พบ `scrollHeight` คงที่ตลอดการเลื่อน ไม่มีลูปย่อ–ขยาย ไม่มี horizontal overflow ไม่ซ้อนทับหัวข้อหน้าหรือ `StickyActionBar` และไม่พบ page error
- **ไฟล์ที่แก้:** `new-system/frontend/components/entries/EntryContextBar.jsx`, `new-system/frontend/styles/entries.css`, `new-system/docs/ui-progress.md`
- **คำถามที่ค้าง:** ไม่มีสำหรับบัคนี้

## 25 พฤศจิกายน 2569 — ปิดช่องว่างฟีเจอร์และเครื่องมือนำเข้าข้อมูลย้อนหลังครบ 5 รายการ

- **1) เครื่องมือนำเข้าและกระทบยอดข้อมูลย้อนหลังอีก 4 ตารางเดิม (`data_split_patient`, `pressure`, `readmit`, `tb_news`):**
  - เพิ่ม `backend/app/cli/import_legacy_supplements.py` และ `backend/app/cli/reconcile_legacy_supplements.py` พร้อมไฟล์แม่แบบใน `backend/docs/templates/` และอัปเดต `backend/docs/legacy_import.md`
  - บังคับทำงานเฉพาะฐานพัฒนา/ทดสอบบน loopback (`APP_ENV` เป็น `development` หรือ `test`), โหมดเริ่มต้นเป็น `dry-run` และโหมด `--apply` ต้องระบุ `--actor-username` ที่เป็น `system_admin` ซึ่งเปิดใช้งานอยู่
  - คงความต่างระหว่างค่าว่าง/NULL กับเลข `0` (ปฏิเสธช่องตัวนับว่างและบันทึกลง `legacy_import_issues` พร้อม `reason_code` โดยไม่เติม `0` แทนค่าว่าง และไม่เขียนข้อมูลผู้ป่วยหรือรหัสผ่านลง log)
  - สำหรับ `tb_news`: รองรับ `--account-map` (`legacy_account_id,target_username` และปฏิเสธไฟล์ที่มีคอลัมน์รหัสผ่าน) ไม่นำ `--actor-username` ไปปลอมเป็นผู้ประกาศข่าวเดิม หากไม่มีผู้ประกาศหรือจับคู่ไม่ได้จะเก็บ `publisher_username = NULL` และบันทึก `news_publisher_missing` หรือ `legacy_account_unmapped` ลง `legacy_import_issues`
  - ซ้อมนำเข้าชุดข้อมูลสมมติ P1 ครบทั้ง 6 ตาราง (`data_all` 13 แถว, `data_confirm` 3 แถว, `data_split_patient` 5 แถวเวรบ่าย, `pressure` 4 แถวรวมกรณี 0/0, `readmit` 4 แถวพร้อม provenance `idate`, `tb_news` 2 แถว N1/N2) บน PostgreSQL แยก ตรวจรันซ้ำไม่เพิ่มแถว และตรวจผลผ่าน HTTP/เบราว์เซอร์ในรายงาน `daily-all`, `specialty`, `pressure`, `pressure-detail`, `readmission` และรายการข่าวบนหน้าแรก `/` ตรงทุกค่า
- **2) ลิงก์คลิกเจาะดูรายละเอียดแผลกดทับรายวันจากตารางรายงานรายปี (Drill-down):**
  - เพิ่ม `pressureDrilldownTarget` ใน `frontend/lib/report-view.mjs` และอัปเดต `ReportViewer.jsx` / `ReportTables.jsx` / `reports.css` ให้ช่องตัวเลขรายเดือนของแต่ละหอในรายงาน `kind=pressure` (ยกเว้นแถวรวมทุกหอ คอลัมน์รวมปี ช่องขีดไม่มีตัวหาร และหอที่ไม่มีสิทธิ์) คลิกเปิดรายงาน `kind=pressure-detail` ของหอและเดือนนั้น (`/reports?kind=pressure-detail&ward=...&month=YYYY-MM`) ได้ทันทีและรองรับปุ่มย้อนกลับของเบราว์เซอร์ โดยใบพิมพ์ A4 แนวนอนและไฟล์ Excel XML ยังคงเป็นตัวเลขหรือขีด/ค่าว่างตามเดิม
- **3) เพิ่มฟิลด์ชื่อ-นามสกุลจริงของผู้ใช้ (`users.full_name`) และชื่อย่อหอผู้ป่วย (`wards.short_name`):**
  - เพิ่ม Alembic migration `backend/alembic/versions/0008_user_and_ward_names.py` แบบ nullable (backward-compatible) พร้อมเติมค่าตั้งต้น `wards.short_name` จำนวน 18 หอตาม `inpatient/db/db_inpatient.sql` (คง `NULL` สำหรับหอ 22 `สังเกตุอาการณ์`) และทดสอบ `upgrade -> downgrade -> upgrade` บนฐาน PostgreSQL แยกผ่าน
  - ส่งค่า `full_name` ใน `/auth/me`, `/auth/login`, `/admin/users` (`GET/POST/PATCH`) และเพิ่มช่องกรอก/แก้ไขชื่อ-นามสกุล (ไม่บังคับ) พร้อมคอลัมน์แสดงชื่อ-นามสกุลในหน้า `/users` รวมถึงแสดงชื่อ-นามสกุลควบคู่ชื่อบัญชีในแถบผู้ใช้และหน้าต่างโปรไฟล์ (`ShellFrame.jsx`) โดย fallback เป็นชื่อบัญชีเมื่อไม่ได้ระบุ
  - ส่งค่า `short_name` ใน `/wards` และใช้แสดงชื่อย่อในมุมมองตารางบนหน้าจอแคบ (`< 768px`) พร้อมคง `title` ชื่อเต็มและคงชื่อเต็มบนหน้าจอปกติ ใบพิมพ์ และไฟล์ Excel XML
- **4) ปรับตำแหน่งทางเข้าและทบทวนการเชื่อมต่อระบบ “อัตราความพึงพอใจ”:**
  - เพิ่มทางเข้า “อัตราความพึงพอใจ” ในแถบนำทางหลัก (`ShellFrame.jsx` ทั้งแถบด้านข้างและเมนูมือถือ) ให้สอดคล้องกับหน้า `/entries` โดยแสดงเฉพาะเมื่อผู้ใช้มีสิทธิ์บันทึกในหอปัจจุบัน (`ward.can_write`) หอนั้นมี `legacy_code` และมีการตั้งค่า `NEXT_PUBLIC_SATISFACTION_URL` (ซ่อนอัตโนมัติเมื่อไม่ได้ตั้งค่า)
  - คงกฎความปลอดภัยใน `frontend/lib/satisfaction.mjs`: ส่งเฉพาะ `?ward=<legacy_code>` ไม่เดาหรือส่งรหัสบัญชีเดิม (`id`) แนบใน URL จนกว่าจะได้ข้อกำหนดการยืนยันตัวตนจากระบบ contentment จริง
- **5) เพิ่มหน้าแจ้งปิดปรับปรุงชั่วคราว (Maintenance Mode) แบบเปิด–ปิดได้:**
  - เพิ่ม `frontend/lib/maintenance.mjs`, `frontend/components/MaintenanceNotice.jsx`, `frontend/app/maintenance/page.js` และเชื่อมกับ `frontend/app/layout.js` ผ่านตัวแปรสภาพแวดล้อม `NEXT_PUBLIC_MAINTENANCE_MODE` (ค่าเริ่มต้น `false` ใน `frontend/.env.example`) แสดงข้อความภาษาไทยสุภาพชัดเจน ชื่อโรงพยาบาลอากาศอำนวย และปุ่มลองเข้าใช้งานอีกครั้งโดยใช้ design tokens เดิม รองรับตัวปรับขนาดตัวอักษร 100% / 112.5% / 125% และไม่ปิด `/healthz` ของฝั่งหลังบ้าน
- **การตรวจสอบ:** `python -m compileall` ผ่าน, backend `unittest` ผ่าน 34/34, ซ้อมนำเข้า P1 ครบ 6 ตารางและกู้คืนฐานข้อมูล (`run_rollout_rehearsal.py --with-browser`) ผ่าน, frontend `npm run test:ui` ผ่าน 48/48, `npm run build` ผ่านครบ 11 เส้นทาง (รวม `/maintenance` และ `/users`), ทดสอบเบราว์เซอร์จริงที่ 360/768/1024/1440px ทั้งขนาดตัวอักษร 100% และ 125% รวม 48 กรณีไม่พบการล้นแนวนอนหรือ page error; ส่วน `npm run lint` ขาด script และ `npx --no-install tsc --noEmit` ขาด compiler ตามข้อจำกัดเดิมโดยไม่ติดตั้งแพ็กเกจเพิ่ม

## 24 พฤศจิกายน 2569 — เพิ่มเงื่อนไขรหัสผ่านและระบบจัดการผู้ใช้/บทบาทใน new-system

- ผู้ใช้ยืนยันให้ดำเนินการใน `new-system` เพื่อกำหนดเงื่อนไขการตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร, ตัวพิมพ์ใหญ่ A–Z อย่างน้อย 1 ตัว และอักษรพิเศษอย่างน้อย 1 ตัว) พร้อมระบบจัดการผู้ใช้และบทบาทบนเว็บ
- หลังบ้าน: เพิ่ม `validate_password_policy` ใน `backend/app/security.py` ใช้กับ `UserCreate`, `AdminPasswordResetRequest`, `ChangePasswordRequest` และ `app.cli.create_admin` โดยยังคง `LoginRequest` เดิมเพื่อให้บัญชีเก่าเข้าสู่ระบบได้ เพิ่ม endpoint `POST /auth/change-password`, `GET /admin/users`, `PATCH /admin/users/{user_id}` (กันผู้ดูแลปิดใช้งานหรือถอดสิทธิ์ตนเอง) และ `POST /admin/users/{user_id}/password` พร้อมยกเลิกเซสชันค้างเมื่อปิดบัญชีหรือเปลี่ยนรหัสผ่าน ไม่เปลี่ยนขอบเขตสิทธิ์เดิมของทั้ง 4 บทบาท
- หน้าบ้าน: เพิ่มตัวช่วย `frontend/lib/password-policy.mjs`, ตัวแสดงเงื่อนไขรหัสผ่านแบบเรียลไทม์ `frontend/components/PasswordChecklist.jsx`, เมนูเปลี่ยนรหัสผ่านในแถบผู้ใช้และหน้าต่างโปรไฟล์ (`ShellFrame.jsx`), และหน้าจัดการผู้ใช้และสิทธิ์ `/users` (`frontend/app/users/page.js`, `frontend/styles/users.css`) เฉพาะผู้ดูแลระบบ ใช้ design tokens และ shared components กลางทั้งหมด แสดงวันที่สร้างบัญชีเป็น พ.ศ. ผ่าน `formatThaiDate`/`todayISO`
- ไฟล์ที่แก้/เพิ่ม: `backend/app/security.py`, `backend/app/schemas.py`, `backend/app/api.py`, `backend/app/cli/create_admin.py`, `backend/tests/test_inpatient_rules.py`, `backend/tests/run_rollout_rehearsal.py`, `frontend/lib/password-policy.mjs`, `frontend/lib/api.js`, `frontend/lib/workspace.mjs`, `frontend/components/ui/Icon.jsx`, `frontend/components/PasswordChecklist.jsx`, `frontend/components/AppShell.jsx`, `frontend/components/shell/ShellFrame.jsx`, `frontend/styles/shell.css`, `frontend/styles/users.css`, `frontend/app/users/page.js`, `frontend/tests/password-policy.test.mjs` และบันทึกนี้
- การตรวจ: `compileall` ผ่าน, backend `unittest` ผ่าน 27/27, frontend `npm run test:ui` ผ่าน 44/44, `npm run build` ผ่านครบ 10 เส้นทางรวม `/users`; ส่วน `npm run lint` ขาด script และ `npx --no-install tsc --noEmit` ขาด compiler ตามข้อจำกัดเดิมของโปรเจกต์ รอบนี้ยังไม่ได้รันเบราว์เซอร์อัตโนมัติเพราะเครื่องไม่มีแพ็กเกจ `playwright` แนะนำทดสอบบนเบราว์เซอร์จริงที่ `/users` และหน้าต่างเปลี่ยนรหัสผ่านที่ 360/768/1024/1440px
- คำถามที่ค้าง: หากต้องการให้บทบาท `auditor` อ่านข้อมูลทุกหอผู้ป่วยได้อัตโนมัติโดยไม่ต้องผูกหอทีละหอ หรืออยากเพิ่มหน้าตั้งรหัสผ่านเริ่มต้นในระบบฝึก (`Inpatient-Trial`) ด้วย กรุณาแจ้งเพิ่มเติม

## 23 พฤศจิกายน 2569 — ตรวจวิธีแก้ข้อมูลในระบบ PHP เดิม

- ตรวจจากซอร์สระบบเดิม ผู้บันทึกใช้เมนู “แก้ไขข้อมูลประจำวัน” เลือกวันที่และเวร หากยืนยันแล้ว ผู้ดูแลใช้เมนู “ส่งกลับให้วอร์ดแก้ข้อมูล” ส่งรายการเดิมกลับให้หอแก้ บันทึก และยืนยันอีกครั้ง
- รอบนี้แก้เฉพาะบันทึกนี้ ไม่ได้เปลี่ยนข้อมูลหรือรันระบบ PHP จริง Build ระบบใหม่ผ่าน ส่วน lint และ typecheck แยกยังขาดเครื่องมือเดิม ไม่ได้ทดสอบขนาดหน้าจอซ้ำเพราะเป็นการตรวจขั้นตอนจากซอร์ส ไม่มีคำถามค้างสำหรับคำอธิบายนี้

## 23 พฤศจิกายน 2569 — ตรวจรายการที่ผู้ใช้แจ้งว่าบันทึกผิดระบบ

- ตรวจด้วยธุรกรรมอ่านอย่างเดียวในฐานพัฒนาในเครื่อง พบรายการเดียวตรงกับหอ วันที่ เวร สถานะ และยอดในภาพ ประวัติเป็นสร้างแล้วจึงยืนยัน ไม่พบรายการเวรถัดไปของหอนั้น ณ เวลาตรวจ ไม่ได้ลบ ส่งกลับ หรือแก้ตัวเลข รอให้แยกระหว่างการเอารายการทดลองส่วนเกินออกและการแก้ยอดของเวรที่ควรมีอยู่
- รอบนี้แก้เฉพาะบันทึกนี้ Build ผ่าน ส่วน lint ขาด script และ typecheck แยกขาด compiler ตามเดิม ไม่มีการแก้ UI หรือทดสอบหน้าจอทั้งสี่ขนาดซ้ำ

## 23 พฤศจิกายน 2569 — ตรวจทางแก้กรณีกรอกข้อมูลผิดระบบ

- ตรวจจากซอร์ส ระบบแยกค่าค้างในเครื่องออกจากรายการที่บันทึกแล้ว รายการเวรที่บันทึกไม่มีคำสั่งลบผ่านเว็บ ผู้มีสิทธิ์บันทึกแก้ไขรายการรอยืนยันได้ ส่วนรายการยืนยันแล้วต้องให้ผู้ดูแลส่งกลับพร้อมเหตุผลก่อนแก้ แยกกรณีกรอกทับเวรจริงออกจากการสร้างเวรทดลองส่วนเกิน
- รอทราบเว็บที่กรอกและสถานะการบันทึกก่อนระบุขั้นตอนสำหรับรายการนั้น ยังไม่ได้เข้าฐานจริงหรือเปลี่ยนข้อมูลใด ไฟล์ที่แก้มีเฉพาะบันทึกนี้ Build ผ่าน ส่วน lint ขาด script และ typecheck แยกขาด compiler ตามเดิม รอบนี้ตรวจซอร์ส ไม่มีการเปลี่ยนหน้าจอหรือทดสอบสี่ขนาดซ้ำ

## 23 พฤศจิกายน 2569 — แก้จำนวนรายการบนปุ่มกรองสถานะ

- ก่อนแก้ หน้า “รอยืนยันการส่งข้อมูล” ของ trial-nurse แสดง 0/0/0 ทั้งที่ฐานทดลองมีรายการยืนยันแล้ว 2 รายการ เพราะนับจากแถวที่ผ่านตัวกรองสถานะและตัดหน้าแล้ว
- ผู้ใช้อนุญาตการอ่านยอดสรุปแยก เพิ่ม GET `/entries/status-counts` นับทุกสถานะและทุกหน้าด้วยตัวกรองหอ/ช่วงวันที่/สิทธิ์เดียวกับการอ่านรายการ ตารางยังกรองสถานะและแบ่งหน้าตามเดิม เมื่อโหลดสรุปไม่ได้ หน้าจอแสดงข้อความลองใหม่และไม่แสดงตัวเลขที่ยังไม่ทราบ
- อัปเดตทั้งซอร์สหลักและเว็บทดลองบนเครื่อง ทดสอบ Edge ด้วยบัญชี trial-nurse ที่ 360/768/1024/1440px เปิดรอยืนยันและสลับปุ่มยืนยันแล้ว/ทั้งหมด ยอดทั้งสามเป็น 2/0/2 ทุกขนาด ตารางรอยืนยันว่าง ตารางยืนยันแล้วและตารางทั้งหมดแสดง 2 รายการ ทดสอบช่วงวันที่ว่างได้ 0/0/0 และจำลองบริการสรุปขัดข้องแล้วโหลดใหม่ได้ [ภาพหลังแก้](screenshots/history-status-counts/pending-1440.png) ตรวจฐานทดลองหลังจบยังมี 2 รายการยืนยันแล้ว
- ไฟล์ที่แก้ `backend/app/api.py`, `backend/tests/run_daily_workflow.py`, `frontend/app/history/page.js`, `frontend/lib/history-view.mjs`, `frontend/tests/history-view.test.mjs`, บันทึกนี้ และภาพหลักฐาน ตรวจ diff กับสำเนาก่อนแก้แล้ว เปลี่ยนเฉพาะการอ่านยอดและการแสดงผลตามขอบเขตที่อนุญาต
- Build ผ่านทั้งระบบหลักและชุดฝึก ชุดทดสอบหน้าบ้าน 41/41 หลังบ้าน 25/25 และ workflow ใน PostgreSQL แยกผ่าน 671 ข้อ รวมตัวกรอง สิทธิ์ข้ามหอ การนับหลังยืนยัน และการตอบเมื่อไม่มีสิทธิ์ ลินต์ยังขาด script และ typecheck แยกยังขาด compiler ตามเดิม ไม่มีเรื่องรอตัดสินใจ

## 23 พฤศจิกายน 2569 — ตรวจขอบเขตผู้ดูแลระบบฝึก

- ตรวจสิทธิ์ trial-admin จากซอร์สชุดฝึก ผู้ดูแลเข้าถึงข้อมูลทุกหอ ส่งรายการที่ยืนยันแล้วกลับพร้อมเหตุผล จัดการประกาศ และดูรายงานสำมะโนได้ ระบบหลังบ้านมีสิทธิ์สร้างบัญชีพร้อมบทบาท เพิ่มหอและจัดการประเภทเวร บัญชีผู้บันทึกยังยืนยันเวรของหอตนเองได้
- แก้เฉพาะบันทึกนี้ ตรวจ build ผ่าน ส่วน lint ไม่มี script และ typecheck แยกขาด compiler ตามเดิม รอบนี้ตรวจซอร์ส ไม่ได้แก้ UI หรือทดสอบหน้าจอ 360/768/1024/1440px ซ้ำ ไม่มีเรื่องรอตัดสินใจ

## 23 พฤศจิกายน 2569 — ตรวจสิทธิ์ยืนยันรายการในระบบฝึก

- ตรวจซอร์สของชุดฝึกแล้ว บัญชี trial-nurse มีสิทธิ์บันทึกและยืนยันรายการรอยืนยันของหอทดลอง A ได้ หลังบันทึกการแก้ไขแล้วใช้ปุ่ม “ยืนยันการส่งข้อมูล” รายการที่ยืนยันจะล็อกและผู้ดูแล trial-admin ส่งกลับพร้อมเหตุผลได้
- แก้เฉพาะบันทึกนี้ รอบนี้ตรวจสิทธิ์จากโค้ด ไม่เปลี่ยนสถานะรายการหรือทดสอบหน้าจอสี่ขนาดซ้ำ Build ผ่าน ลินต์ขาด script และ typecheck แยกขาด compiler ตามเดิม ไม่มีคำถามค้าง

## 23 พฤศจิกายน 2569 — เปิดระบบฝึกใช้งานเฉพาะเครื่อง

- เตรียมสำเนาของหน้าบ้านและหลังบ้านไว้ในโฟลเดอร์ส่วนตัวของผู้ใช้ ภายใต้ `%LOCALAPPDATA%\AkatHospital\Inpatient-Trial` ใช้เว็บ `http://127.0.0.2:3347/login` และตรวจเส้นทางจาก build ว่าส่งไปหลังบ้านทดลองที่ 127.0.0.2:18447 เท่านั้น มีแถบระบุ “ระบบทดลองฝึกใช้งาน” และบัญชีฝึกหอผู้ป่วย/ผู้ดูแลแยก เก็บรายละเอียดเข้าใช้ไว้ในไฟล์ภายในเครื่องที่จำกัดสิทธิ์
- สร้าง PostgreSQL container และ volume ใหม่สำหรับฐาน `inpatient_training` เฉพาะ loopback ไม่ได้นำเข้าข้อมูลเดิม ตรวจหน้าเข้าสู่ระบบและแถบแจ้งเตือนที่ 360/768/1024/1440px เข้าด้วยบัญชีฝึกและบันทึกผ่านหน้า /entries ที่ 1440px บน Edge จากนั้นโหลดหน้าใหม่และตรวจโดยตรงในฐานทดลอง พบหนึ่งรายการ หอทดลอง A เวรเช้า 22 พ.ย. 2569 ยกมา 6 เตียง 20
- หลังรีสตาร์ตเครื่อง เปิด Docker Desktop แล้วเปิด `open-training.cmd` ในโฟลเดอร์ชุดฝึกเพื่อเรียกใช้ฐานชุดเดิม ทดสอบเรียกตัวเปิดซ้ำขณะระบบทำงานแล้ว ตัวเปิดตรวจ ID ของ container และพอร์ตทดลองก่อนเริ่มบริการ
- ในโครงการหลักแก้เฉพาะบันทึกนี้ งานตั้งค่า ป้ายฝึก บัญชีและข้อมูลสมมติอยู่ในชุดทดลองนอกโครงการ ตรวจ build ของระบบหลักและชุดทดลองผ่าน ส่วน lint ไม่มี script และ typecheck แยกไม่มี compiler ตามเดิม ไม่มีเรื่องรอตัดสินใจ

## 23 พฤศจิกายน 2569 — ประเมินสัดส่วนที่ตรวจเทียบระบบเดิมได้

- ประมาณ 80% เมื่อให้น้ำหนักรายการเท่ากัน นับงานเดิม W01–W15 และรายงาน R01–R15 จากแผนเทียบ รวม 30 รายการ ผ่านเกณฑ์ชุดทดสอบหรือมีผลต่างโดยตั้งใจ 24 รายการ ไม่นับ W16 ซึ่งเป็นความสามารถใหม่ การพิมพ์และส่งออกอยู่ในการประเมินของรายงานแต่ละชนิด
- งานผ่าน 12/15 รวม W13 ที่ผลซ้อมล่าสุดนำเข้ารายการเวรสมมติครบ 13 แถว รันซ้ำไม่เพิ่มและเทียบยอดได้ ค้าง W11 ปลายทางความพึงพอใจ W14 ข้อมูลเสริมย้อนหลัง และ W15 การย้ายประวัติ/ข่าว/บัญชีอ้างอิงทั้งชุด รายงานผ่าน 12/15 ส่วน R06, R08 และ R09 ยังต้องรับรองเฉพาะกรณีที่ค้าง ดู [ผลตรวจรายงาน](parity-phase-6-acceptance.md) และ [ผลซ้อมล่าสุด](rollout/results-2026-11-23.md)
- พร้อมให้หอผู้ป่วยทดลองในฐานแยกด้วยข้อมูลสมมติ การใช้แทนของเดิมยังรอข้อมูลย้อนหลังที่ได้รับอนุญาต การกระทบยอดและรับรองรายงาน ผู้ใช้ตรวจรับ และฝ่ายไอทีทดสอบเครื่องเป้าหมายรวมถึงกู้คืน/ย้อนกลับ
- รอบนี้แก้เฉพาะบันทึกนี้ ตรวจ build ผ่าน หน้าบ้าน 41/41 และหลังบ้าน 25/25 ลินต์ยังขาด script และ typecheck แยกขาด compiler ไม่มีการแก้โค้ดหรือรันตรวจหน้าจอสี่ขนาดซ้ำ ใช้ผลการทดสอบเดิมที่ 360/768/1024/1440px

## 23 พฤศจิกายน 2569 — แก้คำเตือน hydration บน body

- ภาพผู้ใช้แสดงแอตทริบิวต์ `__processed_…="true"` เพิ่มบน `<body>`; ค้นซอร์สไม่พบผู้สร้างแอตทริบิวต์นี้ จึงคาดว่ามาจากเครื่องมือหรือส่วนขยายเบราว์เซอร์ ยังไม่ได้ระบุส่วนขยายจริงบนเครื่องผู้ใช้ จำลองเติมแอตทริบิวต์เดียวกับภาพก่อน React เริ่มทำงานบน dev server แล้วพบคำเตือนแบบเดียวกันก่อนแก้
- เพิ่ม `suppressHydrationWarning` เฉพาะ `<body>` ใน `frontend/app/layout.js` พร้อมคำอธิบาย ไม่เพิ่มบน html หรือองค์ประกอบลูก ไม่ลบแอตทริบิวต์ของส่วนขยาย ตรวจ diff เทียบสำเนาก่อนแก้แล้วมีเพียง prop และ comment ไม่แก้ business logic, API, routing, model หรือ dependency
- ตรวจ Microsoft Edge headless บน dev server `http://localhost:3000`: `/login` และ `/` ที่ **360/768/1024/1440px** ทั้งแบบปกติและจำลองแอตทริบิวต์บน body รวม 16 กรณี ไม่พบ hydration warning/page error/หน้าเลื่อนแนวนอน ปุ่มเพิ่มและคืนขนาดตัวอักษรทำงาน ใช้บัญชี/หอ/ข้อมูลว่างสมมติและดักคำขอบริการทั้งหมด ไม่มีการเขียนข้อมูลจริง
- ตรวจเพิ่ม 1 กรณี: จำลองแอตทริบิวต์ต่างบน section ลูกที่ `/login` 1440px ยังพบ hydration warning ตามคาด ยืนยันว่าการแก้ไม่ได้ปิดคำเตือนทั้งต้นไม้ ไม่ได้ทดสอบปุ่มในกรณีที่จงใจทำให้เกิดคำเตือนนี้ ผลรวมอยู่ใน [browser-results.json](screenshots/hydration-warning/browser-results.json) การทดสอบใช้ตัวเลือกเปิด local network ของ Edge สำหรับการดักเอกสารบน localhost เท่านั้น ไม่เปลี่ยนการตั้งค่าเบราว์เซอร์ผู้ใช้หรือโปรเจกต์
- `npm run build` ผ่าน; `npm run test:ui` ผ่าน **41/41**; `npm run lint` รันแล้วไม่มี script `lint`; `npx --no-install tsc --noEmit` รันแล้วไม่มี TypeScript compiler ตามข้อจำกัดเดิม จึงยังรับรอง lint/typecheck แยกไม่ได้ ไม่ติดตั้งเพิ่ม
- ไฟล์ที่แก้: `frontend/app/layout.js`, `docs/ui-progress.md`; เพิ่ม `docs/screenshots/hydration-warning/browser-results.json` ไม่มีเรื่องรอตัดสินใจสำหรับงานนี้ หากยังพบความต่างชนิดอื่นต้องตรวจข้อความใหม่แยกจากกรณี body นี้

## 23 พฤศจิกายน 2569 — จัดโลโก้และฟอร์มหน้าเข้าสู่ระบบให้อยู่ด้วยกัน

- รวมโลโก้โรงพยาบาล ชื่อระบบ และฟอร์มในแผงสีขาวเดียว จัดชิดแนวเดียวกัน ปรับหัวเรื่องจากขนาดใหญ่พิเศษมาใช้ขนาดชื่อหน้ามาตรฐาน ใช้ Card, TextInput และ Button กลาง พื้นที่หน้าเข้าสู่ระบบปรับตามพื้นที่ที่เหลือใต้แถบขนาดตัวอักษร
- แก้ `frontend/app/login/page.js`, `frontend/app/globals.css` และบันทึกนี้ เพิ่ม [ภาพตรวจสี่ขนาด](screenshots/login-layout/) เทียบ diff กับสำเนาก่อนแก้แล้ว การเปลี่ยนแปลงอยู่ในส่วนแสดงผล และฟังก์ชันส่งคำขอเข้าสู่ระบบตรงกับต้นฉบับ
- ตรวจ /login บน Edge จาก production build ที่ 360/768/1024/1440px โลโก้โหลดครบและอยู่ในแผง ปุ่มสูงอย่างน้อย 44px ทุกขนาด หน้าไม่ล้นด้านข้างทั้งที่ตัวอักษร 100% และ 125% ลำดับ Tab จากชื่อบัญชีไปรหัสผ่านและปุ่มถูกต้อง ฟอร์มว่างถูกกันก่อนส่ง และกรณีจำลองรหัสผ่านผิดแสดงข้อความไทยพร้อมล้างช่องรหัสผ่าน
- Build ผ่าน ชุดทดสอบ UI ผ่าน 41/41 ส่วน lint ยังไม่มี script และ typecheck แยกรันไม่ได้เพราะไม่มี compiler ตามเดิม ไม่มีเรื่องรอตัดสินใจในงานนี้

## 23 พฤศจิกายน 2569 — ใส่โลโก้โรงพยาบาลในหน้าเข้าสู่ระบบและแถบนำทาง

- อ่าน AGENTS.md, ข้อกำหนด UI ส่วน A/B/C2/D/E/ข้อจำกัด และความคืบหน้า/คำถามเดิมก่อนแก้ ทำเฉพาะภาพและการจัดวางตามคำสั่งรอบนี้
- `/login`: แทน IP ด้วย `public/brand/akat-hospital.webp` ครอปต้นฉบับ 400×400 ที่ x=0/y=148 เป็น 400×106 เก็บตราครบวงและชื่อไทย/AKAT HOSPITAL ครบ บันทึก WebP แบบ lossless พร้อมโปรไฟล์สี ตรวจพิกเซลหลังถอดรหัสตรงกับพื้นที่ต้นฉบับทุกพิกเซล ย่อภาพตามสัดส่วนบนมือถือ จัดฟอร์มเป็นคอลัมน์เดียวถึง 1023px ใช้ spacing/สี/ความสูงปุ่มจาก tokens เดิม ปุ่มเข้าสู่ระบบสูง 44px
- Sidebar: ใช้ `public/brand/moph-seal.png` ซึ่งตรงกับ PNG ต้นฉบับทุกไบต์ ใส่ขอบว่างด้วย spacing token โดยไม่ตัดตรา เมื่อขยายแสดงชื่อระบบเดิม เมื่อย่อ/จอแท็บเล็ตเหลือเฉพาะตรา เพิ่มตราและชื่อโรงพยาบาลใน Drawer “เมนูทั้งหมด” บนมือถือ แถบล่างคงปุ่มงานเดิมครบ 5 ปุ่ม ไม่มีโลโก้กินพื้นที่ปุ่ม
- การเข้าถึง: ภาพหน้าเข้าสู่ระบบมี alt ชื่อโรงพยาบาลหนึ่งครั้ง; ภาพในลิงก์หน้าแรกใช้ alt ว่าง/aria-hidden โดยคงชื่อเข้าถึงของลิงก์เดิม; ภาพใน Drawer เป็นภาพประกอบข้างชื่อโรงพยาบาลที่อ่านได้ครั้งเดียว ตรวจ accessibility tree แล้ว ไม่ได้ทดสอบเสียงกับโปรแกรมอ่านหน้าจอจริง
- ตรวจ Microsoft Edge headless จาก **production build** ที่ `http://localhost:3005` โดยดักคำขอบริการด้วยบัญชี/หอ/ตัวเลขสมมติเท่านั้น: `/login`, `/entries` ก่อนเปิดฟอร์ม และแบบฟอร์มที่เปิดด้วยพารามิเตอร์เดิม ที่ **360/768/1024/1440px**; เพิ่ม sidebar ย่อที่ 1024/1440px, reload เพื่อดูสถานะย่อเดิม, ขยายกลับ และ Drawer มือถือที่ 360px ตรวจ Esc/คืน focus/ล็อก scroll
- **ผลจริง:** ผ่าน 26 รายการตรวจ ไม่มีการเลื่อนแนวนอนทั้งหน้า ภาพโหลดครบและอัตราส่วนตรงต้นฉบับ ชื่อโรงพยาบาลอ่านได้ ปุ่มเข้าสู่ระบบ/บันทึกเข้าถึงได้และไม่ถูกบัง (ตรวจจุดกึ่งกลางปุ่มด้วย `elementFromPoint`) แถบล่างไม่ทับปุ่มบันทึก ภาพทั้งสองโหลดจาก `/brand/` ได้ HTTP 200 บน production server ไม่พบ page error/คำขอบริการที่ไม่คาดหมาย/คำขอเขียนข้อมูล การตรวจนี้เป็นการแสดงผล ไม่ได้ทดสอบเข้าสู่ระบบจริงหรือบันทึกลงฐานจริง
- **ชุดตรวจ:** `npm run build` ผ่าน, `npm run test:ui` ผ่าน 41/41; `npm run lint` exit 1 เพราะไม่มี script `lint` เดิม; ใช้ `npx --no-install tsc --noEmit` เพื่อไม่ติดตั้งเพิ่ม ผล exit 1 เพราะไม่มี TypeScript compiler เดิม จึงยังรับรอง lint/typecheck แยกไม่ได้ ไม่เพิ่ม dependency/configuration
- **ตรวจ diff:** ไม่มี Git repository จึงเทียบ snapshot/hash ของซอร์สและ config frontend เดิม 59 ไฟล์ พบเปลี่ยนเพียง 4 ไฟล์ด้านล่าง อีก 55 ไฟล์ตรงเดิม ตรวจ patch แล้วไม่มีการแก้ submit/login, สิทธิ์, routing, API หรือ data model
- **ไฟล์ที่แก้:** `frontend/app/login/page.js`, `frontend/app/globals.css`, `frontend/components/shell/ShellFrame.jsx`, `frontend/styles/shell.css`, `docs/ui-progress.md`; เพิ่มภาพ 2 ไฟล์ใน `frontend/public/brand/` และหลักฐานใน [screenshots/hospital-brand](screenshots/hospital-brand/) ดู [ผลตรวจเบราว์เซอร์](screenshots/hospital-brand/browser-results.json), [ขอบเขตการแก้](screenshots/hospital-brand/scope-check.json), [patch ที่ตรวจ](screenshots/hospital-brand/presentation.diff), [หน้าเข้าสู่ระบบมือถือ](screenshots/hospital-brand/login-360.png), [เมนูมือถือ](screenshots/hospital-brand/entries-mobile-menu-360.png)
- **คำถามค้างสำหรับงานโลโก้:** ไม่มี; ข้อค้างเดิมเรื่อง tooling และงานเฟสอื่นยังคงตามบันทึกก่อนหน้า ไม่ได้รวมแก้ในรอบนี้

## 23 พฤศจิกายน 2569 — พรอมต์ใส่โลโก้โรงพยาบาล

- เพิ่ม [พรอมต์สำหรับใส่โลโก้](hospital-logo-ui-prompt-th.txt) จากภาพแนวนอนและตรากลมที่ผู้ใช้ให้ ระบุตำแหน่งแทน IP ในหน้าเข้าสู่ระบบและแถบเมนู รวมถึงตำแหน่งในเมนูมือถือและเกณฑ์ตรวจสี่ขนาดจอ
- งานรอบนี้แก้เฉพาะไฟล์พรอมต์และบันทึกนี้ ตัวเว็บและรูปต้นฉบับยังคงเดิม Build ผ่าน ส่วน lint ไม่มี script และ typecheck แยกไม่มี compiler ตามเดิม การตรวจภาพหน้า /login และ /entries ที่ 360/768/1024/1440px เป็นงานเมื่อใช้พรอมต์ ไม่มีคำถามค้างสำหรับการร่างพรอมต์

## 23 พฤศจิกายน 2569 — ซ้อมย้ายข้อมูลและกู้คืนตาม rollout ช่วงที่อนุญาต

- อ่าน AGENTS.md, rollout prompt, ผลเฟส 5/6, คู่มือปฏิบัติการ และ spec ส่วนที่เกี่ยวข้องแล้ว ทำเฉพาะตรวจสำเนา/เตรียมคำสั่ง/ซ้อมตัวนำเข้าเดิม/สืบ daily-all/กู้คืนฐานสมมติ ไม่แก้เครื่องมือนำเข้า สูตร API model หรือ dependency
- **สำเนาที่ได้รับอนุญาต:** ตรวจ `inpatient/db/db_inpatient.sql` แบบอ่านอย่างเดียวซ้ำ: 6 ตารางปฏิบัติงานยัง 0 แถวทั้งหมด ไม่มีช่วงวันที่; หอ 19/เวร 3/เดือน 12 ผลพร้อม SHA-256 ใน [source-inventory.json](rollout/source-inventory.json) ไม่ได้ตรวจเซิร์ฟเวอร์จริง
- **ส่งฝ่ายไอที:** [source-inventory.sql](rollout/source-inventory.sql) รวมจำนวนแถว/ช่วงวันที่/NULL/หอ/เวร/คีย์ซ้ำ/ยอดรายหอวันเวร; รัน 20 SELECT ผ่านบน MariaDB 10.4.32 schema ว่างที่สร้างใหม่แยกแล้ว ยังไม่รันกับสำเนาที่มีข้อมูลจริง รายการไฟล์ที่ขาด/manifest/พื้นที่รับไฟล์จำกัดสิทธิ์อยู่ใน [แผน rollout](rollout/README.md)
- **ซ้อมข้อมูลสมมติ:** data_all 13 แถว dry-run→apply13→รันไฟล์เดิมซ้ำเพิ่ม0/ข้าม13; data_confirm 3 event→รันซ้ำเพิ่ม0/ข้าม3; history3/issues2 ไม่เพิ่ม, C8/U5 คงเดิม; batch metadata เพิ่มตามจำนวนครั้งที่รันตามปกติ reconciliation ทุกตัวนับตรง; grouping อิสระรายหอ2/หอวัน5/หอวันเวร13/หอเดือน4 ไม่มีความต่าง ปฏิเสธตัวนับว่าง/หอจับคู่ไม่ได้/เวรจับคู่ไม่ได้อย่างละ1; แยกอีกกรณีพิสูจน์เตียง NULL ต่างจากตัวนับ0 ดู [ผลซ้อม](rollout/rehearsal-result.json)
- **สาเหตุ 24 แทน 12:** รันซ้ำด้วย HTTP/หน้าเว็บจากฐานนำเข้าและฐานกู้คืน หอ A รายละเอียด12/แถวรวม12 บวกทุกแถวจึง24; A+B รายละเอียด18/แถวรวม18 บวกทุกแถวจึง36 ยืนยันเป็นการรวม summary ซ้ำในวิธีตรวจเดิม ไฟล์ทดสอบปัจจุบันแยกสองส่วนไว้แล้วและผ่าน657ข้อ โดยไม่ได้แก้สูตรหรือไฟล์ทดสอบเดิม
- **กู้คืน/ย้อน snapshot สมมติ:** สำรองก่อนและหลังนำเข้า ตรวจ checksum/รายการ backup, restore ฐานใหม่แล้วค่ารายการและจำนวน6ตารางตรง (14รายการรวมกรณีเตียงว่างเพิ่ม1) เปิดรายงานผ่าน HTTP/browser ได้; กู้ snapshot ก่อนนำเข้าไปฐาน rollback ใหม่แล้วธุรกรรม0 ไม่ได้สลับระบบหรือซ้อมย้อนรายการหลังเปิดจริง
- **ตรวจเว็บใหม่:** daily-workflow ผ่าน8กลุ่ม/20responsive cases; รายงาน15ชนิดผ่าน20 report/channel cases/120responsive cases/2ขอบเขตสิทธิ์; ที่360/768/1024/1440px รายงาน100%/125% ส่วนรายงานจากฐานนำเข้าและฐานกู้คืนเพิ่ม2บัญชี×4ขนาด×2ฐาน=16cases จอ/XML/ขอบเขตprintตรง ไม่อ้างว่าพยาบาลตรวจรับหรือเครื่องพิมพ์จริงผ่านแล้ว
- **ชุดตรวจ:** backend unit25/25, report94ค่า+276HTTP, workflow657, frontend unit41/41, compileall และ build ผ่าน; `npm run lint` ไม่มี script และ `npx --no-install tsc --noEmit` ไม่มี compiler ตามเดิม ไม่ติดตั้งเพิ่ม
- **ไฟล์:** เพิ่ม `backend/tests/run_rollout_rehearsal.py`, `backend/tests/check_rollout_inventory_sql.py`, `frontend/tests/browser/rollout-import.cjs`, เอกสาร/SQL/ผลรวม/ภาพใน `docs/rollout/`; อัปเดตไฟล์นี้ และสร้างหลักฐานเดิมใหม่ใน `docs/screenshots/parity-phase-3`, `parity-phase-4`, `output/pdf/parity-phase-4` รายการครบใน [change-review.json](rollout/change-review.json) ไม่มีGitจึงใช้snapshot/hash ตรวจซอร์สเดิม172ไฟล์ตรงทั้งหมด ไม่มีการแก้logic/API/routing/model/config/dependencyหรือexisting test
- **ยังรอ/ต้องตัดสินใจ:** สำเนาที่มีข้อมูลและรูปแบบส่งออกที่ไอทีรับรอง; อนุมัติพัฒนาตัวนำเข้าเสริม4ตารางตามรายชื่อไฟล์/ผลกระทบใน [ข้อเสนอ](rollout/README.md#ข้อเสนอขยายขอบเขตที่ต้องอนุมัติก่อนแก้); เจ้าของรายงานรับรอง Turnoverรวม/ครองเตียงเมื่อเตียงเปลี่ยน/Productivityพิมพ์; F01/F03/F04ยังไม่แก้; พยาบาล/หัวหน้าหอตรวจรับ และฝ่ายไอทีรับรองเครื่องจริง/กู้คืน/แผนสลับและย้อนกลับ **ยังไม่พร้อมเปิดจริงและยังไม่ได้รับอนุมัติสลับระบบ**

รายละเอียดคำสั่ง ผลจริง และข้อจำกัด: [ผล rollout 23 พฤศจิกายน 2569](rollout/results-2026-11-23.md)

## 23 พฤศจิกายน 2569 — ตรวจสำเนาฐานเก่าและเขียนพรอมต์เตรียมขึ้นระบบ

- ตรวจไฟล์ `inpatient/db/db_inpatient.sql` แบบอ่านอย่างเดียว พบข้อมูลหอ 19 แถว ประเภทเวร 3 แถว และเดือน 12 แถว ตารางข้อมูลปฏิบัติงานทั้ง 6 ตารางมีโครงสร้างแต่ไม่มีแถวในสำเนานี้ จำนวนบนเซิร์ฟเวอร์โรงพยาบาลยังไม่ทราบ
- เพิ่ม [พรอมต์เตรียมย้ายข้อมูลและเปิดใช้งาน](hospital-rollout-prompt-th.txt) สำหรับนำไปสั่งงานต่อ มีเกณฑ์กระทบยอดข้อมูล ทดสอบรายงาน ซ้อมกู้คืนและย้อนกลับ และตรวจรับโดยผู้ใช้ ค้างสำเนาข้อมูลย้อนหลังที่ได้รับอนุญาตจากฝ่ายไอที
- รอบนี้แก้เฉพาะเอกสารสองไฟล์ ตรวจ build ผ่าน ลินต์ขาด script และ typecheck แยกขาด compiler ตามเดิม ไม่มีการแก้หน้าจอหรือรันทดสอบที่ 360/768/1024/1440px ซ้ำ

## 23 พฤศจิกายน 2569 — ประเมินความพร้อมขึ้นเว็บโรงพยาบาล

- ผลประเมิน: พร้อมสำหรับเตรียมสภาพแวดล้อมทดสอบและให้ผู้ใช้ตรวจรับด้วยข้อมูลสมมติ แต่ยังไม่พร้อมเปิดใช้งานจริงแทนระบบเดิมทั้งโรงพยาบาล อ้างอิงข้อค้างใน `parity-phase-6-acceptance.md` และตรวจการตั้งค่าจากซอร์สปัจจุบัน ไม่ได้ deploy หรือเชื่อมฐานจริง
- ตัวขวางเดิมยังไม่มีหลักฐานปิด: ตัวนำเข้าข้อมูลแยกสาขา/แผลกดทับ/รีแอดมิต/ข่าวและการกระทบยอดข้อมูลจริง, การรับรองรายงาน Turnover รวม/ครองเตียงเมื่อเตียงเปลี่ยน/Productivity ใบพิมพ์ และข้อค้าง UI F01/F03/F04; ผล daily-all `expected 12, received 24` เป็นข้อผิดพลาดที่บันทึกไว้ก่อนหน้า ยังไม่ได้รันทดสอบ integration นั้นซ้ำรอบนี้
- ระบบต้องมีส่วนรัน Next.js, Python/FastAPI และ PostgreSQL; ยังไม่ได้ตรวจเซิร์ฟเวอร์โรงพยาบาล โดเมน/HTTPS การตั้งค่า production สิทธิ์เครือข่าย การสำรอง/ซ้อมกู้คืน และการเฝ้าระวัง จึงยังรับรองความพร้อมของสภาพแวดล้อมจริงไม่ได้ การเข้าใช้พร้อมฐานพัฒนาก็ยังค้างยืนยันจากบันทึกก่อนหน้า
- ตรวจรอบนี้: `npm run build` ผ่าน, `npm run test:ui` ผ่าน 41/41, backend unittest ผ่าน 25/25; `npm run lint` รันไม่ได้เพราะไม่มี script และ `npx --no-install tsc --noEmit` รันไม่ได้เพราะไม่มี compiler ไม่ติดตั้ง dependency เพิ่ม
- ไฟล์ที่แก้: `docs/ui-progress.md` เท่านั้น; ตรวจ patch แล้วไม่แตะ business logic/API/routing/data model/configuration ไม่มี Git repository ให้ตรวจ Git diff ไม่ได้ทดสอบหน้าจอที่ 360/768/1024/1440px ซ้ำ เพราะเป็นการประเมินความพร้อม ไม่มีการแก้ UI
- เรื่องที่ต้องทราบเมื่อเริ่มเตรียมขึ้นระบบ: รูปแบบเซิร์ฟเวอร์และระบบปฏิบัติการที่ฝ่ายไอทีจัดให้, เปิดเฉพาะเครือข่ายโรงพยาบาลหรือเข้าจากภายนอก, และขอบเขตข้อมูลย้อนหลัง/ผู้รับรองผลรายงาน โดยไม่ส่งรหัสผ่านในแชต

## 23 พฤศจิกายน 2569 — พบฐานข้อมูลพัฒนาเดิม

- ตรวจ SELECT แบบอ่านอย่างเดียวเพิ่ม: พบ `Orange` ในบัญชีเข้าเว็บ (`users`) แต่ไม่มี role ฐานข้อมูลชื่อนี้; role ฐานที่พบคือ `inpatient` จึงต้องแยกบัญชีเข้าเว็บออกจากค่าเชื่อมต่อฐาน ไม่ตรวจหรือบันทึกรหัสผ่านของผู้ใช้ ไม่มีการเปลี่ยนข้อมูล/โค้ด ตรวจ build รอบนี้ผ่าน ส่วน lint/typecheck ยังมีข้อจำกัดเดิม
- เปิด Docker Desktop และ container เดิม `inpatient-dev-pg` แล้ว ตรวจด้วย SELECT แบบอ่านอย่างเดียวพบฐาน `inpatient_dev`, ผู้ใช้ `inpatient`, พอร์ตเครื่อง `127.0.0.1:5433` (ภายใน container 5432) และตารางของระบบเดิมอยู่จริง ไม่สร้างฐานหรือแก้ข้อมูล/รหัสผ่าน ไม่แสดงรหัสผ่านในผลตรวจ
- ค่า `DATABASE_URL` ใน PowerShell ที่เปิดหลังบ้านต้องใช้ชื่อฐานและพอร์ตดังกล่าวกับรหัสผ่านเดิม; ยังไม่ได้เปลี่ยนค่าหรือเริ่มหลังบ้านใหม่ในหน้าต่างของผู้ใช้ และยังไม่ได้ยืนยันการเข้าสู่ระบบ
- ไฟล์ที่แก้: `docs/ui-progress.md` เท่านั้น ทวน patch ไม่มีการเปลี่ยน logic/API/routing/data model/dependency
- ตรวจ build ผ่าน; lint ไม่มี script และ standalone typecheck ไม่มี compiler ตามเดิม ไม่ได้ตรวจหน้าจอ 360/768/1024/1440px เพราะไม่มีการแก้ UI
- ค้าง: ทดสอบการเชื่อมต่อหลังตั้งค่าหลังบ้านให้ตรงฐานเดิม โดยไม่ต้องส่งรหัสผ่านในแชต

## 23 พฤศจิกายน 2569 — ตรวจข้อผิดพลาดขณะเปิดระบบ

- ตรวจภาพท้าย traceback เพิ่มแล้วเป็นการเชื่อมต่อ 5432 ถูกปฏิเสธเช่นเดิม พบ Docker Desktop ติดตั้งแล้วแต่ Docker engine ยังไม่ทำงาน จึงยังตรวจรายชื่อ container ไม่ได้; ไม่ได้เปิดบริการหรือสร้างฐานใหม่ ตรวจ build ซ้ำผ่าน ส่วน lint/typecheck ยังมีข้อจำกัดเดิม
- ภาพผู้ใช้แสดง `ConnectionRefusedError` ไป `127.0.0.1:5432`; ตรวจเครื่องพบหน้าบ้านฟังพอร์ต 3000 และหลังบ้าน 18763 แต่ไม่พบตัวฟัง 5432/5433, process postgres หรือ Windows service ชื่อ postgres ในขณะตรวจ จึงยังใช้งานข้อมูลไม่ได้ ต้องเปิดฐานพัฒนาหรือยืนยันตำแหน่งฐานที่ถูกต้อง
- คำเตือน hydration ในภาพมีแอตทริบิวต์ `__processed_...` บน body ซึ่งอาจมาจากส่วนขยายเบราว์เซอร์ ยังไม่ได้พิสูจน์สาเหตุด้วยการเปิดแบบปิดส่วนขยาย
- ไฟล์ที่แก้: `docs/ui-progress.md` เท่านั้น; ทวน patch แล้วไม่แตะ logic/API หรือการตั้งค่า ไม่ได้เริ่มบริการ ติดตั้ง dependency หรือเขียนฐานข้อมูล
- ตรวจ: build ผ่าน; lint ไม่มี script; standalone typecheck ไม่มี compiler ตามข้อจำกัดเดิม ไม่ได้ตรวจ responsive 360/768/1024/1440px เพราะไม่มีการแก้หน้าจอ
- เรื่องที่ยังต้องทราบก่อนแก้การเชื่อมต่อ: ฐานพัฒนาตั้งอยู่ที่ใดและพร้อมใช้งานหรือไม่ โดยไม่ขอให้ส่งรหัสผ่านในแชต

## 23 พฤศจิกายน 2569 — อธิบายวิธีเปิดระบบ

- ตรวจ README, คู่มือเปิดระบบ, package.json และการตั้งค่าพอร์ต: เครื่องนี้หน้าบ้านใช้ 3000 และหลังบ้านต้องใช้ 18763 ให้ตรงกับ `.env.development.local`
- อธิบายคำสั่งเปิดสองส่วนและการตั้ง `DATABASE_URL` ของฐานพัฒนาใน PowerShell; ไม่ได้เริ่มบริการหรือเปลี่ยนฐานข้อมูล
- ไฟล์ที่แก้: `docs/ui-progress.md` เท่านั้น; ตรวจรายการแก้ไขแล้ว ไม่มีการแก้ business logic, API, routing หรือ data model
- ตรวจ: build ผ่าน; lint ไม่มี script; standalone typecheck รันไม่ได้เพราะไม่มี compiler และไม่ได้ติดตั้งเพิ่ม
- ไม่ได้ตรวจหน้าเว็บที่ 360/768/1024/1440px เพราะไม่มีการแก้หน้าจอ; ยังต้องใช้ค่าฐานพัฒนาและบัญชีเข้าใช้ที่ผู้ใช้มีอยู่ ไม่มีการคาดเดาค่าหรือรหัสผ่าน

## 23 พฤศจิกายน 2569 — อธิบายโครงสร้างโปรเจกต์

- สำรวจระบบเดิม `inpatient` และระบบใหม่ `new-system` เพื่ออธิบายหน้าบ้าน หลังบ้าน ฐานข้อมูล และเอกสาร โดยไม่เริ่มงานเฟสใหม่
- ไฟล์ที่แก้: `docs/ui-progress.md` เท่านั้น ไม่มีการแก้ซอร์ส business logic, API, routing หรือ data model
- ตรวจครั้งนี้: `npm run build` ผ่าน; `npm run lint` รันไม่ได้เพราะไม่มี script; `npx --no-install tsc --noEmit` รันไม่ได้เพราะไม่มี TypeScript compiler และไม่ได้ติดตั้งเพิ่ม
- ไม่ได้ทดสอบหน้าจอที่ 360/768/1024/1440px เพราะเป็นงานอธิบายโครงสร้าง ไม่มีการปรับหน้าจอ
- ไม่พบ Git repository ในโฟลเดอร์งานและโฟลเดอร์ระบบใหม่ จึงตรวจ diff ด้วย Git ไม่ได้; การแก้เอกสารครั้งนี้มีเฉพาะบันทึกส่วนนี้ ไม่มีคำถามใหม่ที่ต้องตัดสินใจ

อัปเดต 20 พฤศจิกายน 2569 · งานล่าสุด **เฟส 6 ตรวจรับระบบใหม่แล้วบนชุดข้อมูลสมมติ แต่ยังไม่พร้อม cutover** · หลักฐาน PHP/MySQL เป็นผลตรวจเดิม/ซอร์ส ไม่ได้รันสดในรอบนี้ · เฟส 5 ยังไม่จบ: ตารางเสริมสาขา/แผลกดทับ/รีแอดมิต/ข่าวไม่มีตัวนำเข้า และ dump ไม่มีข้อมูลย้อนหลังจริง

อ่านไฟล์นี้ก่อนเริ่มทุกครั้ง คู่กับ [ui-spec.md](ui-spec.md), [รายงาน Audit](ui-audit.md) และ [AGENTS.md](../../AGENTS.md)

## เฟส 6 — ตรวจรับเทียบรายการเฟส 1

ผลตรวจรอบนี้แยกจากเอกสาร/ผลทดสอบก่อนหน้าอยู่ใน [รายงานตรวจรับเฟส 6](parity-phase-6-acceptance.md): browser/API workflow 657 assertions, รายงาน 15 แบบและ print/XML, responsive ที่ 360/768/1024/1440, ตัวอักษร 100/125%, browser zoom 200%, F05 toast, และ rehearsal data_all/data_confirm ผ่านตาม fixtures. `npm run test:ui` 41/41, backend unittest 25/25, build ผ่าน. `npm run lint` ไม่มี script และ standalone typecheck รันไม่ได้เพราะไม่มี compiler; build มี TypeScript phase ผ่าน. PHP/MySQL รันสดไม่ได้ จึงไม่อ้างว่าตรวจสองระบบพร้อมกัน. ทวน F01–F05: F02 ข้อความสิทธิ์ไทยแล้ว, F05 ผ่าน browser; F01 ยังมีศัพท์ API ในตัวช่วยวันที่, F03 contrast และ F04 ปุ่ม 42px ยังไม่ผ่าน. Turnover แถวรวม, สูตร R08 เมื่อฐานเตียงแปรผัน, และ Productivity ใบพิมพ์ยังตรวจรับเทียบ PHP ไม่ได้; importer ตารางเสริม/ข้อมูลจริงยังขวางการตัดระบบเดิม. สรุป: ทดแทนได้สำหรับทดลองบนข้อมูลทดสอบ แต่ไม่พร้อม cutover.

## สถานะปัจจุบัน

### เฟส 5 — ความคืบหน้าและผลรันแยกจากเอกสารเก่า

เพิ่ม `LegacyConfirmationRecord` และ `LegacyImportIssue` พร้อม migration `0007`; สถานะรายการใน `daily_entries` ยังคงเป็นข้อมูลปัจจุบัน ส่วน `data_confirm` เก็บเป็นประวัติแยกและยอมให้ผู้ยืนยัน/เวลาเป็น null. เพิ่ม `import_legacy_confirmations.py` ใช้ไฟล์ crosswalk `legacy_account_id,target_username`, ตรวจผู้รันเป็น system_admin, dry-run/apply, hash เพื่อรันซ้ำไม่เพิ่มประวัติหรือข้อยกเว้น, และแสดงประวัติเดิมใน `/entries/{id}/events` โดยแจ้ง “ไม่พบข้อมูลผู้ยืนยัน/วันและเวลา” ตามหลักฐาน ไม่ใช้บัญชีผู้นำเข้าแทน

**ผลซ้อมใหม่รอบนี้:** `python -m unittest discover -s tests -p "test_*.py"` ผ่าน 25/25; `tests/run_legacy_confirmation_rehearsal.py` ผ่าน migration บน PostgreSQL ว่าง, data_all สมมติ 1 แถว apply (ก่อน→หลัง 0→1), เรียก handler `/reports/daily` ได้ 1 แถว PT10, เรียก handler ประวัติรายการได้ 3 events/actor หาย2/time หาย1. data_confirm dry-run 3 แถว (คาดนำเข้า3, จับคู่บัญชี1, บัญชีขาด1, เวลาไม่ทราบ1), apply นำเข้า3/ข้าม0/ผิด0, rerun นำเข้า0/ข้าม3, หลังรันยังมีประวัติ3/ข้อยกเว้น2; สถานะ daily entry ยัง confirmed. เป็นข้อมูลสมมติ ไม่ใช่ข้อมูลโรงพยาบาล; ไม่ได้เปิดหน้าเบราว์เซอร์ด้วย session จริง

ตรวจส่วนหน้าใหม่ `npm run test:ui` ผ่าน 41/41; `npm run build` ผ่าน. `npm run lint` รันไม่ได้เพราะ `package.json` ไม่มี script lint; `npx --no-install tsc --noEmit` รันไม่ได้เพราะไม่มี TypeScript compiler ใน dependency (ไม่ได้ติดตั้งเพิ่ม). `python -m compileall -q app tests alembic/versions` ผ่าน.

ทดสอบ `tests/run_daily_workflow.py` แยกแล้ว: migration ใหม่ผ่านไปถึงการเรียก API แต่ regression เก่าของรายงาน daily-all ล้ม (`expected 12, received 24` สำหรับผลรวม PT closing); ไม่แก้เพราะอยู่นอกงานย้ายข้อมูลและต้องสืบแยกก่อน. คำสั่งนี้จึง **ไม่ผ่าน** รอบนี้

**แหล่งเดิมจริง:** ตรวจ DDL และ PHP writer/query: dump 2014-09-05 ไม่มี rows ใน `data_all`, `data_confirm`, `data_split_patient`, `pressure`, `readmit`, `tb_news`; `account` มี seed 1 แถวซึ่งมี credential plaintext จึงไม่แสดง/ไม่คัดลอก; reference `ward` 19, `wage_type` 3, `tb_month` 12. ผลจริงคือ operational อ่าน0/นำเข้า0/ข้าม0 (ไม่มีค่าก่อน–หลัง) ไม่อ้างว่าเป็นขอบเขตวันเริ่มข้อมูล ระบบใหม่ต้องรับทุกแถวของ export ที่ได้รับและไม่ตั้ง cutoff เอง; วันต่ำสุด/สูงสุดจริงรอ export ที่ได้รับอนุญาต

**ช่องว่างคงเหลือ — ยังไม่จบเฟส:** เครื่องมือเดิม `import_legacy.py`/`reconcile_legacy.py` ยังรับและกระทบยอดเฉพาะ `data_all`; `data_split_patient`, `pressure`, `readmit`, `tb_news` ยังไม่มี bundle importer/reconciliation. P1 ที่มี 13 แถวและข้อมูลเสริมยังไม่ได้ apply ทั้งชุด. ดู mapping, หลักฐาน PHP, ตัวเลขคาดหวัง และขอบเขตวันที่ใน [รายงานเฟส5](parity-phase-5-import.md). ห้ามใช้ข้อมูลจริงจนกว่าจะมี export ที่ได้รับอนุญาต และไม่มีการเขียนฐานใช้งานจริงรอบนี้

ไฟล์แก้รอบนี้: `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/api.py`, `backend/app/cli/import_legacy_confirmations.py`, `backend/alembic/versions/0007_legacy_history_and_issues.py`, `backend/tests/test_legacy_confirmation_import.py`, `backend/tests/run_legacy_confirmation_rehearsal.py`, `frontend/components/entries/EntryActivity.jsx`, `INPATIENT_PARITY_TH.md`, `docs/parity-phase-5-import.md`, `docs/ui-progress.md`. ตรวจ diff รอบนี้ยังต้องทำขั้นสุดท้ายหลัง lint/typecheck/build

เฟส4เพิ่มรวมให้การพยาบาลPTในรายวัน/รายเดือน ใช้เตียงท้ายเดือนกับแถวรวมรายเวร รวม13สาขาข้ามหอแยกสามัญ/พิเศษ และปฏิทินแผลกดทับพร้อมรวมเดือน แยกผลตามช่องทางPHPสำหรับdaily/monthly/census-month/Productivity เทียบจริงครบ15แบบ ดู [ตารางค่าคาดหวัง/จริงและข้อจำกัดเฟส4](parity-phase-4-reports.md) ข้อมูลย้อนหลัง/เครื่องมือนำเข้าเป็นเฟสอื่น ไม่เริ่มล่วงหน้า

**กติกาสำหรับทุกเฟสล่าสุด:** ใช้inpatientเป็นข้อกำหนดหลักโดยอ่านอย่างเดียว ตรวจพฤติกรรมและสูตรจากเมนู/ฟอร์ม/ตัวรับ/คำอ่านเขียน/รายงานเอง จอเทียบจอ พิมพ์เทียบพิมพ์ ExcelเทียบExcelแม้สูตรเดิมต่างกัน ไม่ส่งกลับให้เจ้าของงานเลือกเรื่องที่หาได้จากซอร์ส เจ้าของงานอนุญาตแก้หน้าจอ/backend/API/routing/data model/เครื่องมือนำเข้าในnew-systemตามความจำเป็นของเฟสที่สั่งแทนข้อจำกัดpresentation-onlyเดิมแล้ว; เฟส4ใช้สิทธิ์นี้เฉพาะรายงานและGETช่องทาง แหล่งข้อมูลที่ไม่มีให้ทำส่วนพิสูจน์ได้ต่อ บันทึกข้อจำกัด และใช้เฉพาะฐานทดสอบสำหรับซ้อมย้าย ไม่เขียนฐานใช้งานจริง คำตอบD01–D08/คำถามเดิมที่ขัดกับคำสั่งนี้เป็นประวัติ ไม่ใช้หยุดงานหรือขอเลือกสูตรซ้ำ

### ผลตรวจซ้ำต่อในรอบนี้ — 20 พฤศจิกายน 2569

แยกจากผลชุดเดิมที่บันทึกไว้ข้างต้น รอบต่อเนื่องนี้รันใหม่หลังโค้ดเฟส4ล่าสุด:

- `backend/tests/run_report_parity.py`: ผ่าน **94 ข้อค่ารายงาน + 276 ข้อ HTTP** บน FastAPI/PostgreSQL ชั่วคราวและข้อมูลสมมติ
- `backend/tests/legacy_report_probe.py`: รัน PHP 61 เคส (หลักฐานชุดล่าสุด); ข้อผิดพลาดที่ตรวจซ้ำยังเป็น PHP เดิม `productivity_r.php:81` และหารศูนย์ในรายงานเดือนเมื่อไม่มีจำหน่าย ซึ่งบันทึกแยก ไม่อ้างว่าผ่าน
- `backend/tests/compare_report_evidence.py`: เทียบ 1,882 cell/กรณี; อธิบายความต่างได้ 141 จุด ไม่มีความต่างที่ไม่ทราบสาเหตุ
- `frontend/tests/browser/report-parity.cjs`: ผ่าน 20 ชุดรายงาน/กรณีเสริม, 120 กรณี responsive และ 2 ขอบเขตสิทธิ์ โดยส่งคำขอไป API ชั่วคราวจริง; `--permissions-only` ผ่าน 2 ขอบเขต
- `npm run test:ui`: 41/41 ผ่าน; backend unittest: 21/21 ผ่าน; `npm run build`: ผ่าน
- `npm run lint` รันไม่ได้เพราะไม่มี script ใน `package.json`; `npx --no-install tsc --noEmit` รันไม่ได้เพราะไม่มี TypeScript compiler ติดตั้ง และไม่ได้เพิ่ม dependency
- ตัวตรวจ PDF `check-report-parity-pdf.py` พยายามรันซ้ำแต่ environment รอบนี้ไม่มีโมดูล `pypdf` จึงไม่ได้รันยืนยัน PDF ซ้ำในรอบนี้ ผลตรวจ 19 PDF/50 หน้าที่อ้างในเอกสารเฟส4เป็นผลจากรอบก่อนหน้าเท่านั้น; รอบนี้ตรวจ print DOM และ XML ดาวน์โหลดจริงครบแล้ว
- ปิดบริการ Next.js และฐานทดสอบส่วนตัวเมื่อจบ; ไม่เปลี่ยนไฟล์ใน `inpatient`

### ผลใหม่ของเฟส 4 รายงาน — รอบนี้รันใหม่

- [x] ตารางครบR01–R15 พร้อมตัวกรอง/หัว/รายเวร/รวม/หน่วย/ฐาน/ค่าPHPและใหม่ อ้างแยกจอ/พิมพ์/Excel ไม่ใช้สูตรใบพิมพ์แทนจอตามคำตอบD02เก่า; คงD01/D03/D08และExcel XML
- [x] รวมให้การพยาบาลPT: A1พ.ย.ดึก13 รวมวัน14 รวมเดือน25 ปรากฏทุกช่องทาง; ฐานเตียงรวมเวรเดือน25เหมือนกันทุกเวร ได้46/22/40% รวมเดือน42%; กรณีPT10/เตียง20/20/25 แถวเวร50/50/40 แต่รวมเวรและเดือน40ทุกแถว
- [x] รวมสาขาข้ามหอสามัญMED2+3=5 พิเศษ7+11=18 และP1เดือนMED6ไม่ซ้ำเป็น12 กรองสิทธิ์หอจริงและครบ13สาขา แม้ไฟล์พิมพ์PHPเก่าตกNEURO SURG/อ่านเพียงหอแรกบางจุด
- [x] แผลกดทับพ.ย.ครบ30วัน+รวม แยกยังไม่บันทึกเป็นnullจากบันทึก0/0 รวม1/10กับ2/50เป็น3/60/50ต่อพัน ไม่เป็น70; เดือนว่างก.พ.29วันแสดงปฏิทินได้ ไม่สร้างศูนย์ปลอม
- [x] สูตร/ข้อมูลรายงานตรงตามPHPแยกช่องทางในกรณีที่พิสูจน์ได้ รวมNBที่จอ/พิมพ์ใช้ต่างกัน, avgNBแถวรายหอของยอดคงพยาบาล, ฐานวันช่วงเดือนท้าย และPHP half-up13.125→13.13; ไม่เขียนกลับตัวนับรายเวร
- [x] สร้างฐานMariaDBใหม่และสำเนาPHPในTEMP แทนเฉพาะconnection/session/includesส่วนเปลือก ใส่compatibilityshimที่ระบุ ไม่เปลี่ยนซอร์สสูตร/SQL; 61การเรียกPHP 56จบ/5ข้อจำกัด +24นิพจน์Productivityรันแยกจริง
- [x] PostgreSQL/FastAPIฐานทดสอบใหม่ **94ข้อค่า +276ข้อHTTPผ่าน**; เทียบPHPกับใหม่ **1,882cell/กรณี** มี141ความต่างที่แจกแจง ไม่มีความต่างไร้คำอธิบาย ไม่ได้หมายถึงตรงทุกcell (126เป็นจำนวนเวรแทนช่องว่างเดิม)
- [x] Browserบริการจริง **20กรณี×จอ/print DOM/XMLผ่าน** =15แบบ+5กรณีเสริม ตรวจทุกcell/Number/null/หัว/วันที่; **120responsiveกรณี**=15×360/768/1024/1440×100/125% ไม่มีหน้าล้น ตารางเลื่อนภายใน; บัญชีA12กับหลายหอ18ผ่านprint/XMLแยกอีก2บัญชี
- [x] **ผลตรวจ PDF รอบก่อน:** 19ไฟล์/50หน้า A4แนวนอน หัวซ้ำ แถวครบ ไม่หลุดขอบ ไม่มีหน้าว่าง เรนเดอร์ทุกหน้าด้วยPopplerและตรวจภาพ; รอบตรวจซ้ำต่อเนื่องนี้รัน PDF checker ไม่ได้เพราะไม่มีโมดูล`pypdf` (ดูข้อจำกัดในส่วนผลตรวจซ้ำด้านบน); รอบนี้ยังดาวน์โหลด/parse Excel XMLและตรวจ print DOMจริงครบ ไม่ได้เปิดโปรแกรมExcelหรือใช้เครื่องพิมพ์จริง
- [x] regressionจำลองreports18กลุ่ม/text-size8กลุ่ม56กรณีรวมprint/XML15ชนิดผ่าน; unitหน้า41/41 หลัง21/21 และbuildผ่าน **รอบนี้รันใหม่**
- [ ] lint/typecheckแยกยังเรียกตรวจไม่ได้: ไม่มีscriptlint และไม่มีTypeScript compilerเหมือนเดิม คำสั่งทั้งสองexit1เพราะtooling ไม่เพิ่มdependency
- [ ] ข้อจำกัดที่ยังไม่รับรอง: TurnoverรวมPHPใช้GROUP BYไม่ผูกแถวเตียง ชุดนี้ได้7/30=.23 ใหม่ท้ายงวด7/35=.20; ไฟล์พิมพ์/ExcelProductivityเดิมล้มที่`$result->fetch_row()` จึงยืนยันได้เฉพาะนิพจน์และเอกสารใหม่ ไม่อ้างไฟล์เดิมรันผ่าน

ไฟล์โค้ดจริงที่แก้: `backend/app/reports.py`, `backend/app/api.py`, `frontend/components/ReportViewer.jsx`, `frontend/components/reports/ReportTables.jsx`, `frontend/lib/report-view.mjs`; เพิ่ม/ปรับชุดตรวจที่เกี่ยวข้องและ`frontend/tests/browser/reports.cjs`เพื่อรองรับGETช่องทาง/แยกผลเก่า เอกสารรายงานเฟส4/parity/fixture/progress หลักฐานใหม่ใต้ `docs/screenshots/parity-phase-4/` และ `output/pdf/parity-phase-4/` ไม่มีdependencyหรือmigrationใหม่ ไม่มีการแก้สิทธิ์/คำขอเขียนเวร/data model/เครื่องมือนำเข้า

ผลเดิมแยกชัด: เฟส3 652HTTP/39+17unit และเฟส2zoom200%เป็นประวัติ ไม่ใช้แทนผลเฟส4นี้ รอบนี้ไม่ทดสอบzoom200%จริง/อุปกรณ์จริงหรือข้อมูลย้อนหลังจริง ไม่ขอเจ้าของงานเลือกสูตรเพิ่ม ข้อที่ต้นทางไม่ให้ผลแน่นอนและไฟล์เดิมล้มบันทึกเป็นข้อจำกัด ไม่เดาว่าผ่าน

### ประวัติผลเฟส 3 งานประจำวัน

- [x] อ่านPHPเมนู/login/ฟอร์ม/ตัวรับ/ยืนยัน/ส่งกลับ/ข่าว/ความพึงพอใจซ้ำในจุดขาดหลักฐาน รันเฉพาะนิพจน์ยกยอดที่ดึงจากPHP13กรณีและตรวจซอร์ส11ข้อผ่าน ไม่เชื่อมMySQLเดิม
- [x] สร้างP1ทั้งหมด13แถวผ่านHTTPจริงบนclusterPostgreSQLทดสอบใหม่ C8/U5 ค้างA3/B2/รวม5; เปิดย้อนหลัง A2พ.ย.เช้าได้ต้นทางบ่ายวันเดียวกัน PT10/NB1/เตียง25 ไม่เปลี่ยนเป็นเวรก่อนหน้าทันที
- [x] ทดสอบครบPT/NB/เตียง/ประเภท1–5/บุคลากร และ13สาขาสามัญ/พิเศษ รวม28ตัวนับค่าต่างกันผ่านจอจริงและอ่านค่าที่เก็บกลับ; ศูนย์/ช่องว่าง/รายเดือนใช้ร่วม/แรงขัดแย้งและrollback/แผลเฉพาะบ่ายรหัสหลัก73ผ่าน คงGYN/SKINตรงช่องตามระบบใหม่เดิม ไม่อ้างว่าเลียนบั๊กชื่อรับผิดPHP
- [x] วงจรUIจริง A4ธ.ค.เช้า: rec_aบันทึกU1→ยืนยันC2→adminส่งกลับพร้อมเหตุผลU3→rec_aแก้U4→ยืนยันซ้ำC5 มี5เหตุการณ์และผู้ทำตรงกัน รายการCแก้ตรงบริการ409จนส่งกลับ
- [x] เพิ่มGETเหตุการณ์ตรวจสิทธิ์หอ และshared EntryActivityในฟอร์ม/history dialog แสดงเหตุผลส่งกลับ/ผู้ทำ/วันที่พ.ศ.จากข้อมูลจริง โหลดผิดพลาดลองใหม่ไม่เสียฟอร์ม ใช้คีย์บอร์ดและขยาย14→17.5pxได้
- [x] ข่าวเพิ่มผู้เขียนจริงในmodel/API/migration0006 ตามข้อเสนอที่อยู่ในขอบเขตอนุมัติแล้ว; snapshotผู้สร้าง/แก้ล่าสุดตรงPHP user_update ไม่ใช้ผู้อ่านแทน ข่าวก่อนmigrationที่ไม่มีหลักฐานคงnull; สร้างร่าง/เผยแพร่ด้วยอีกบัญชี/แก้/ลบผ่านจอและบริการจริง
- [x] ทดสอบอ่าน/เขียน/ยืนยัน/ส่งกลับ8บัญชี×2หอจริง รวมทุกตึกเฉพาะA=12 B=6 A+B/ผู้ดูแล=18 ตามD03 บัญชีผสมเขียนAได้แต่B403 ผู้อ่านหลายหออ่านได้แต่เขียน403 auditorไม่มีหอไม่อ่านข้ามหอ
- [x] บริการจริง652assertions, browserจริง8กลุ่มและreadback/recovery5กลุ่มผ่าน; responsive20กรณีหน้าแรก/login/entries/historyและ8กรณีactivity ที่360/768/1024/1440; regressionจำลองฟอร์ม20/history16/indicators18/text-size8กลุ่ม(56กรณี7หน้ารวมprint/XML15ชนิด)ผ่าน
- [x] unitหน้า39/39 หลัง17/17 และbuildผ่าน lintไม่มีscript; typecheckแยกไม่มีcompiler จึงรันตรวจสองคำสั่งนี้ไม่ได้ ไม่เพิ่มdependency
- [ ] ความพึงพอใจ:4unitURLผ่าน เปลี่ยนหอ/queryถูก ไม่กำหนดปลายทางไม่สร้างลิงก์ แต่ยังไม่มีcontentment/URLทดสอบ/สัญญายืนยันตัวตนและmappingaccount.id จึงไม่รับรองเข้าปลายทางได้

ไฟล์แก้หลัก: backend api/models/schemasและmigration0006; หน้าentries/home/login, HistoryEntryDialog, lib/api, home.css; เพิ่มEntryActivity/CSS, satisfaction helper/unit, ชุดตรวจPHP/HTTP/browser; แก้browserregressionให้รองรับGETevents แยกหลักฐานรอบนี้และรอโฟกัสจริง เอกสารparity/progress/รายงานเฟส3 หลักฐานใหม่อยู่ `docs/screenshots/parity-phase-3/` ไม่เขียนทับผลเฟสก่อน รายละเอียดคำสั่งและขอบเขตอยู่ในรายงานเฟส3

แยกจากผลเก่า:652HTTP/13PHP/11source/8+5browser/20+16+18+8regression/39+17unit/buildเป็นรอบนี้ทั้งหมด browser zoom200%จริงเป็นผลเฟส2เดิมไม่ได้ทำซ้ำ; ไม่มีPHP/MySQLintegration ข้อมูลย้อนหลังจริง เครื่องพิมพ์หรือExcelจริง ไม่มีประเด็นต้องให้เจ้าของงานเลือกสูตร/ผู้ยืนยันเพิ่ม ข้อมูลภายนอกที่ขาดบันทึกเป็นข้อจำกัด ไม่เดาว่าผ่าน ไม่เขียนฐานใช้งานจริงและไม่เริ่มเฟสถัดไป

ตรวจdiff/SHA256รอบสุดท้าย571ไฟล์เดิม: เปลี่ยน16 คงเดิม555 ไม่มีลบ เพิ่มโค้ด/ชุดตรวจ/รายงาน10และหลักฐาน113ไฟล์ inpatient/dependencyคงเดิม ปิดเฉพาะFastAPI/PostgreSQLทดสอบของเฟส3แล้ว มีผลยืนยันใน `docs/screenshots/parity-phase-3/diff-review.json` ก่อนใช้กับฐานเดิมต้องรันmigration0006; รอบนี้ทดสอบmigrationบนฐานใหม่และสำเนาจำลองเท่านั้น ไม่อัปเกรดฐานใช้งานจริง

### ประวัติผลเฟส 2 ตัวควบคุมข้อความ

- [x] ตัวควบคุมส่วนกลางชื่อไทย แสดงระดับปัจจุบัน ปิดปุ่มเมื่อสุดช่วง ใช้shared Button/สี/spacing/typography tokens; อยู่นอกAuthProviderทำงานได้ในหน้าเข้าสู่ระบบ
- [x] ค่าปกติ100%, กลาง112.5%, ใหญ่125%; จำค่าlocalStorage ข้ามเมนูและreloadทั้ง112.5/125 ค่าผิด5แบบกลับ100 และstorageใช้ไม่ได้ยังปรับได้ในหน้า
- [x] ทุกfont-sizeแบบpxบนจอในglobalsเปลี่ยนไปใช้tokens รวมlogin/clamp/KPI; pxที่เหลือเป็นprint8pxเดิมโดยตั้งใจ ไม่เพิ่มข้อจำกัดbrowser zoom
- [x] ตรวจ7หน้า `/login`, `/`, `/entries`, `/history`, `/indicators`, `/reports`, `/occupancy` ที่360/768/1024/1440pxทั้ง100/125 รวม56กรณี ไม่ล้นทั้งหน้า inputตัวเลข16→20pxและตาราง14→17.5px; เมนู/หัวข้อ/label/button/alert/dialogขยายตามระดับ
- [x] Tab/Enter/Space โฟกัสชัดและstatus live regionแจ้งระดับ; ที่112.5%inputlogin18px
- [x] บันทึก360pxทั้ง100/125ผ่าน ตรวจhit-testปุ่มได้ Toastเหนือแถบปุ่ม24px แก้F05จากQAเดิมในขอบเขตนี้ โดยส่งความสูงจากResizeObserverเดิมผ่านCSSเท่านั้น
- [x] เปิดEdgeแยก ตั้งbrowser zoom200%จริงผ่านWindows computer-use ขณะข้อความ125%: DPR1→2, innerWidth1416→708, visualViewport.scaleยัง1; บันทึกได้และไม่ล้นหน้า
- [x] พิมพ์15ชนิดตรวจprint media: font/line-height/padding/น้ำหนัก/ขนาดองค์ประกอบคงเดิมระหว่าง100/125; ปุ่มปรับซ่อนเมื่อพิมพ์; ชื่อไฟล์และXMLทั้ง15แบบเหมือนกันทุกไบต์
- [x] Browserใหม่ผ่าน8กลุ่ม และbrowserregressionการกรอกเดิมผ่าน20กลุ่ม; unitส่วนหน้า35/35 ส่วนหลัง17/17 และbuildผ่าน รอบนี้รันใหม่ทั้งหมด
- [x] lint/typecheckแยกยังรันตรวจไม่ได้จากtoolingเดิม: ไม่มีscriptlintและไม่มีcompiler ไม่ติดตั้งdependencyเพิ่ม

ไฟล์รอบนี้: เพิ่ม`frontend/components/TextSizeControl.jsx`, `frontend/styles/text-size.css`, `frontend/tests/browser/text-size.cjs`, `docs/parity-phase-2-text-size.md`; แก้`frontend/app/layout.js`, `frontend/app/globals.css`, `frontend/styles/tokens.css`, `frontend/styles/entries.css`, `frontend/components/entries/useEntryEditing.js` (เพิ่มstyle measurementหนึ่งบรรทัด), `INPATIENT_PARITY_TH.md`และไฟล์นี้ หลักฐานแยกใต้`docs/screenshots/parity-phase-2/` ไม่เขียนทับภาพเฟสเก่า

ผลรอบนี้ต่างจากหลักฐานเดิม: ทดสอบ56กรณี/8กลุ่ม/20regression/zoom200%/XML-print15ชนิดใหม่ทั้งหมด; ไม่ใช้ผล35/35,17/17หรือ72browserกลุ่มของเฟส7มาอ้างแทน ไม่รันชุดตัวเลข87ข้อของเฟส1เพราะไม่เปลี่ยนสูตร ไม่รันPHP/ฐานข้อมูลจริง ไม่ได้ตรวจNVDA/VoiceOver/soft keyboardมือถือจริง เครื่องพิมพ์หรือเปิดExcelจริง งานQAภาษาlogin/contrast/ขนาดเป้าหมายเดิมยังไม่ได้แก้ครบในเฟสนี้

ไม่มีเรื่องต้องให้เจ้าของงานตัดสินใจเพิ่มในเฟส2 ตรวจdiffและhashเทียบ497ไฟล์เดิม: คงเดิม490 เปลี่ยน7เฉพาะไฟล์ที่ระบุ ไม่มีลบไฟล์ และเพิ่มcomponent/CSS/สคริปต์ตรวจ/รายงานกับหลักฐานใหม่ ซอร์สinpatient/backend/คำขอ/สูตร/routing/data model/dependencyคงเดิม ตรวจลิงก์และตารางเอกสารผ่าน รายละเอียดในรายงานเฟส2 ไม่เริ่มเฟสถัดไป

### ประวัติก่อนเริ่มเฟส 2

เฟส 1 ตามแผนเทียบระบบเดิมครั้งนี้เป็นคนละงานกับเฟส 1 Foundation ของ UX/UI เดิม จัดทำตารางบทบาท/งาน/หน้า PHP/ปลายทางใหม่/ผลคาดหวัง/สถานะครบ W01–W16 รายงาน R01–R15 พิมพ์และส่งออก P01/P02 ทุกงานมีปลายทางหรือช่องว่างชัดเจน พร้อม [ชุดตัวเลขสมมติ P1 v1](parity-fixtures-phase-1.md) สองหอ 13รายการ สามเวร วันที่ขาดเวร เตียงเปลี่ยน สถานะปะปน และข้ามเดือน ดูตารางและข้อเลือกใน [รายงานเทียบระบบเดิม](../INPATIENT_PARITY_TH.md) จบเฉพาะเกณฑ์เฟสเอกสาร ยังไม่ผ่านตรวจรับทั้งระบบและยังไม่เริ่มเฟสถัดไป

หลังจบเฟส1 เจ้าของงานตอบD01/D02/D03/D08แล้ว: ยึดเตียงท้ายงวดเดียวกันทุกเวร ยึดProductivityจากไฟล์พิมพ์PHPที่เมนูลิงก์จริง คงสิทธิ์อ่านตามหอที่มอบหมายและผู้ดูแลเห็นทุกหอ และคงnull/ขีดเมื่อไม่มีตัวหาร บันทึกคำตอบพร้อมเป้าหมายตัวเลขในเอกสารทั้งสามไฟล์แล้ว **D01/D02ยังรอพัฒนา ไม่ได้เปลี่ยนสูตรในระบบ** D04–D07 ผู้มีสิทธิ์ยืนยัน และแถวรวมProductivityที่ผูกkkยังค้าง

รอบเฟส1นี้แก้เฉพาะเอกสารสามไฟล์: `INPATIENT_PARITY_TH.md`, `docs/parity-fixtures-phase-1.md` (ใหม่), `docs/ui-progress.md` รัน unitส่วนหน้า35/35 ส่วนหลัง17/17 และbuildผ่าน ตรวจชุดP1ด้วยPython87ข้อผ่านในหน่วยความจำ ไม่รันPHP/ฐานข้อมูลหรือทดสอบเบราว์เซอร์ซ้ำ lintไม่มีสคริปต์ และtypecheckแยกไม่มีcompilerของโครงการ รายละเอียดหลักฐานรอบนี้แยกจากผลเก่าในหัวข้อถัดไป

ผลตรวจซ้ำก่อนเฟส1 (20พ.ย.วันเดียวกัน): พบส่วนต่างฐานเตียง คอลัมน์ให้การพยาบาล ยอดสาขาข้ามหอ ยอดรวมรายละเอียดแผลกดทับ ผู้ประกาศข่าว สิทธิ์ข้ามหอ และเครื่องมือนำเข้าที่รองรับเฉพาะ `data_all` รอบนั้นแก้เอกสารสองไฟล์และมีผลunit35/35,17/17,buildผ่านอยู่แล้ว; ผลรอบนั้นไม่ใช่หลักฐานรันใหม่ของเฟส1

เฟส 0–6 รวม 3a/3b ดำเนินการแล้ว และเฟส 7 ตรวจ frontend แบบไม่แก้โค้ดแล้ว **ยังไม่ผ่านตรวจรับทั้งระบบ: ผ่าน 5/7 ข้อในเบราว์เซอร์ทดสอบ ไม่ผ่าน 2/7 ข้อ** ดู [ตารางผล QA และวิธีทดสอบจริง](ui-phase-7.md) พบศัพท์ระบบใน login/ข้อความสิทธิ์, contrast ขอบช่อง login, ปุ่ม login สูง 42px และ Toast บังปุ่มบันทึกมือถือ ยังต้องตรวจอุปกรณ์จริง/Zoom 200%/Lighthouse/เครื่องพิมพ์/Excel จริง

ใช้หัวข้อ A–E และแผน 0–7 ชุดหลังตามคำสั่งเฟส 1/2 ผู้ใช้อนุญาตเพิ่มคำขออ่านจากบริการเดิมสำหรับหน้าแรกและเลือกหอผู้ป่วยแล้ว ส่วนสิทธิ์ ช่วงเวลาเวร เวลาตัดรอบ และ metadata ที่ยังไม่ยืนยัน ไม่สร้างค่าขึ้นเอง ไม่เพิ่ม dependency และคงคำขอเขียนทั้งหมด

รายละเอียดอยู่ใน [ui-foundation.md](ui-foundation.md), [เฟส 2](ui-phase-2.md), [เฟส 3a](ui-phase-3a.md), [เฟส 3b](ui-phase-3b.md), [เฟส 4](ui-phase-4.md), [เฟส 5](ui-phase-5.md), [เฟส 6](ui-phase-6.md) และ [เฟส 7](ui-phase-7.md) ภาพอ้างอิง `01-home.png` ยังไม่พบ ส่วนภาพ `02`–`06` ทำสำเนาจากภาพเดิมแล้ว หลักฐาน QA ใหม่อยู่ใต้ `screenshots/phase-7/` แยกจากเฟสก่อน ไม่มีการแก้ frontend/backend/tests/dependency โดยงาน QA นี้

เฟส 7 ตามคำสั่งเจ้าของงานทำเฉพาะตรวจและรายงาน พบรายการที่ควรแก้ F01–F05 ใน `app/login/page.js`, `lib/api.js`, `app/globals.css`, `styles/entries.css` แต่ยังไม่แก้ ใช้บริการจำลองทั้งหมดเพื่อไม่อ่าน/เขียนข้อมูลผู้ป่วยจริง unit 35/35, browser regression 72 กลุ่ม, กรอกครบ 59 ช่องด้วย keyboard ที่ 1440/360px และ 64 measurements ผ่านด้านไม่ล้นหน้า; build ผ่าน ส่วน lint/typecheck ไม่มี tooling เดิม และยังไม่มีคะแนน Lighthouse

เฟส 6 ผู้ใช้อนุญาต initial GET อัตโนมัติและ GET รายวันเพื่อแสดงยอด/ความครบถ้วน เลือก **“คง Excel XML เดิม”** และให้ชื่อ **“โรงพยาบาลอากาศอำนวย”** สำหรับหัวพิมพ์ ส่วนเกณฑ์สี Q07 ยังไม่ยืนยัน จึงแสดงร้อยละแบบเป็นกลาง แยก complete/null/จำนวนเวรที่ขาดตามบริการ และแจ้งว่าสูตรรายเดือนยังเป็นสูตรชั่วคราว ไม่แก้สูตรหรือตัวหาร

เฟส 5 ผู้ใช้ตอบ **“อนุญาตตามนี้”** ให้เปลี่ยนจังหวะ GET เป็นอัตโนมัติ แยกสถานะโหลดรายวัน/รายเดือน และอ่านบริการเดิมเพื่อตรวจเวรบ่าย โดยคงคำขอเขียน ผู้ใช้ยืนยัน **“ใช่ เป็นเดือนก่อนเดือนรายงาน”** สำหรับยอดจำหน่าย จึงแสดงเดือนจริงเป็น พ.ศ. จาก helper เดียวกันในทั้งสองหน้า ไม่สร้างชื่อผู้บันทึก/เวลาที่บริการไม่มี

เฟส 4 ผู้ใช้ตอบเรื่องค่าเริ่มต้นว่า “เอาตามระบบเดิมอะแล้วแต่เลย” จึงคงประวัติเริ่มต้นเดือนและกดค้นหา ส่วนรอยืนยันยังโหลดทุกช่วงวันทันที ไม่มี GET เพิ่มเพื่อนับยอดทั้งหมด ชิปสถานะระบุชัดว่าเป็นจำนวนเฉพาะหน้าที่แสดง

## เฟส 1 เทียบระบบเดิม — ผลรอบนี้ 20 พฤศจิกายน 2569

### บันทึกคำตอบเจ้าของงานหลังปิดเฟสเอกสาร

| ข้อที่ตอบแล้ว | เกณฑ์ตรวจรับที่ใช้ต่อไป | สถานะการพัฒนา |
|---|---|---|
| D01 | เตียงท้ายงวดเดียวกันทุกเวรตามPHP; F05aดึก/เช้า/บ่าย46/22/40% รวมเดือน42% | ซอร์สใหม่ยัง57.50/27.50/40% ต้องปรับภายหลัง; ไม่รวมสูตรR08 |
| D02 | ยึด`inpatient/report/productivity_r.php`ที่เมนูลิงก์จริง; ประเภท5/4ใช้7.5/7.5 ยกเว้น12/13ใช้12/12 ไม่รวม28 ทั้งรายวัน/เดือน; F17หอ10/11/28ได้35.71% หอ12/13ได้57.14% | เปลี่ยนR09เป็น“ยังขาด”เมื่อเทียบเกณฑ์ที่เลือกแล้ว; ยังไม่แก้สูตรใหม่ |
| D03 | อ่านเฉพาะหอที่มอบหมาย ผู้ดูแลเห็นทุกหอ; F04เฉพาะA=12 ทั้งA/Bหรือผู้ดูแล=18 | คงกฎอ่านปัจจุบัน ไม่เปลี่ยนสิทธิ์ยืนยัน |
| D08 | ไม่มีตัวหารให้null/ขีดบนจอและพิมพ์ ส่งออกค่าว่าง; ตัวตั้ง0ที่ตัวหารมากกว่า0ยังเป็นอัตรา0 | คงพฤติกรรมใหม่ R13เป็น“ต่างโดยตั้งใจ”ที่เจ้าของงานเลือกแล้ว |

แก้เอกสารสามไฟล์เดิมเท่านั้น: INPATIENT_PARITY_TH.mdเพิ่มบันทึกคำตัดสิน/ปรับสถานะและข้อค้าง, docs/parity-fixtures-phase-1.mdเพิ่มเป้าหมายที่เลือกแยกจากผลซอร์สปัจจุบัน, docs/ui-progress.mdบันทึกคำตอบ/ผลตรวจรอบนี้ ข้อมูลตั้งต้นCSVและหลักฐาน19/20พ.ย.เดิมคงเดิม ไม่ต้องขอเลือกสี่เกณฑ์นี้ซ้ำเมื่อได้รับคำสั่งเฟสที่เกี่ยวข้อง

ผลที่รันใหม่เฉพาะรอบบันทึกคำตอบ: unitส่วนหน้า35/35 ส่วนหลัง17/17 และbuildผ่าน; lintเรียกไม่ได้เพราะไม่มีscript และ`npx --no-install tsc --noEmit`เรียกตรวจไม่ได้เพราะไม่มีcompilerเหมือนเดิม ตรวจเลขเป้าหมายด้วยPython5ข้อผ่าน ไม่รันชุด87ข้อซ้ำ (ผล87ข้อด้านล่างเป็นรอบปิดเฟส1ก่อนคำตอบ) และไม่อ้างผลunitเดิมว่าผ่านสูตรD01/D02ที่ยังไม่พัฒนา ไม่มีการทดสอบPHP/ฐานข้อมูล/เบราว์เซอร์ที่360/768/1024/1440pxรอบนี้

ตรวจขอบเขตรอบบันทึกคำตอบเทียบsnapshot497ไฟล์ก่อนแก้: เปลี่ยนเฉพาะเอกสารสามไฟล์ดังกล่าว อีก494ไฟล์คงเดิม ไม่มีเพิ่มหรือลบไฟล์ ตรวจdiffและลิงก์/หัวข้อ/เลขบรรทัด64จุดพร้อมจำนวนคอลัมน์ตารางผ่าน หลักฐานตรวจเดิมและCSVตั้งต้นคงเดิม ไม่มีการแก้inpatient, frontend/backend, logic/API/สิทธิ์/routing/data model/dependency หรือเริ่มเฟสถัดไป

### งานที่เสร็จและขอบเขต

- [x] อ่าน AGENTS.md, ui-progress และผลตรวจซ้ำ20พ.ย.ก่อนทำงาน อ่าน A/D/E/ข้อจำกัดของspecโดยไม่แก้หน้าจอ
- [x] ต่อเติม INPATIENT_PARITY_TH.md เป็นรายการตรวจรับงานบันทึก/ยกยอด/แก้/ยืนยัน/ส่งกลับ/รายการค้าง/ข่าว/ความพึงพอใจ/ประวัติ/นำเข้า พร้อมแยกบทบาทจริง ไม่สมมติบทบาทหัวหน้าหอ
- [x] แจกแจงรายงาน15แบบและไฟล์พิมพ์/ส่งออกที่ลิงก์จริง มีสถานะเพียง “ตรงแล้ว / ต่างโดยตั้งใจ / ยังขาด / ยังพิสูจน์ไม่ได้” พร้อมอธิบายว่าแถวที่ตรงจากซอร์สยังไม่เท่ากับรับรองทั้งหน้าในระบบจริง
- [x] อ่านPHPแบบอ่านอย่างเดียว ทั้งเมนู ฟอร์ม ตัวรับ manage_data/confirm_data_save/return_save/news_save และรายงาน/ไฟล์พิมพ์เฉพาะจุดขาดหลักฐาน เทียบ permissions/api/reports/occupancy/models และfrontendที่เกี่ยวข้อง
- [x] เพิ่มหลักฐาน: Productivityไฟล์ที่เมนูชี้ไม่ยกเว้น28เหมือนจอ/ไฟล์ซ้ำที่ราก; ปุ่มExcelรีแอดมิตไปbed_rate; รายเดือนต่อสถานะหลังORDER BY; แผลกดทับ0/0จอเก่า0.00แต่ไฟล์พิมพ์ว่าง; โค้ดแถวรวมProductivityผูกกับตัวแปรkkที่ยังไม่ยืนยันว่าถูกกำหนด
- [x] เตรียมชุดP1 v1พร้อมCSVย่อ13แถว ค่าฟิลด์ที่เหลือชัดเจน สาขา/แผลกดทับ/รีแอดมิต/ข่าว และผลคาดหวังF01–F17; แยกการทดสอบฟอร์มPHPที่รับGYN/SKINผิดออกจากข้อมูลตั้งต้นรายงาน
- [x] ระบุปุ่มปรับขนาดตัวอักษรทั้งระบบเป็นช่องว่างW16 ยังไม่พัฒนาในเฟสเอกสาร
- [x] แยกข้อเลือกD01–D08 โดยเริ่มฐานเตียงรวมรายเวร Productivity และผู้ดูยอดโรงพยาบาล พร้อมตัวเลขก่อน–หลัง/ไฟล์ที่จะเปลี่ยนหากอนุมัติ

### ผลตรวจที่รันใหม่รอบนี้

| คำสั่ง/วิธีตรวจ | ผล |
|---|---|
| frontend: `npm run test:ui` | ผ่าน35/35 exit0 |
| backend: `.venv/Scripts/python.exe -m unittest discover -s tests -v` | ผ่าน17/17 exit0 |
| frontend: `npm run build` | ผ่านexit0; มีข้อความRunning TypeScriptจากNextแต่ไม่ใช่ผลตรวจชนิดข้อมูลแยก |
| frontend: `npm run lint` | เรียกไม่ได้ ไม่มีscript lint ไม่ติดตั้งเครื่องมือเพิ่ม |
| frontend: `npx --no-install tsc --noEmit` | เรียกตรวจไม่ได้ npxยกเลิกเพราะไม่มีcompilerแพ็กเกจของโครงการ ไม่ติดตั้งเพิ่ม |
| PythonตรวจชุดP1จากMarkdown | ผ่าน87assertions ตรวจจำนวน/สถานะ/คีย์/ประเภทผู้ป่วย รายวัน รายเดือนแยกเวร/รวม/ยืนยัน census ตัวชี้วัด turnover/LOS/อัตรากำลัง ครองเตียง สาขา รายละเอียดแผลกดทับ และProductivityรหัส10/12/13/28 รวมประเมินนิพจน์PHPที่ยกมา |
| ลักษณะการตรวจชุดP1 | เรียกฟังก์ชันใหม่ในหน่วยความจำและแหล่งอ่านจำลองสำหรับการแปลงสาขา/รายละเอียดแผลกดทับ ไม่พิสูจน์คำค้นSQLจริง สิทธิ์ผ่านHTTP หรือการย้ายข้อมูล; สคริปต์ชั่วคราวอยู่นอกworkspace ไม่เพิ่มไฟล์ทดสอบโค้ดในเฟสเอกสาร |

รอบตรวจตัวเลขครั้งแรกเรียกตัวช่วยcompute_total_seriesด้วยปีแทนรายการเดือนจึงหยุดด้วยTypeError แก้อาร์กิวเมนต์ในสคริปต์ตรวจชั่วคราวแล้วรันทั้งหมดใหม่ผ่าน87ข้อ ไม่แก้ซอร์สระบบและไม่ใช้ผลรอบที่หยุดเป็นผลผ่าน

### ผลเดิมที่อ้าง และสิ่งที่ไม่ได้รันรอบนี้

- หน้าจอที่360/768/1024/1440px: **ไม่ได้ตรวจซ้ำในเฟสนี้** เพราะเปลี่ยนเฉพาะเอกสาร หลักฐานเฟส7ที่อ้างครอบคลุม `/`, `/entries`, `/history`, `/history?status=unconfirmed`, `/indicators`, `/reports`, `/occupancy`, `/login`; ยังมีF01–F05และงานอุปกรณ์จริงค้างตามui-phase-7.md
- ไม่รันPHP/MySQL (ไม่พบphpในPATH), PostgreSQL, การนำเข้าCSV, โปรแกรมความพึงพอใจ, เครื่องพิมพ์/Excelจริง หรือbrowser integrationรอบนี้ ผลสูตรPHPคืออ่านซอร์สแล้วคำนวณนิพจน์ด้วยตัวเลขสมมติ
- ผลPostgreSQL/API/Edge/importที่19พ.ย.และbrowser72กลุ่ม/PDF/XMLของเฟส7เก็บเป็นหลักฐานเดิม ไม่อ้างว่ารันใหม่หรือผ่านเกณฑ์ที่ยังไม่มีข้อมูล

### สถานะคำถามหลังคำตอบเจ้าของงาน

ดูตัวเลือกและตัวเลขครบในINPATIENT_PARITY_TH.md:

| รหัส | ต้องเลือก/ยืนยัน |
|---|---|
| D01 · ตอบแล้ว | ยึดเตียงท้ายงวดเดียวกันทุกเวรแบบPHP46/22/40%; รอพัฒนาตามเกณฑ์ |
| D02 · ตอบสูตรแล้ว | ยึดใบพิมพ์ที่เมนูลิงก์จริง ข้อยกเว้น12/13ไม่รวม28; ยังต้องยืนยันว่าเคยใช้แถวรวมที่ผูกkkหรือไม่ |
| D03 · ตอบขอบเขตอ่านแล้ว | คงตามหอที่มอบหมาย ผู้ดูแลเห็นทุกหอ; ยังไม่ได้เลือกเรื่องผู้บันทึกยืนยันเองหรือแยกหัวหน้าหอ |
| D04 | ช่วงวันและตารางประวัติที่จะย้าย; วิธีเข้าความพึงพอใจ/ปลายทางจริง |
| D05 | เพิ่มคอลัมน์/ยอดรวมที่ขาด คงการแก้GYN/SKIN/วัน/เตียงที่กำกวม และแสดงผู้ประกาศหรือไม่; รับรองสูตรครองเตียงชั่วคราว/หอยกเว้นแยกD01 |
| D06 | ยืนยันส่งออกรีแอดมิตตรงรายงานใหม่ แม้ลิงก์Excelเก่าไปครองเตียง |
| D07 | ยืนยันกรองสถานะรายเดือนตามWHEREใหม่ หรือขอหลักฐานรันPHPเก่าเพิ่มก่อนเลือก |
| D08 · ตอบแล้ว | คงขีด/nullเมื่อไม่มีตัวหารตามระบบใหม่สอดคล้องทุกผลลัพธ์ ไม่แสดง0.00แทน0/0 |

คำถามQ02/Q03/Q04/Q05/Q07/Q11/Q14/Q15และผลQAค้างเดิมด้านล่างยังไม่ถูกตอบโดยงานนี้ ไม่เริ่มเฟสอื่นและไม่ตีความการจบเฟสเอกสารเป็นการอนุมัติlogic/API/สิทธิ์/data model/dependency

### ตรวจไฟล์และลิงก์ก่อนจบ

ใช้snapshotSHA-256ก่อนแก้เป็นฐาน เพราะโฟลเดอร์workspaceไม่มี.git ตรวจ496ไฟล์เดิม (ไม่นับnode_modules/.next/.venv/แคช/output): ตรงเดิม494ไฟล์ เปลี่ยนเฉพาะINPATIENT_PARITY_TH.mdกับdocs/ui-progress.md และเพิ่มdocs/parity-fixtures-phase-1.mdหนึ่งไฟล์ รวมปัจจุบัน497ไฟล์ ไม่มีการเพิ่ม/ลบ/แก้ซอร์สinpatientหรือfrontend/backend/dependency ตรวจdiffเอกสารเดิมสองไฟล์อีกครั้งและยืนยันเนื้อหาหลักฐาน19/20พ.ย.เดิมในINPATIENT_PARITY_TH.mdคงครบทุกตัวอักษร ส่วนui-progressเก็บประวัติUX/UIเดิมและเพิ่มผลเฟสนี้แยกชัดเจน

ตรวจลิงก์ไฟล์ในเอกสารสามไฟล์64จุดผ่าน รวมปลายทาง/เลขบรรทัด/หัวข้อ ตรวจจำนวนคอลัมน์ตารางและความครอบคลุมW16/R15/P2ผ่าน ไม่เพิ่มเอกสารร่างหรือไฟล์ทดสอบลงในซอร์ส ผลตรวจนี้ไม่รวมการรับรองตัวเลขบนPHPที่ยังไม่รัน

## Checklist เฟส UX/UI เดิม

### เฟส 0 — Audit

- [x] อ่าน AGENTS.md และ spec ทุกบรรทัด รวม A/D/E/ข้อจำกัดและรายละเอียดทุกหน้า
- [x] ดูภาพเดิม 6 ภาพ พร้อมระบุภาพซ้ำและหน้าที่ไม่ได้แนบ
- [x] ตรวจทุก route, components/lib ที่ใช้ร่วม และบริการที่เกี่ยวข้อง
- [x] จับคู่ทุกเมนูกับ route/component/ฟังก์ชันเรียกข้อมูล รวม login และ auth ที่ใช้ร่วม
- [x] เติมข้อมูลระบบและฟิลด์ที่ยืนยันได้ใน spec พร้อมไฟล์อ้างอิง
- [x] รวมสิ่งที่ไม่ทราบและข้อขัดแย้งเป็นคำถาม Q01–Q16
- [x] สรุปไลบรารีที่มีและสิ่งที่ต้องสร้าง/พิจารณาเพิ่มโดยไม่ติดตั้ง
- [x] ทำแผน components จุดเสี่ยง และตารางทดสอบ responsive
- [x] ทดลอง lint/typecheck/build และบันทึกข้อจำกัดเดิม (build ผ่าน; อีกสองรายการยังรันตรวจไม่ได้)
- [x] ตรวจ diff เอกสารและตรวจว่าไม่มีการแก้โค้ด/API/logic ของงานนี้

### เฟส 1 — Foundation (พัฒนาเสร็จ)

- [x] ใช้ขอบเขต Foundation ตามคำสั่งใหม่; ไม่แต่งความหมายคำย่อ/ช่วงเวลาเวรที่ยังไม่ทราบ และไม่เพิ่ม dependency
- [x] อ่าน A/D/E/ข้อจำกัด; สร้าง tokens สี semantic, typography, spacing, radius, shadow และ tabular numbers พร้อม aliases สีเดิม
- [x] ใช้ Sarabun น้ำหนัก 400/500/600/700 ผ่าน next/font และตรวจว่าโหลดสำเร็จ
- [x] ทำ util วันที่/เดือน/เวลา/ตัวเลข/ปีงบประมาณ และ picker กลาง โดยเก็บวันเป็น ISO เดือนเป็น YYYY-MM และปีงบประมาณเป็น พ.ศ. ที่ขอบเขต UI
- [x] สร้าง shared components 29 ตัวและหน้า dev UI kit แสดงสถานะปกติ โฟกัส disabled/read-only/loading/empty/error และตัวอย่างโต้ตอบที่เกี่ยวข้อง
- [x] ตรวจที่ 360/768/1024/1440px ไม่มี page overflow; inputs 16px, controls สูง ≥44px; contrast ผ่านเกณฑ์; ทดสอบ dialog/keyboard/ตัวกรอง/ตาราง/วันที่/Popover
- [x] `npm run test:ui` ผ่าน 9 กรณี; build ผ่าน; lint/typecheck ยังรันตรวจไม่ได้จาก tooling เดิม; ตรวจขอบเขตไฟล์และอัปเดตเอกสาร
- [x] ได้รับคำสั่งจากเจ้าของงานให้เริ่มเฟส 2 แล้ว; UI kit ยังเปิดให้ตรวจรูปแบบได้ ไม่ถือเป็นการยืนยันว่าเจ้าของงานตรวจทุกสถานะแล้ว

### เฟส 2 — App Shell และหน้าแรก

- [x] ได้รับอนุญาต Q10 เฉพาะ GET สำหรับหน้าแรก/เลือกหอ; Q02/Q03/Q04/Q11/Q14 ที่ข้อมูลขาดยังคงเป็นข้อจำกัดตามรายละเอียดด้านล่าง ไม่เปลี่ยน login
- [x] Sidebar 248px ย่อเป็น 80px และจำสถานะ; rail 80px ที่ 768–1023px; bottom nav 5 ปุ่มต่ำกว่า 768px และ drawer เมนูทั้งหมด
- [x] Active แยก history query, badge ซ่อนเมื่อ 0, header/breadcrumb/วัน พ.ศ./ตัวเลือกหอ/โปรไฟล์/ออกจากระบบ โดยคง route เดิม
- [x] สถานะเชื่อมต่อจากการอ่านรายชื่อหอและตัวนับจริง พร้อมลองใหม่; แจ้งขอบเขตเวลาตรวจสอบล่าสุด ไม่อ้างว่าเป็นเวลาซิงก์ทุกส่วน
- [x] หน้าแรก: สถานะเวรจริง ความครบถ้วนหลายหอ KPI 5 รายการเทียบเวรเดียวกันเมื่อวาน แนวโน้ม 7 วัน ข่าว และ loading/empty/error/retry; ไม่ใช้ข้อมูลสมมติในหน้าใช้งาน
- [x] ข่าวใช้ dialog เต็มจอมือถือ คงสิทธิ์ is_admin และ title/body/published/version/CSRF ของ POST/PUT/DELETE เดิม
- [x] ตรวจหน้าแรกที่ 360/767/768/1023/1024/1440px, ย่อเมนูจำข้าม reload, Esc/focus trap/focus return/scroll lock/ปิด drawer เมื่อถึง 768px และโปรไฟล์/ออกจากระบบบนมือถือ; CSS เผื่อ safe area แต่ยังไม่ได้ตรวจเครื่อง iPhone จริง
- [x] ตรวจ shell บนอีก 6 ปลายทางที่ 360/768/1024/1440px และค่าเริ่มต้นหอ/ลิงก์เปิดเวร; ไม่แก้โครงหรือคำขอของหน้าเฟสถัดไป
- [x] เทสต์ 15 กรณีและ build ผ่าน; lint/typecheck ยังตรวจไม่ได้จาก tooling เดิม; เทียบ hash ขอบเขตและอัปเดตเอกสาร
- [x] เจ้าของงานสั่งเริ่มเฟส 3a แล้ว; ไม่ถือว่าเป็นคำตอบเรื่องเวลาตัดรอบ/ช่วงเวลาเวร/metadata ที่ยังขาด

### เฟส 3 — บันทึกข้อมูลประจำวัน

#### เฟส 3a — โครงสร้างและ layout (เสร็จ)

- [x] ใช้ขอบเขตตามคำสั่งใหม่: presentation เท่านั้น ไม่แก้ส่วนสร้าง body/คำขอ/ค่าเริ่มต้น/การยกยอด และไม่เดาคำตอบ Q02/Q03/Q05/Q06/Q10/Q12/Q13
- [x] Context bar + shared ThaiDatePicker/ShiftSelector + sticky แบบย่อ/BottomSheet บนมือถือ โดยยังต้องกดเปิดแบบฟอร์ม ไม่มี auto-load เพิ่ม
- [x] ชื่อ/สถานะ/แหล่งยกยอดจริง โหมดสร้างใหม่/แก้ไข/อ่านอย่างเดียว พร้อมเหตุผลและวัน พ.ศ.; ไม่สร้างเวลาเวร/ชื่อผู้บันทึกสมมติ
- [x] ครบ 29 ช่องหลักรวมเตียง, 26 ช่องสาขาและ 2 ช่องแผลกดทับเฉพาะเวรบ่าย, 2 ช่องรายเดือนร่วมกัน แต่ละ field มี input ชุดเดียว
- [x] Named container queries: <600px accordion, 600–999px การ์ดสองคอลัมน์, ≥1000px กริด; ปุ่มบันทึก/ยืนยันเดิมใน StickyActionBar และโหมดกรอกมือถือ
- [x] คง native number/required/min/max/step/readonly, 0/ว่าง/null, dirty/busy; accordion เปิดส่วนที่ validation ไม่ผ่านโดยไม่เปลี่ยนกฎ
- [x] เก็บคำขอก่อนแก้แล้วเทียบ deep equality หลังแก้ 8 กรณี ครบสามเวร/สร้าง/แก้/รายเดือน/ยืนยัน/อ่านอย่างเดียว และตรวจซอร์ส handler ตรงทุกตัวอักษร
- [x] ตรวจ `/entries` ที่ 360/768/1024/1440px ไม่มี page overflow ค่ากรอกไม่หายเมื่อ resize; ช่องสูง ≥44px ฟอนต์ 16px และทดสอบ BottomSheet/Esc/โหมดกรอก/วันที่ พ.ศ. ส่ง ISO
- [x] `npm run test:ui` 15/15 และ build ผ่าน; lint/typecheck ยังขาด tooling เดิม; อัปเดตเอกสารและหลักฐาน field ก่อน–หลัง
- [x] เจ้าของงานสั่งเริ่มเฟส 3b แล้ว โดยคงส่วนสร้างข้อมูลส่งเดิม

#### เฟส 3b — การกรอกและตรวจทาน (เสร็จตามขอบเขตที่อนุญาต)

- [x] คำสั่งเฟส 3b อนุญาต Q12 ด้าน keyboard/draft/guard/ทางลัดแล้ว ไม่สมมติคำตอบเรื่องสิทธิ์ เวลาเวร หรือศัพท์ทางการพยาบาลที่ยังขาด
- [x] เลือกทั้งช่องเมื่อ focus, Tab/Enter/Shift ย้อนลำดับอ่าน เปิด accordion ที่ต้องกรอก, Ctrl/Cmd+S ผ่าน submit เดิม และกันล้อเมาส์เปลี่ยนค่า
- [x] ไฮไลต์ช่องที่ต่างจากค่าต้นฉบับ ยอดคงเหลือ PT/NB ไม่บวก A&D และคำเตือนติดลบ/เกินเตียง/ประเภทเทียบ PT เป็นการแสดงผล ไม่บล็อกเพิ่ม
- [x] เก็บค่าค้างแยกบัญชี/หอ/วัน/เวร/รายการ/version และ snapshot รายเดือน; คืนค่าเฉพาะเมื่อกดเองและต้นฉบับตรง/ยังเขียนได้; ล้างหลังบันทึกสำเร็จหรือย้อนค่าทั้งหมดเป็นเดิม
- [x] ConfirmDialog ก่อนเปลี่ยนบริบท/เปิดใหม่/กดลิงก์/ออกจากระบบ และ native beforeunload ก่อนออกจากเอกสาร; ยกเลิกแล้วคืนค่า/โฟกัสเดิม
- [x] แถบบันทึกมียอด/คำเตือน/dirty/เวลาเก็บในเครื่องและเวลาบันทึกในหน้านี้; ปรับตาม visualViewport, Toast และทางลัดหลังบันทึก โดยไม่เดาวันข้ามคืน
- [x] ส่วนรายเดือนพับได้ทุกขนาด แสดงเดือน/สถานะ/ผลกระทบทั้งเดือน ใช้ labels ร่วมกับตัวชี้วัดและลิงก์บริบทตรงกัน; เตือนแผลกดทับเฉพาะเวรบ่ายที่ยังไม่มีข้อมูล
- [x] คงส่วนสร้าง body/request, initialValues, confirmEntry และ load/save ของตัวชี้วัดตรงต้นฉบับ; raw requests เทียบ deep equality ผ่าน 8 กรณี ไม่มี endpoint/dependency/routing ใหม่
- [x] ตรวจ `/entries` ที่ 360/768/1024/1440px ไม่มี page overflow; browser 20 กลุ่มตรวจ รวมค่าชนกัน ข้ามบัญชี อ่านอย่างเดียว storage ใช้ไม่ได้ และโฟกัสผิดพลาด; เก็บ script รันซ้ำได้
- [x] `npm run test:ui` 21/21 และ build ผ่าน; lint/typecheck ยังไม่มี tooling เดิม; ตรวจขอบเขตไฟล์และอัปเดตหลักฐาน
- [x] เจ้าของงานสั่งเริ่มเฟส 4 แล้ว; คีย์บอร์ด iPhone/Android จริงและ QA รวมยังค้างเฟส 7

คงปุ่มเปิดแบบฟอร์มเดิม ไม่เพิ่ม auto-load หรือ autosave เข้าบริการ คำถาม Q03/Q05/Q06/Q11 ที่ข้อมูลยังไม่มีคงอยู่ตามเดิม

### เฟส 4 — ประวัติและรอยืนยัน

- [x] ชื่อหน้า/เมนูตรง A5 คงสิทธิ์ `can_write/is_admin` เดิม และคงช่วงเดือน/กดค้นหาตามคำตอบผู้ใช้ ไม่เปลี่ยนเป็น auto-load 7 วัน
- [x] FilterBar + compact DateRangePicker พ.ศ. / query/chips; table/cards บนมือถือ; empty/error/loading/retry ใช้ shared components
- [x] คง `/history?status=unconfirmed` ทุกช่วงวัน จัดกลุ่มวันตามลำดับบริการ และเปิดรายละเอียดก่อนยืนยัน/ส่งกลับ
- [x] คง limit 51 เพื่อแสดง 50 แถว offset เดิม และย้อนหน้าก่อนเมื่อทำรายการกับแถวสุดท้ายของหน้าถัดไป
- [x] ปุ่มแก้ไขใช้ ward/date/primary shift id ของแถว เปิดฟอร์มเฟส 3 จริงด้วยหอที่ไม่ใช่หอแรก วันย้อนหลัง และ shift 73 พร้อมค่ารายการเดิม
- [x] คง POST expected_version/reason ที่ trim/CSRF/event ตัวนับ; เทียบคำขออ่าน/เขียนก่อน–หลังผ่าน ไม่มี bulk endpoint หรือคิวส่งซ้ำ
- [x] จำนวนชิปเฉพาะแถวในหน้าที่แสดง ไม่รวมแถว lookahead หรืออ้างเป็นยอดทุกหน้า; “ยังไม่บันทึก” เป็นลิงก์ไปหน้าแรก ไม่ส่ง status ที่ไม่มีในบริการ
- [x] ทั้งสองหน้าที่ 360/768/1024/1440px ผ่าน ไม่มี page overflow; browser 16 กลุ่มตรวจ รวมสิทธิ์ ข้อมูลชนกัน วันที่ผิด และคำขอแบ่งหน้า
- [x] ตรวจ UI kit 4 ขนาดและทดสอบกลับเฟส 3b 20 กลุ่มตรวจผ่าน หลังขยาย shared components/แก้ Esc และ Tab สำหรับ dialog ซ้อน
- [x] เทสต์ 25/25 และ build ผ่าน; lint/typecheck ยังไม่มี tooling เดิม; ตรวจขอบเขตและอัปเดตเอกสาร
- [x] เจ้าของงานสั่งเริ่มเฟส 5 แล้ว; อุปกรณ์มือถือจริงและ QA รวมยังอยู่เฟส 7

### เฟส 5 — ตัวชี้วัดเสริม

- [x] Q06 ยืนยันเดือนก่อนเดือนรายงาน; Q10/Q13 อนุญาต auto-load/แยกสถานะ/GET ตรวจเวรบ่ายแล้ว; Q11 ยังไม่แสดง metadata ที่บริการไม่มี
- [x] ใช้ shared Card/NumberInput/ThaiDatePicker/ThaiMonthPicker/InfoCallout/สถานะและเหตุผลปุ่ม disabled พร้อมภาษาไทย
- [x] คง key หอ/วันกับหอ/วันแรกเดือน และ PUT ตัวเลข/CSRF เดิม เทียบคำขอก่อน–หลังตรงกันสองชุด; โหลดล้มเหลวไม่เปิดบันทึกค่าเริ่มต้นศูนย์
- [x] จับคู่เวรบ่ายด้วย legacy 3 แล้วใช้ primary ID จริงตรวจ entry-form; ยืนยันแล้วอ่านอย่างเดียว ไม่มีเวรมีลิงก์บริบทเดิม บัญชีอ่านอย่างเดียวบันทึกไม่ได้
- [x] ชื่อช่องรายเดือนตรงกันทั้งข้อความและชื่อที่โปรแกรมอ่านหน้าจออ่าน โดยแก้ในหน้าประจำวันเฉพาะ label/import; initialValues/ส่วนสร้างคำขอ/confirmEntry ตรงเดิม
- [x] ตรวจ 360/768/1024/1440px ไม่มี page overflow; การ์ดซ้อนต่ำกว่า 1024px และเคียงกันตั้งแต่ 1024px; กรอกค้างแล้วเปลี่ยนบริบท/ออกหน้ามีคำเตือน
- [x] Browser ตัวชี้วัด 18 กลุ่มและ regression ฟอร์ม 20 กลุ่ม; unit 28/28 และ build ผ่าน; lint/typecheck ยังไม่มี tooling เดิม ตรวจขอบเขต/อัปเดตเอกสารแล้ว
- [x] เจ้าของงานสั่งเริ่มเฟส 6 แล้ว

### เฟส 6 — รายงาน อัตราการครองเตียง พิมพ์/ส่งออก

- [x] Q08/Q09/Q10 ตอบแล้ว; Q07 ใช้สีกลางระหว่างรอยืนยัน และไม่แต่ง Q11 ผู้บันทึก/เวลาแก้ไขที่บริการไม่มี ผู้พิมพ์เป็นบัญชีที่กำลังพิมพ์จริง
- [x] คง 15 ประเภทสำหรับผู้ดูแล / 13 ประเภทสำหรับผู้ใช้อื่น ใช้ FilterBar/Thai pickers/FiscalYearSelect/PageHeader พร้อมเหตุผลปุ่ม disabled
- [x] คงสอง route และพารามิเตอร์เดิมครบ 15 แบบ โหลดเริ่มต้นตามที่อนุญาต; เปลี่ยนตัวกรองแล้วกดแสดงรายงาน คงรูปแบบวัน ISO/ปี ค.ศ. ที่บริการรับ
- [x] ยอดสรุปรายวัน PT อิงเวรล่าสุดต่อหอและรับ/จำหน่ายทั้งวัน พร้อมรายชื่อหอที่บันทึกยังไม่ครบ; ไม่รวมยอดตั้งต้นหลายเวรหรือแต่งค่าจากข้อมูลขาด
- [x] ครองเตียงใช้ complete/bed_rate/average/total เดิม แสดง %/progress/legend/ส่วนต่างเมื่อเทียบได้; ไม่มีการคำนวณสูตรหรือค่าเฉลี่ยแทน backend
- [x] ตาราง sticky หัว/หอและเลื่อนในกรอบ มือถือการ์ดเปิด 12 เดือนและสลับตารางได้; หัวเดือน/วันที่บนจอ พิมพ์ และ XML เป็น พ.ศ.
- [x] พิมพ์ A4 แนวนอน ทวนหัวกระดาษ/หัวตารางทุกหน้า ไม่ตัดแถว ตารางกว้างแบ่งชุดคอลัมน์พร้อมบริบทเดิม; PDF ข้อมูลสมมติ 31+3 หน้า ตรวจแถวครบและอ่านภาพขาวดำแล้ว
- [x] ดาวน์โหลด Excel XML ครบ 15 ประเภท ชื่อไฟล์ พ.ศ. ตัวเลขและชนิด Number ตรงรายงานเดิม null ไม่กลายเป็นศูนย์
- [x] สองหน้าที่ 360/768/1024/1440/1920px ไม่ล้นทั้งหน้า และครองเตียงครบทุกคอลัมน์ที่ 1920px; UI kit 4 ขนาด/Popover เดิมผ่าน
- [x] Unit 35/35, browser 18 กลุ่ม และ build ผ่าน; lint/typecheck ยังไม่มี tooling เดิม ตรวจ diff/hash และอัปเดตเอกสารแล้ว
- [x] เจ้าของงานสั่งเริ่มเฟส 7 แบบตรวจอย่างเดียวแล้ว; Q07 เกณฑ์สียังรอยืนยัน

### เฟส 7 — QA รวมระบบ

- [x] ตรวจ 8 มุมมองที่ 360/390/768/1024/1280/1440/1920px และแนวนอน 1024×768 รวม 64 กรณี; จุดเปลี่ยนเมนู 767/768 และ 1023/1024 ถูกต้อง
- [x] ไม่พบ horizontal scroll ทั้งหน้า; ครองเตียงครบที่ 1920px หัว/คอลัมน์หอ sticky และเลื่อนภายในกรอบถูกต้อง
- [x] กรอก/บันทึกครบ 59 ช่องด้วย keyboard events ที่ 1440/360px และ regression guard/draft/dialog/สิทธิ์/ข้อมูลชนกันผ่าน ไม่ถือเป็นการตรวจ soft keyboard จริง
- [x] ตรวจ contrast/ขนาดเป้าหมาย พบ F03 ขอบ login 1.34:1/focus 2.77:1, F04 ปุ่ม 42px และ F05 Toast บังปุ่มมือถือ จึงยังไม่ผ่านส่วนนี้
- [x] ตรวจ loading/empty/error/retry ของส่วนโหลดข้อมูล ใช้ข้อมูลสมมติ และตรวจ read-only/disabled reason จาก regressions
- [x] วันที่บนจอ/confirm/ชื่อไฟล์ XML/PDF เป็น พ.ศ.; พบ F01/F02 ศัพท์ระบบใน login/ข้อผิดพลาด entry จึงยังไม่ผ่านเกณฑ์ข้อความ
- [x] รัน regression เดิม 72 กลุ่ม ผ่าน ใช้ mock เท่านั้น ไม่มีคำขอหลุดไปยังข้อมูลผู้ป่วยจริง
- [x] ตรวจ A4 landscape ซ้ำ PDF 31+3 หน้า หัวซ้ำ แถวครบ ไม่ล้น; XML 15 ชนิดคงตัวเลข/ชื่อไฟล์ พ.ศ.
- [x] รัน unit/build ผ่าน; lint/typecheck ตรวจไม่ได้จาก tooling เดิม ตรวจ diff/hash และเขียนตารางผลพร้อมรายการไฟล์ที่ควรแก้ โดยไม่แก้โค้ด
- [ ] แก้ F01–F05 หลังได้รับคำสั่ง แล้วตรวจซ้ำ
- [ ] Lighthouse Accessibility ≥95 ทุกมุมมอง และ visual/manual contrast ทุกสภาวะจริง — ยังไม่มีคะแนน ไม่อนุมานจาก build/contrast scan
- [ ] Zoom 200%, NVDA/VoiceOver, iPhone/Android soft keyboard/safe area, printer/Excel จริง และ backend integration ในระบบทดสอบ ตาม M01–M07
- [ ] เจ้าของงานตรวจรับผล QA; ยังไม่ปิดการตรวจรับทั้งระบบ

## Component ที่ต้องสร้าง/ขยาย

รายการเฟส 1 สร้างแล้วใน `frontend/components/ui/` และแสดงใน UI kit; เฟส 2–6 สร้างตามรายการด้านล่าง สัญญา/ไฟล์/ผลตรวจให้ดูรายงานแต่ละเฟส

| เฟส | รายการ | นำของเดิมมาใช้/ขอบเขต |
| --- | --- | --- |
| 1 | CSS tokens, typography, `Icon`, `Button` (primary/secondary/ghost/destructive), `Card`, `FormField`, `Select`, `NumberInput` | ขยาย globals.css/variables เดิม; adapter คงค่าที่ handlers เดิมรับ ห้ามสร้างสี/ขนาดซ้ำตามหน้า |
| 1 | `formatThaiDate`, `formatThaiMonth`, `formatThaiTime`, `formatThaiNumber`, `formatFiscalYear`; `ThaiDatePicker`, `ThaiMonthPicker`, `DateRangePicker`, `FiscalYearSelect` | ใช้ Intl และความสามารถของ DateField/todayISO/monthStartISO; เก็บค่า ISO; เวลาเวรรอคำตอบ |
| 1 | `PageHeader`, `FilterBar`, `StatusBadge`, `EmptyState`, `ErrorState`, `Skeleton`, `Legend`, `InfoPopover`/`InfoCallout` | รักษาชนิดสถานะที่มีจริง แยก presentation state จากค่าที่ส่งค้น |
| 1 | `DataTable`/`TableScroll`, `StickyActionBar`, `Toast`, `ConfirmDialog`, `Drawer`, `BottomSheet` | ทำ keyboard/aria/focus/sticky/overflow ที่ใช้ร่วม; confirm callbacks และ lifecycle ต้องคงพฤติกรรมที่อนุมัติ |
| 2 ✓ | `AppShell`, `ShellFrame`, `NavigationLinks`, `UserMenu`, `WorkspaceContext`; sidebar/rail/header/bottom nav และ shared Drawer/Dialog/Select | คง AuthProvider/auth/pending-count/logout/event เดิม; เพิ่มอ่านหอตามที่อนุญาต; ไม่เปลี่ยน routing |
| 2 ✓ | `Dashboard`, `TodayStatusCard`, `KpiCard`, `TrendCard`; ข่าวใน HomePage ใช้ shared Card/Dialog/Toast | อ่านรายงานรายวันเดิม; KPI เป็นการแสดงผล ระบุยอด PT และเวรล่าสุดชัดเจน; ไม่ใส่เวลา/ผู้ยืนยัน/ปักหมุดที่บริการไม่มี |
| 3a ✓ | `EntryContextBar`, `EntryLayout`, `EntrySection`, `EntryFieldRow`, `EntryFlowSummary`, `EntryFocusControls`; shared ShiftSelector เพิ่ม native required mode | จัดแถบบริบท/กริด/การ์ด/accordion ด้วย values และ handlers เดิม; คง input ชุดเดียว ไม่แก้ส่วนสร้างข้อมูลส่ง |
| 3b ✓ | `useEntryEditing`, `EntryReview`, `EntryDraftNotice`, `EntrySaveSummary`, helper `entry-workspace.mjs`; shared ConfirmDialog/Toast | Keyboard/ค่าค้าง/guard/ยอดและคำเตือนฝั่งหน้าจอ; คง body/version/previous_readmission และปุ่มเปิดเดิม ไม่มี auto-load ใหม่ |
| 4 ✓ | `HistoryResults`, `HistoryEntryDialog`, `HistoryActionDialog`, helper `history-view.mjs`; shared FilterBar/DateRangePicker/DataTable/StatusBadge/Toast | ตาราง/การ์ดและกลุ่มวันชุดเดียวกัน; ลิงก์ฟอร์มเดิม; ชิปเฉพาะหน้าและ pagination 51/50; ไม่มี bulk confirmation |
| 5 ✓ | `PressureIndicatorCard`, `ReadmissionIndicatorCard`, `monthlyFieldLabels`/`indicator-view.mjs` | ใช้ primitives กลาง แยกสถานะโหลดที่อนุญาตแล้ว; ใช้ label เดียวกับ monthly section โดยไม่รวม write handler ของสองหน้า |
| 6 ✓ | `ReportViewer`, `ReportTable`, `OccupancyReport`, `OccupancyCell`, `OccupancyWardCard`, `CompletenessLegend`, `DailyReportOverview`, `PrintHeader`, `ReportPrint`, `report-view.mjs` | หัว/ปุ่ม/FilterBar ใน Viewer; คง catalog และพารามิเตอร์ search แยก formatting; XML เดิมตาม Q09; InfoPopover เพิ่ม trigger ทางเลือกโดยค่าเดิมคงเดิม |

## จุดเสี่ยงที่อาจกระทบ logic

| จุดเสี่ยง | สิ่งที่ต้องคงไว้/เงื่อนไขหยุดถาม |
| --- | --- |
| สิทธิ์ | ห้ามตีความ HN เป็น role หรือจำกัดผู้ยืนยันใหม่; ระบบใช้ `can_write`/`is_admin`; เปลี่ยนกฎต้องเป็นงานที่อนุญาตแยก |
| เลือกหอ/วัน/เวรและ auto-load | เฟส 3b มี guard/ค่าค้างตามที่อนุญาตแล้ว แต่ไม่เพิ่ม auto-load; เปลี่ยนจังหวะคำขอของหน้าอื่นยังต้องกำหนด Q10 และต้องไม่โหลดทับค่าค้าง |
| NumberInput | รักษา 0/ว่าง/null, min เตียง 1, required, จำนวนเต็มและค่าสูงสุด; input type=text ห้ามทำให้ browser validation เดิมหาย |
| ยกยอด/ยอดรวม | closing_count ต่างจาก patientDays (+A&D); ยกยอดล่าสุดไม่รับประกันเป็นเวรก่อนหน้า; ไม่แก้สูตรหรือแหล่งเตียงให้ตรงคำใน spec เอง |
| เฉพาะเวรบ่าย | ใช้ legacy_shift_id ไม่ใช่ primary key; สาขา/แผลกดทับส่งได้เฉพาะบ่าย; ซ่อน section ต้องไม่ล้างข้อมูล |
| รายเดือนร่วม | คู่หอ/วันแรกเดือนและ previous_readmission/version ต้องคง; แก้เวรหนึ่งอาจกระทบทุกเวรในเดือน |
| แผลกดทับ/loadedKey | เฟส 5 อนุญาตแยก key หอ/วันกับหอ/เดือนแล้ว GET ตรวจเวรบ่ายก่อนเปิดบันทึก; backend ยังตัดสินสถานะจริงตอน PUT ป้องกันข้อมูลเก่า/โหลดล้มเหลว/กดซ้ำและแสดง 409 โดยไม่ข้ามกฎ |
| ยืนยัน/ส่งกลับ | expected_version, reason, state transition, CSRF และ event ตัวนับต้องคง; ไม่มี offline queue/bulk endpoint |
| Draft ในเครื่อง | เฟส 3b แยกบัญชี/หอ/วัน/เวร/รายการ/version และ snapshot ต้นฉบับรวมรายเดือนแล้ว; ล้างหลังสำเร็จ ไม่เก็บ session/CSRF และไม่คืนค่าเก่าทับข้อมูลใหม่อัตโนมัติ |
| Status/ตัวนับ/paging | ไม่มีรายการไม่ใช่ persisted status; 50 แถวไม่ใช่จำนวนรวม; badge เป็นยอดทุกช่วงวันตามสิทธิ์ ไม่เปลี่ยนช่วงเป็นวันนี้ |
| วัน/ปีงบประมาณ | ISO/date-only/Asia Bangkok และ fiscal ต.ค.–ก.ย.; ส่งปี ค.ศ. แสดง พ.ศ.; อย่าแปลง พ.ศ. ซ้ำหรือ parse ISO ด้วย timezone จนเลื่อนวัน |
| รายงาน | คง 15 ชนิด/census เฉพาะ admin/complete/null/ตัวหารที่ยกเว้นตาม backend; KPI รายวันแสดงจาก GET ที่อนุญาตแล้ว ไม่ใช้แถวรวมมารวมซ้ำ และไม่คาดเดาลำดับเวรที่ขาด |
| ส่งออก | ผู้ใช้เลือกคง XML `.xml` ในเฟส 6 แล้ว ชื่อไฟล์ พ.ศ. และแปลงเฉพาะตำแหน่งวันที่/หัวคอลัมน์ คงตัวเลข Number เดิม ไม่ใส่ค่าร้อยละที่ยังไม่ complete |
| คำอธิบายผู้ส่ง/เวลา | created_at/updated_at ไม่ใช่เวลา confirmed; user ปัจจุบันไม่ใช่ผู้บันทึก/ผู้โพสต์จริง; ห้ามสมมติจาก DB ที่ข้อมูลตอบกลับไม่มี |
| Query/route/auth | คง deep link/history query/ปลายทาง login/logout/rewrite; sync filters ต้องตกลงโดยไม่แก้ route หรือชื่อพารามิเตอร์ |
| Dependency/tooling | อย่าเพิ่ม Tailwind, lucide, XLSX, ESLint หรือ TypeScript ก่อนการตัดสินใจ Q09/Q15 |

## คำถามถึงเจ้าของงานที่ยังค้าง

คำตอบใหม่: ผู้ใช้สั่งถึงเฟส 6 ตามแผนชุดหลัง เฟส 6 อนุญาต initial GET และ GET รายวันเพื่อยอด/ความครบถ้วน เลือก Excel XML และให้ชื่อโรงพยาบาลแล้ว เกณฑ์สี Q07 ยังไม่ยืนยันจึงใช้สีกลาง ไม่อนุมานว่าช่วงเวร สิทธิ์ใหม่ หรือสูตรชั่วคราวได้รับการอนุมัติไปด้วย

การใช้ข้อมูลในเฟส 2: คงสิทธิ์เดิม ไม่ตั้งชื่อบทบาทพยาบาล/หัวหน้าหอเอง; ใช้ชื่อเวรที่บริการส่งและวันกรุงเทพฯ โดยไม่แสดงชั่วโมง/เลยกำหนด; ไม่มีผู้ยืนยัน/เวลายืนยัน/ผู้โพสต์/ปักหมุดสมมติ โปรไฟล์แสดงข้อมูลบัญชีใน dialog เท่านั้น ตัวเลือกหอจำเป็นค่าเริ่มต้นตอนเปิดหน้าบันทึก/ตัวชี้วัด ไม่เปลี่ยนค่าของฟอร์มที่เปิดค้างอยู่ รายละเอียดการตัดสินใจและข้อจำกัดอยู่ใน `ui-phase-2.md`

| รหัส/ก่อนเฟส | คำถามและเหตุผลที่ต้องยืนยัน |
| --- | --- |
| **Q01 · 1** | ยืนยันให้ส่วน A–E และแผน 0–7 ชุดหลังเป็นหลักเมื่อขัดกับชุดแรกหรือไม่? ตัวอย่างชุดแรกให้ทำ shell ในเฟส 1 แต่ชุดหลังเป็นเฟส 2 และ max-width มีทั้ง 1440/1600px เสนอใช้ชุดหลังและ page templates A4 |
| **Q02 · 2–4** | ต้องการคงสิทธิ์ปัจจุบันที่ผู้บันทึกหอยืนยันเองได้ หรือกำหนดให้หัวหน้าหอยืนยันเท่านั้น? หากต้องแยกสิทธิ์ ต้องแยกงาน backend/สิทธิ์ออกจาก UX ก่อน และต้องยืนยันชื่อแสดงของ `system_admin`/`ward_recorder`/`report_reader`/`auditor` เพราะไม่มี role หัวหน้าหอในโค้ด |
| **Q03 · 2–3** | เวลาเริ่ม/สิ้นสุดที่ใช้งานจริงของสามเวรตรงข้อเสนอ 08–16, 16–24, 00–08 หรือไม่ และ `service_date` ของเวรดึก/เวรข้ามเที่ยงคืนนับตามวันใด? seed ยืนยันเพียงชื่อ/รหัส ไม่ยืนยันชั่วโมง |
| **Q04 · 2** | ตัดรอบบันทึก/ยืนยันเวลาใดต่อเวร มีผ่อนผัน วันหยุด หรือการกรอกย้อนหลังอย่างไร และคำว่า “ส่งแล้ว” หมายถึงบันทึกสำเร็จหรือยืนยันแล้ว? ยังไม่มีกฎเลยกำหนด จึงยังเลือกสีแดงหรือใส่เวลา 10:00 น. ไม่ได้ |
| **Q05 · 1/3** | ยืนยันคำขยาย PT/NB/HN/RN/TN/PN/AID ตามข้อเสนอใน spec และขอเกณฑ์ประเภทผู้ป่วย 1–5 กับคำไทยของ 13 สาขาที่ต้องแสดงในคำอธิบาย โค้ดมีเพียงรหัส ห้ามแต่งเกณฑ์ทางการพยาบาลเอง |
| **Q06 · ตอบแล้วเฟส 5** | ผู้ใช้ยืนยันว่า `discharge_count` เป็นยอดจำหน่ายเดือนก่อนเดือนรายงานที่เลือก ใช้ `monthlyFieldLabels` แสดงเดือนจริงตรงกันทั้งสองหน้า เก็บ reporting_month เป็นเดือนรายงานวันแรกตามเดิม |
| **Q07 · ยังรอยืนยัน** | ผู้ใช้ตอบชื่อโรงพยาบาลแต่ยังไม่ยืนยันเกณฑ์ <60, 60–<85, 85–100, >100 จึงใช้สีกลาง แสดง complete/null/จำนวนเวรที่ขาดตามเดิม และแจ้งสูตรชั่วคราว `legacy_monthly_temporary_v1` โดยไม่แก้สูตร/ตัวหาร |
| **Q08 · ตอบแล้วเฟส 6** | ผู้ใช้ให้ชื่อ “โรงพยาบาลอากาศอำนวย” / Akat Amnuai Hospital และลิงก์เว็บไซต์ ใช้ชื่อไทยที่ผู้ใช้ให้บนหัวพิมพ์ ไม่เดาตราหรือหน่วยงานเพิ่ม |
| **Q09 · ตอบแล้วเฟส 6** | ผู้ใช้เลือก “คง Excel XML เดิม” ใช้นามสกุล .xml จริง เปลี่ยนชื่อไฟล์เป็นภาษาไทย/พ.ศ. โดยไม่เพิ่ม dependency และไม่เปลี่ยนเป็น .xlsx |
| **Q10 · ตกลงเฟส 2/4/5/6 แล้ว** | เฟส 6 อนุญาต initial GET รายงานและเพิ่ม GET `/reports/daily` สำหรับยอด/ความครบถ้วนแล้ว คงพารามิเตอร์เดิมทั้ง 15 แบบ การเปลี่ยนตัวกรองทั่วไปยังต้องกดแสดงรายงาน และคงสอง route |
| **Q11 · 2–6** | ข้อมูลที่บริการยังไม่ส่ง เช่น ชื่อผู้บันทึก/ผู้ยืนยัน/ผู้โพสต์ เวลายืนยัน metadata ตัวชี้วัด ปักหมุด/สำคัญ และข้อมูล Dashboard ที่ยังไม่โหลด ต้องการซ่อนจนมีข้อมูล หรือแสดง mock ที่ติดป้ายว่า “ข้อมูลตัวอย่าง” พร้อม `// TODO: เชื่อม API`? เสนอซ่อนในหน้าที่ใช้งานจริงและแยก mock สำหรับ preview; ห้ามนำบัญชีปัจจุบันหรือ updated_at มาอ้างแทน |
| **Q12 · อนุญาตในเฟส 3b แล้ว** | ทำ keyboard/เตือนก่อนออกและเปลี่ยนบริบท/เก็บค่าค้าง/ทางลัดหลังบันทึกตามคำสั่ง โดยคง validation/ข้อมูลส่ง/สถานะเดิม ไม่มี autosave เข้าบริการหรือ auto-load ใหม่ รายละเอียดและข้อจำกัดดู ui-phase-3b.md |
| **Q13 · ตกลงเฟส 3/5 แล้ว** | คงการยกยอด/เตียงเดิม เฟส 5 อนุญาต GET ตรวจเวรบ่ายและแยก loadedKey แล้ว ใช้ `/shifts?include_inactive=true` จับคู่ legacy 3 และ `/entry-form` ด้วย primary ID; คง PUT/ข้อมูลส่งและกฎ backend เดิม |
| **Q14 · 2** | ส่วนโปรไฟล์ให้เปิดข้อมูลที่มีใน dialog หรือมีหน้าปลายทางที่ยังไม่ได้ส่งมา? การเลือกหอใน header จะใช้ร่วม/จำข้ามหน้าอย่างไร? สถานะออนไลน์/กำลังซิงก์/ลองใหม่/เวลาซิงก์ล่าสุดให้อิงคำขอใด เพราะปัจจุบันไม่มีสถานะเครือข่ายส่วนกลาง และเวลาคำขอสำเร็จไม่เท่ากับเวลาข้อมูลซิงก์ทั้งหมด |
| **Q15 · 1** | เลือกฟอนต์ไทยใดและติดตั้งในเครือข่ายที่โหลดฟอนต์ได้หรือควรใช้ไฟล์ local? อนุญาต `lucide-react` ตาม spec หรือให้ใช้ inline SVG กลาง? สำหรับ checks อนุญาตงานเพิ่ม lint tooling และแนวทางตรวจ JavaScript/types แยกหรือไม่ เพราะไม่มี lint/TypeScript ใน package.json; ไม่เสนอเพิ่ม Tailwind/UI kit/date/table package โดยไม่มีความจำเป็น |
| **Q16 · ตรวจแล้วเฟส 7** | รวม `/login` ใน QA ตามคำสั่งตรวจทุกหน้าแล้ว พบ F01/F03/F04 ยังไม่ปรับโค้ดตามคำสั่งครั้งนี้ การแก้ login ภายหลังต้องคง auth/validation/ปลายทาง `/entries` เดิม |

## การตรวจและไฟล์ที่เปลี่ยนในเฟส 0

| รายการ | ผล |
| --- | --- |
| `npm run lint` | รันแล้ว ไม่ผ่านเพราะไม่มี script `lint` ใน package.json เดิม ไม่แก้ tooling นอก docs |
| `npx --no-install tsc --noEmit` | รันแล้ว รันตรวจไม่ได้เพราะไม่มี compiler/tsconfig; ไม่ติดตั้งแพ็กเกจ |
| `npm run build` | ผ่าน exit 0 ครบทุก route; ไม่เท่ากับ lint/typecheck หรือ QA ใน browser |
| ตรวจภาพ/ซอร์ส | ดูภาพครบ 6 ภาพ อ่าน route ทุกหน้าและ components/lib/CSS; เทียบกฎที่ 360/768/1024/1440px ในรายงาน |
| ทดสอบ UI จริง 360/768/1024/1440px | ยังไม่ได้ทำใน Audit — checklist อยู่ในเฟสของหน้าและเฟส 7 ห้ามรายงานว่า responsive ผ่านจากภาพเดสก์ท็อปเดิม |
| ตรวจ diff/hash | ตรวจเอกสารเทียบต้นฉบับและ SHA-256 นอก docs; ดูผลยืนยันสุดท้ายด้านล่าง |

ไฟล์ที่เปลี่ยน/เพิ่มโดย Audit:

- `docs/ui-spec.md` — เติมข้อเท็จจริงพร้อมแหล่งอ้างอิง เก็บค่าที่ไม่ทราบไว้เป็นคำถาม ไม่เปลี่ยนความต้องการส่วนอื่น
- `docs/ui-audit.md` — แผนที่ route/คำขอ ภาพ ฟิลด์ สิทธิ์ ไลบรารี ช่องว่าง และผลตรวจ
- `docs/ui-progress.md` — ไฟล์นี้: checklist ทุกเฟส components ความเสี่ยงและคำถาม
- `docs/screenshots/Screenshot 2026-11-19 105342.png`, `144348.png`, `144406.png`, `144415.png`, `144427.png`, `144441.png` (แต่ละไฟล์ใช้ชื่อเต็มนำหน้าเหมือนกัน) — สำเนาภาพเดิมเพื่ออ้างอิง ไม่ใช่ภาพทดสอบใหม่

ผลยืนยันสุดท้าย: เปรียบเทียบ SHA-256 กับ snapshot ก่อนเขียนเอกสารแล้ว ไฟล์เดิม 167 ไฟล์นอกเอกสาร spec ตรงกันทั้งหมด ไม่มีการเพิ่ม/ลบ/แก้โค้ด การตั้งค่า dependency หรือ AGENTS.md โดยงานนี้ ข้อยกเว้นใน snapshot คือ spec เดิมถูกย้ายจาก `new-system/ui-spec.md` มา `new-system/docs/ui-spec.md` ระหว่าง Audit ตามที่บันทึกไว้ในรายงาน งานนี้เพิ่ม/แก้เฉพาะเอกสาร 3 ไฟล์และสำเนาภาพ 6 ไฟล์ใต้ `new-system/docs/`; ตรวจลิงก์อ้างอิงในเอกสารครบและไม่พบลิงก์ไฟล์เสีย ข้อกำหนดหลังหัวข้อข้อมูลระบบใน spec คงเดิมทั้งหมด
