# เฟส 5 — ตัวชี้วัดเสริม

19 พฤศจิกายน 2569 · ทำเฉพาะ `/indicators` และชื่อช่องรายเดือนที่ใช้ร่วมกับ `/entries` ไม่เริ่มเฟส 6–7

## ขอบเขตที่ยืนยัน

ผู้ใช้อนุญาตให้ปรับจังหวะ GET เดิมเป็นโหลดอัตโนมัติ แยกสถานะรายวัน/รายเดือน และเพิ่มการอ่านบริการเดิมเพื่อตรวจเวรบ่าย โดยคงคำขอบันทึกและข้อมูลส่ง ผู้ใช้ยืนยันว่า `discharge_count` เป็นยอดของเดือนก่อนเดือนรายงาน จึงเปลี่ยนคำว่า “เดือนก่อนหน้า” เป็นเดือนจริงผ่าน util กลาง เช่น รายงานพฤศจิกายน 2569 ใช้ยอดจำหน่ายตุลาคม 2569

คำตอบนี้แก้ Q06/Q10/Q13 เฉพาะเฟส 5 ไม่เปลี่ยนสูตร สิทธิ์ สถานะ backend หรือการโหลดรายงานเฟส 6 ส่วนชื่อผู้บันทึก/เวลาแก้ไขตัวชี้วัดที่บริการไม่ส่งยังไม่แสดง ไม่ใช้ผู้เข้าสู่ระบบหรือเวลาโหลดหน้าแทน

ภาพ [04-indicators.png](screenshots/04-indicators.png) ทำสำเนาจาก `Screenshot 2026-11-19 144415.png` ที่มีอยู่ เพราะไม่พบชื่อตามคำขอตอนเริ่ม เก็บต้นฉบับไว้ครบและตรวจ hash เท่ากัน

## สิ่งที่เปลี่ยน

- หัวหน้าและคำอธิบายไทย เลือกหอครั้งเดียวในเนื้อหาหน้า แต่ละการ์ดมีป้ายรายวัน/รายเดือนและเลือกช่วงของตัวเอง ใช้ foundation components/tokens ทุกส่วน
- การ์ดแผลกดทับใช้ ThaiDatePicker การ์ดการกลับมารักษาซ้ำใช้ ThaiMonthPicker แสดง พ.ศ. เก็บ ISO เดิม ขนาดต่ำกว่า 1024px เรียงลงมา ตั้งแต่ 1024px เคียงกันสองใบ ฟอร์มกว้างไม่เกิน 1040px
- ย้ายกฎสำคัญเข้าการ์ด ใช้คำอธิบายใต้ช่อง เหตุผลปุ่มที่กดไม่ได้ และสถานะโหลด/ผิดพลาด/ลองใหม่/ยังไม่มีข้อมูล/มีข้อมูล/บันทึกสำเร็จ
- รายวันใช้ key หอ+วัน รายเดือนใช้หอ+เดือน เปลี่ยนวันไม่โหลดรายเดือนหรือทิ้งค่าที่แก้ในรายเดือน และกลับกัน เปลี่ยนหอโหลดใหม่ทั้งคู่ คำตอบของบริบทเก่าที่กลับมาช้าไม่ทับข้อมูลใหม่
- ไม่เปิดปุ่มบันทึกก่อนอ่านสำเร็จ ไม่แสดงค่าเริ่มต้น 0 แทนข้อผิดพลาด เมื่ออ่านสำเร็จแต่ไม่พบรายการจึงแสดง 0 พร้อมข้อความ “ยังไม่มีข้อมูล” อย่างชัดเจน
- ตรวจเวรบ่ายด้วย legacy code 3 แล้วใช้ primary ID จริงอ่านสถานะ ยืนยันแล้วแผลกดทับอ่านอย่างเดียว ไม่มีเวรบ่ายมีเหตุผลพร้อมลิงก์เปิดฟอร์มหอ/วัน/เวรที่เลือก สิทธิ์รายเดือนยังแยกจากสถานะเวรตาม backend
- NumberInput เลือกทั้งช่องเมื่อ focus ไม่เปลี่ยนค่าจากล้อเมาส์ รับจำนวนเต็ม 0–2147483647 และไม่ส่งช่องว่าง ปุ่มบันทึกเต็มความกว้าง ไม่รับคำขอซ้ำระหว่างบันทึก
- เตือนก่อนทิ้งค่าที่ยังไม่บันทึกเมื่อเปลี่ยนบริบท/ลองใหม่/ออกจากหน้า รวม native beforeunload ไม่มีการเก็บค่ารายการตัวชี้วัดลงเครื่องหรือส่งอัตโนมัติ

