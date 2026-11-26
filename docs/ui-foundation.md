# เฟส 1: Foundation

พัฒนาและตรวจเมื่อ 19 พฤศจิกายน 2569 ตามหัวข้อ A/D/E ใน [ui-spec.md](ui-spec.md) ผู้ใช้อนุญาต route ใหม่เฉพาะ `/dev/ui-kit` และเฉพาะโหมดพัฒนา ยังไม่ทำ App Shell/หน้าแรกหรือเปลี่ยน flow ในเฟส 2–6

## เปิดตรวจ

รันจาก `new-system/frontend`:

```powershell
npm run dev
npm run test:ui
npm run build
```

เปิด [http://localhost:3000/dev/ui-kit](http://localhost:3000/dev/ui-kit) มี 8 หมวด: สีและตัวอักษร, ปุ่มและไอคอน, ช่องกรอก, วันที่และเวร, สถานะ, หัวหน้าจอ/ตัวกรอง, ตาราง, หน้าต่าง/แจ้งเตือน

`app/dev/ui-kit/page.js` เป็น server component ตรวจ `NODE_ENV === 'development'` ก่อนแสดงชุดตัวอย่าง มิฉะนั้น `notFound()` และตั้ง noindex; ไม่เพิ่มลิงก์เข้าหน้านี้ในเมนูใช้งานจริง ตรวจด้วย `next start` แล้วตอบ HTTP 404 ส่วน dev ตอบ 200

ข้อมูลใน UI kit เป็นชื่อและตัวเลขสมมติ พร้อม `// TODO: เชื่อม API`; การโต้ตอบไม่บันทึกลงบริการ ชุดตัวอย่างไม่เพิ่มคำขอข้อมูลเอง แต่ `AuthProvider` ที่ครอบ root อยู่เดิมยังตรวจ session ตามพฤติกรรมเดิม ไม่แก้เพื่อข้าม auth

## ไฟล์ที่เปลี่ยน/เพิ่ม

| ไฟล์ | สิ่งที่ทำ |
| --- | --- |
| [styles/tokens.css](../frontend/styles/tokens.css) | สี semantic, typography, spacing, radius, shadow, ขนาด controls/layout และ aliases CSS variables เดิม |
| [styles/foundation.css](../frontend/styles/foundation.css) | รูปแบบ shared components, responsive/container queries, focus, reduced motion และ safe area |
| [app/globals.css](../frontend/app/globals.css) | ใช้ไฟล์ tokens แทน root สีเดิม ปรับฟอนต์/ขนาดเนื้อหา/หัวข้อเป็น tokens; CSS เฉพาะหน้าเดิมยังเก็บไว้เพื่อย้ายทีละเฟส |
| [app/layout.js](../frontend/app/layout.js) | โหลด Sarabun 4 น้ำหนักผ่าน next/font/google และ foundation CSS; AuthProvider เดิมไม่เปลี่ยน |
| [lib/thai-date.mjs](../frontend/lib/thai-date.mjs) | util วันที่ date-only, พ.ศ./ค.ศ., ช่วงวัน, เวลา Asia/Bangkok, ตัวเลข และปีงบประมาณ |
| [components/ui/index.js](../frontend/components/ui/index.js) | จุด import shared components ทั้งชุด |
| [Icon.jsx](../frontend/components/ui/Icon.jsx) | ไอคอน SVG กลาง 17 สัญลักษณ์ มี decorative/labelled mode โดยไม่เพิ่ม dependency |
| [primitives.jsx](../frontend/components/ui/primitives.jsx) | Button, Card, FormField, TextInput, Select, NumberInput, StatusBadge, InfoCallout, EmptyState, ErrorState, Skeleton, Legend, InfoPopover, ShiftSelector |
| [dates.jsx](../frontend/components/ui/dates.jsx) | ThaiDatePicker, ThaiMonthPicker, DateRangePicker, FiscalYearSelect |
| [layout.jsx](../frontend/components/ui/layout.jsx) | PageHeader, FilterBar, DataTable, TableScroll, StickyActionBar |
| [overlays.jsx](../frontend/components/ui/overlays.jsx) | Dialog, ConfirmDialog, Drawer, BottomSheet, Toast |
| [app/dev/ui-kit/page.js](../frontend/app/dev/ui-kit/page.js), [ui-kit.jsx](../frontend/app/dev/ui-kit/ui-kit.jsx), [ui-kit.css](../frontend/app/dev/ui-kit/ui-kit.css) | route เฉพาะ dev, ตัวอย่าง components และสถานะ พร้อมปุ่มทดลอง |
| [tests/thai-date.test.mjs](../frontend/tests/thai-date.test.mjs) | เทสต์ Node built-in test runner ไม่ติดตั้งแพ็กเกจ |
| [package.json](../frontend/package.json) | เพิ่มเฉพาะ script `test:ui`; dependencies และ lockfile ไม่เปลี่ยน |
| [ui-progress.md](ui-progress.md), เอกสารนี้ และ `screenshots/phase-1/` | ผลงาน/คำถาม/วิธีตรวจและภาพ QA |

## สัญญาที่ต้องรักษาตอนนำไปใช้

Import ผ่าน `@/components/ui`; รูปแบบรับค่าไม่ได้เปลี่ยน handlers ของหน้าเดิมในเฟสนี้ ต้องทำ adapter เมื่อถึงเฟสของหน้า ห้ามเปลี่ยน payload หรือ validation เพื่อให้เข้ากับ component

| Component/util | สัญญาและขอบเขต |
| --- | --- |
| `Button` | `variant=primary/secondary/ghost/destructive`; default type=button ป้องกัน submit โดยเผลอ; submit ต้องระบุ type; loading ปิดการกดพร้อม aria-busy |
| `FormField` | ใช้ render function รับ id/required/aria-invalid/aria-describedby ที่ต้องส่งต่อถึง input; labels/help/errors ผูกกันโดย useId |
| `TextInput`, `Select` | `onChange` รับ DOM event ตาม native input/select; Select ใช้ options `{value,label,disabled}`; readOnly เป็นข้อความแสดงค่าที่เลือก |
| `NumberInput` | controlled; `onChange(rawString,event)` ไม่แปลงค่าว่างเป็น 0; รับ digits, รองรับ min/max/required และ custom validity; type=text + inputMode=numeric; เลือกข้อความเมื่อ focus; ไม่ตอบสนอง wheel แบบ number input |
| `ThaiDatePicker` | value และ onChange เป็น Gregorian ISO `YYYY-MM-DD` หรือ `''`; ตัวอักษรที่กำลังพิมพ์อยู่ภายใน component ยังไม่ส่งต่อจนแปลงเป็นวันที่ที่ถูกต้อง; พิมพ์ `วัน/เดือน/ปี` หรือ ISO ได้ ปี ≥2400 ถือเป็น พ.ศ.; ไม่ rollover วันที่ผิด; มีวันนี้/เมื่อวานและปฏิทิน พ.ศ. |
| `ThaiMonthPicker` | value/onChange เป็น `YYYY-MM` หรือ `''`; แสดงเดือน พ.ศ.; วันที่วันแรกของเดือนให้ผู้เรียกใช้ `monthStartISO` เมื่อต้องส่งตามสัญญาเดิม; ไม่ส่งคำขอเอง |
| `DateRangePicker` | `{from,to}` เป็น ISO; ปุ่ม 7 วันรวมวันสิ้นสุด/เดือนนี้/เดือนก่อน; เตือนช่วงกลับด้านเพื่อแสดงผล ไม่เรียกข้อมูลและไม่เปลี่ยนข้อจำกัดการบันทึกเดิม |
| `FiscalYearSelect` | value/onChange เป็นเลขปี พ.ศ.; label อธิบาย ต.ค.–ก.ย.; ใช้ `fiscalYearRange` เมื่อต้องใช้ ISO; ไม่ลบ 543 ซ้ำ |
| `ShiftSelector` | controlled value/options ตามรหัสจากผู้เรียก ไม่สมมติ primary key; แสดงเวลา/สถานะเมื่อ props มี; Arrow/Home/End และ roving tab index; ไม่กำหนดชั่วโมงเวรเอง |
| `StatusBadge` | presentation states: unrecorded/overdue/unconfirmed/confirmed/readonly และ fallback ไม่ทราบสถานะ; ห้ามนำ presentation states เพิ่มไปส่งเป็นสถานะค้นรายการจริง |
| `PageHeader` | breadcrumbs/title/description/actions; มือถือย้าย actions ไป disclosure; ไม่สร้าง/เปลี่ยน route ของผู้เรียก |
| `FilterBar` | controlled fields/handlers; URL syncing ต้องเลือก `syncToUrl` และส่ง `query` จึงใช้ replaceState โดยรักษา pathname/พารามิเตอร์อื่น; ค่าเริ่มต้นไม่ sync เพื่อไม่เปลี่ยน flow เดิม; มือถือใช้ BottomSheet |
| `DataTable` | columns/rows/summary; เรียงสำเนา rows ใน browser ไม่ mutate ข้อมูลต้นฉบับ; state loading/empty/error; mobile card/table toggle; sticky head/คอลัมน์แรก; ไม่คำนวณยอด/สูตรหรือเปลี่ยน paging ของบริการ |
| `TableScroll` | กรอบเลื่อนที่รับตารางเดิม มีชื่อและเข้าถึงด้วยคีย์บอร์ดได้ |
| `Dialog`, `ConfirmDialog`, `Drawer`, `BottomSheet` | controlled open/onClose; native dialog + focus trap/restore และ scroll lock; Esc/พื้นหลังปิดเมื่อไม่ busy; confirm ส่ง callback เท่านั้น ไม่ทำ write request |
| `InfoPopover` | native auto popover อยู่ top layer และไม่ล้นขอบจอ ปิดด้วย Esc/แตะภายนอก; ข้อมูลไม่สำคัญต่อการตัดสินใจต้องไม่ซ่อนอยู่เฉพาะที่นี่ |
| `Toast` | controlled open/onClose; live region คงอยู่ ใช้ polite/assertive ตาม tone; ให้ผู้เรียกกำหนดเวลาปิด ไม่บังคับ auto-dismiss |
| `StickyActionBar` | มี token `--bottom-nav-offset` เพื่อเว้น bottom nav ในเฟส 2/3; รองรับ safe area; ต้องตรวจซ้ำร่วมกับแป้นพิมพ์มือถือเมื่อใช้กับฟอร์มจริง |
| util ตัวเลข | null/undefined/empty/invalid เป็น `—`; ศูนย์เป็น `0`; ร้อยละรับตัวเลขร้อยละอยู่แล้ว (85 → 85.0%) ไม่ใช่เศษส่วน 0.85 |
| util วัน/เวลา | date-only ใช้ UTC ป้องกันเลื่อนวัน; วันนี้/เวลา timestamp ใช้ Asia/Bangkok; timestamp ต้องระบุเขตเวลา; input เวลา HH:mm ไม่ถือเป็นนิยามเวลาเวร |

ไลบรารีที่เพิ่ม: **ไม่มี** ใช้ React, Next.js, Intl, native dialog/popover และ node:test ที่มีอยู่ การเลือก SVG แทน lucide ช่วยไม่ต้องเพิ่ม dependency ระหว่างที่ Q15 ยังไม่ได้ตกลง หากต้องการ lucide โดยเฉพาะให้ตัดสินใจก่อนเปลี่ยนชุดไอคอนกลาง

## สถานะที่ตรวจได้ใน UI kit

- ปุ่มทั้ง 4 แบบ: ปกติ/hover/focus (ตัวอย่างค้างสถานะ)/disabled/loading และ icon-only ที่มีชื่อ
- ข้อความ/select/number: ปกติ/ค่าว่าง/required/error/disabled/readOnly; มี FormField แบบ textarea และ option ที่ปิดใช้
- วันที่/เดือน/ช่วงวัน/ปีงบประมาณ: เลือกค่า/error/disabled/readOnly และสถานะเพิ่มเติมที่เปิดดูได้; ปฏิทิน/ตัวเลือกเดือนเปิดทดลองได้
- เวร: selected/unselected/disabled และป้ายสถานะ; ไม่มีการใส่ชั่วโมงเวรที่ยังไม่ยืนยัน
- StatusBadge ทุกค่าและ fallback, InfoCallout 5 สี, skeleton, empty/error/retrying, Legend และ InfoPopover
- หัวหน้าและตัวกรองทั้งจอใหญ่/มือถือ, chips/ล้างตัวกรอง/loading; ตัวอย่าง sync query ใช้ชื่อ sampleWard/sampleStatus เฉพาะ route นี้
- ตารางมีข้อมูล/แถวรวม/เรียงลำดับ/มุมมองการ์ด/loading/empty/error และ TableScroll
- Dialog ปกติ/ยืนยัน/แบบระวัง/กำลังทำงาน, Drawer, BottomSheet และ Toast success/warning/danger/info/ปิดได้
- StickyActionBar เลือกโหมดข้อมูลค้าง/กำลังบันทึก/อ่านอย่างเดียว/บันทึกแล้วได้

## ผลตรวจ

### คำสั่ง

| รายการ | ผล |
| --- | --- |
| `npm run test:ui` | ผ่าน 9 กรณี ครอบคลุม พ.ศ./ค.ศ./เลขไทย, invalid/leap dates, Bangkok midnight/New Year, ช่วงเดือน/ปี, formatter, date-only ใน 3 timezone, เวลา, ปีงบประมาณ และตัวเลข |
| `npm run build` | ผ่าน; route เดิมครบและเพิ่มเฉพาะ `/dev/ui-kit` |
| `npm run lint` | ยังไม่มี script lint จากโค้ดเดิม จึงไม่มีผล lint ให้รับรอง ไม่เพิ่ม ESLint/dependency นอกคำสั่ง |
| `npx --no-install tsc --noEmit` | ไม่มี TypeScript compiler และ tsconfig เดิม จึงรัน typecheck ไม่ได้ ไม่ดาวน์โหลดแพ็กเกจมาทดแทน |
| dev/production | HTTP 200 ใน dev, HTTP 404 ใน next start; production ไม่แสดง markup UI kit |
| ขอบเขต source | เปลี่ยนไฟล์เดิมเฉพาะ globals.css, layout.js (font/CSS), package.json (test script), ui-progress.md; endpoint/handlers/page routes เดิม/backend/models/dependencies/lockfile ไม่เปลี่ยน |

### Responsive และ accessibility ของ `/dev/ui-kit`

ตรวจจริงบน Microsoft Edge และดูภาพทั้ง 4 ขนาด ไม่ใช่อ้างผลจาก CSS อย่างเดียว:

| Viewport | client width / scroll width | ผลและหลักฐาน |
| --- | --- | --- |
| 360 × 900 | 345 / 345 | ไม่ล้นหน้า; controls 1 คอลัมน์, menu actions ย่อ, ตัวกรอง bottom sheet, ตารางเป็นการ์ดหรือเลื่อนในกรอบ — [ภาพ](screenshots/phase-1/ui-kit-360.jpg) |
| 768 × 900 | 753 / 753 | ไม่ล้นหน้า; พื้นที่ตัวอย่าง 2 คอลัมน์และตัวกรองแบบแถว — [ภาพ](screenshots/phase-1/ui-kit-768.jpg) |
| 1024 × 900 | 1009 / 1009 | ไม่ล้นหน้า; cards/controls/table อยู่ในพื้นที่ใช้งาน — [ภาพ](screenshots/phase-1/ui-kit-1024.jpg) |
| 1440 × 900 | 1425 / 1425 | ไม่ล้นหน้า; ตัวอย่างและคอลัมน์กว้างขึ้นตามพื้นที่ — [ภาพ](screenshots/phase-1/ui-kit-1440.jpg) |

ส่วนต่าง 15px เป็น scrollbar แนวตั้ง ไม่ใช่ page overflow

- Font โหลดสำเร็จเป็น Sarabun; input ที่มองเห็น 16px; controls ที่ตรวจสูงอย่างน้อย 44px; ปฏิทินที่ 360 × 800 มีช่องวัน 44 × ประมาณ 46px
- ตรวจ modal ที่ 360 × 800: scroll lock, Tab/Shift+Tab วน, Esc ปิดและคืน focus, แตะพื้นหลังปิด; Drawer เลือกเมนูแล้วปิด — [หน้าต่าง](screenshots/phase-1/dialog-360.jpg)
- ทดสอบกรอก พ.ศ. วัน leap และเดือนที่เลือก, ส่งค่าต่อในตัวอย่างเป็น ISO/เดือนเดิม; ไม่มีการส่งข้อมูลจริง
- ทดสอบตัวกรองมือถือ sync query แล้วปิด sheet; เรียงจำนวนในตารางด้วย Enter ได้ 7 → 12 → 18; แถวรวมเดิมคงอยู่; sticky header และกรอบ overflow ทำงาน
- InfoPopover ที่ 360 × 800 อยู่ในจอ กด Esc ปิดแล้วคืน focus — [ภาพ](screenshots/phase-1/popover-360.jpg)
- Contrast จาก tokens: ตัวอักษรหลัก/ขาว 13.29:1, ข้อความรอง/พื้นหลัง 5.23:1, primary/ขาว 6.15:1, สี semantic/พื้นหลังคู่กันอย่างต่ำ 5.61:1, ขอบ control/ขาว 3.50:1
- reduced motion มี CSS ปิด animation; label/error เชื่อมด้วย id/aria-describedby; icon-only มี aria-label; notification มี aria-live

ยังไม่ได้รับรอง Lighthouse ≥95 ทั้งระบบ/zoom 200%/เครื่องมือถือจริง/virtual keyboard หรือ flow บันทึกจริง เป็นการตรวจในเฟสของหน้านั้นและเฟส 7 ไม่อ้างว่าหน้าเดิมผ่าน responsive แล้ว

Edge ที่ใช้ตรวจมี extension เพิ่ม attribute ลง body ทำให้ Next แสดง hydration warning ของ attribute ดังกล่าว ไม่เพิ่ม suppressHydrationWarning เพื่อกลบปัญหาแวดล้อม การจัดรูปแบบวันใน util ใช้ locale/timezone ชัดเจนและมีเทสต์แยก

## เรื่องที่ยังต้องตัดสินใจก่อนเฟสถัดไป

ดู Q02–Q16 ใน `ui-progress.md` โดยเฉพาะสิทธิ์ยืนยัน เวลาเวร/ตัดรอบ นิยาม KPI และการเพิ่มคำขอข้อมูล ฟอนต์ Sarabun/ชุด SVG ที่เลือกในเฟสนี้ปรับความชอบได้หลังตรวจ UI kit; ยังไม่ถือว่าคำถามทางงานได้รับคำตอบ และไม่เพิ่มผู้โพสต์ เวลาเวร หรือสูตรคำนวณจากการคาดเดา