## ชื่อช่องตรงกับหน้าประจำวัน

`monthlyFieldLabels(month)` ใน [indicator-view.mjs](../frontend/lib/indicator-view.mjs) เป็นแหล่งเดียวของชื่อทั้งสองช่อง หน้าประจำวันส่งเดือนของ `selection.service_date` หน้าตัวชี้วัดส่ง `reportMonth` หากเป็นเดือนเดียวกันจะได้ข้อความเดียวกัน รวมชื่อที่โปรแกรมอ่านหน้าจออ่าน

แก้ `/entries` เฉพาะ import/คำนวณ label เพื่อแสดงผล/ข้อความ label และ aria-label ไม่เปลี่ยนค่าหรือข้อมูลส่ง ส่วน `initialValues`, การสร้าง body และคำขอใน `save`, และ `confirmEntry` เทียบซอร์สกับก่อนเฟส 3b แล้วตรงกัน ดู [หลักฐาน](screenshots/phase-5/daily-protected-source.json)

## คำขออ่านและเขียน

| ส่วน | คงเดิม / เปลี่ยนตามที่อนุญาต |
| --- | --- |
| รายชื่อหอ | GET `/wards` และค่าเริ่มต้นจาก query/หอที่จำ/หอแรกตามเดิม |
| รายวัน | GET `/indicators/pressure/{ward}?date_from={date}&date_to={date}` เดิม โหลดอัตโนมัติเมื่อบริบทครบ |
| สถานะเวรบ่าย | GET `/shifts?include_inactive=true` และ `/entry-form?ward_id=…&service_date=…&shift_type_id=…` จากบริการเดิมตามที่อนุญาต ไม่มีการสร้าง/ยืนยันเวรจากหน้านี้ |
| รายเดือน | GET `/indicators/readmission/{ward}?month_from={month}-01&month_to={month}-01` เดิม โหลดแยกจากรายวัน |
| บันทึกแผลกดทับ | PUT `/indicators/pressure/{ward}/{date}` เดิม ส่งเฉพาะ `stage2_4_cases`, `at_risk_patient_days` เป็น Number พร้อม CSRF เดิม |
| บันทึกการกลับมารักษาซ้ำ | PUT `/indicators/readmission/{ward}/{month}-01` เดิม ส่งเฉพาะ `readmit_count`, `discharge_count` เป็น Number พร้อม CSRF เดิม ไม่เลื่อน key จัดเก็บไปเดือนก่อน |

จับคำขอจริงด้วยข้อมูลสมมติก่อนแก้และหลังแก้ พบทั้งสอง PUT ตรงกันทุกฟิลด์/ชนิดข้อมูล/URL/CSRF: [write-contract.json](screenshots/phase-5/write-contract.json) Backend ยังคงตัดสินสิทธิ์และล็อกเวรตอนบันทึก หากเวรถูกยืนยันจากอีกหน้าต่างหลังอ่านแล้ว 409 จะไม่ถูกข้าม หน้าแสดงข้อผิดพลาดและให้ตรวจสถานะใหม่

## ผลตรวจ

ใช้ Edge headless ดักบริการทั้งหมดก่อนเปิดหน้า ข้อมูลบัญชี/หอ/จำนวนเป็นตัวอย่าง ไม่อ่านหรือเขียนข้อมูลผู้ป่วยจริง และไม่เพิ่ม dependency

| ตรวจ | ผล |
| --- | --- |
| Unit `npm run test:ui` | 28/28 รวมเดือนก่อนข้ามปี/ก.พ./วันสิ้นเดือน, ค่าว่างกับศูนย์, เหตุผลล็อก |
| Browser `tests/browser/indicators.cjs` | 18 กลุ่ม: auto-load, แยก key/รักษาค่าค้าง, คำตอบช้า, keyboard/date validation, ยกเลิกเปลี่ยนเดือน, สิทธิ์, เวรยืนยัน/ไม่มีเวร, error/retry, loading/กดซ้ำ, 409/403, คำขอเดิม และชื่อช่องในฟอร์มจริง |
| Regression ฟอร์มเฟส 3b | 20 กลุ่มผ่าน อัปเดตเฉพาะ assertion หน้าเชื่อมตัวชี้วัดให้ใช้ picker พ.ศ./auto-load ตามเฟส 5 ไม่ลดการตรวจ keyboard/draft/guard/ข้อมูลส่ง |
| `npm run build` | ผ่าน ทุก route เดิมยังอยู่ |
| `npm run lint` | ตรวจไม่ได้: package.json เดิมไม่มี script lint |
| `npx --no-install tsc --noEmit` | ตรวจไม่ได้: ไม่มี TypeScript compiler/tsconfig เดิม ไม่ติดตั้งแพ็กเกจ |

ภาพและค่าตรวจจริง: [browser-checks.json](screenshots/phase-5/browser-checks.json), [regression](screenshots/phase-5/entry-regression/editing-qa.json)

| หน้า `/indicators` | Layout | Page scrollWidth / clientWidth | ช่องและปุ่ม |
| --- | --- | --- | --- |
| 360px | การ์ดซ้อน | 360 / 360 | สูง ≥44px, ฟอนต์ช่อง 16px |
| 768px | การ์ดซ้อน | 768 / 768 | สูง ≥44px, ฟอนต์ช่อง 16px |
| 1024px | สองคอลัมน์ | 1024 / 1024 | สูง ≥44px, ฟอนต์ช่อง 16px |
| 1440px | สองคอลัมน์ | 1440 / 1440 | สูง ≥44px, ฟอนต์ช่อง 16px |

ตรวจภาพ [360](screenshots/phase-5/indicators-360.png), [768](screenshots/phase-5/indicators-768.png), [1024](screenshots/phase-5/indicators-1024.png), [1440](screenshots/phase-5/indicators-1440.png), [ยืนยันแล้ว](screenshots/phase-5/confirmed-1440.png), [ไม่มีรายการ](screenshots/phase-5/empty-360.png), [โหลดผิดพลาด](screenshots/phase-5/daily-error-360.png) และฟอร์มประจำวันทั้งสี่ขนาดใน regression ไม่มี page overflow

## ขอบเขตไฟล์และสิ่งที่ค้าง

| ไฟล์ | การเปลี่ยน |
| --- | --- |
| `frontend/app/indicators/page.js` | ประกอบหน้า เปลี่ยนจังหวะอ่าน/สถานะที่ได้รับอนุญาต คงสอง PUT |
| `frontend/components/indicators/IndicatorCards.jsx` | สองการ์ดจาก foundation และเหตุผล/สถานะ |
| `frontend/styles/indicators.css` | Layout จาก tokens เฉพาะหน้านี้ |
| `frontend/lib/indicator-view.mjs` | ชื่อช่องรายเดือน/ตรวจค่าค้าง/เหตุผลล็อกเพื่อแสดงผล |
| `frontend/app/entries/page.js` | ชื่อช่องรายเดือนเท่านั้น ไม่แตะ handlers |
| `frontend/tests/indicator-view.test.mjs`, `tests/browser/indicators.cjs`, `tests/browser/entry-editing.cjs` | เทสต์ใหม่และปรับ assertion หน้าที่เชื่อม/ทางเลือกโฟลเดอร์ผลตรวจ |
| `docs/ui-spec.md`, `ui-progress.md`, `ui-phase-5.md`, `screenshots/` | บันทึกคำตอบ ขอบเขต และหลักฐาน |

ตรวจ snapshot SHA-256 ก่อนเริ่ม 275 ไฟล์: แก้ไฟล์เดิมเฉพาะ 3 ไฟล์ frontend ในตาราง และ 2 ไฟล์เอกสาร อีก 270 ไฟล์ตรงเดิม ไม่มีไฟล์ถูกลบ Backend, model, dependency, routes, auth, shell และ shared foundation ไม่เปลี่ยน เมื่อลองย้อนเฉพาะ import/label/aria-label ในหน้าประจำวัน hash ตรง baseline ทั้งไฟล์ ดู [scope-review.json](screenshots/phase-5/scope-review.json)

ไม่มีคำถามที่ต้องตัดสินใจเพิ่มเพื่อให้เฟส 5 ใช้งานได้ ยังไม่มี metadata ผู้บันทึก/เวลาโดยเฉพาะจากบริการจึงไม่แสดง มือถือจริง คีย์บอร์ด iOS/Android และ Lighthouse ทั้งระบบยังอยู่เฟส 7 รอเจ้าของงานตรวจรับก่อนเฟส 6
