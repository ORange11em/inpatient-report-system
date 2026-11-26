# เฟส 2 — ปรับขนาดตัวอักษรทั้งระบบ

20 พฤศจิกายน 2569 · เฟส 2 ของงานย้ายระบบ/ตรวจรับ ไม่ใช่เฟส App Shell ของแผน UX/UI เดิม

**เสร็จตามเกณฑ์เฟสนี้** เพิ่มตัวควบคุมกลางที่ 100%, 112.5%, 125% ครบหน้าเข้าสู่ระบบและหน้าหลังเข้าใช้ จำค่าในอุปกรณ์ และขยายตัวอักษรจริงโดยคงงานพิมพ์/Excelเดิม รอบนี้แก้เฉพาะ presentation layer ไม่เปลี่ยนบริการ สูตร ข้อมูลส่ง สิทธิ์ routing หรือ data model

## ของเดิม → ของใหม่ → หลักฐาน

| เรื่อง | ของเดิม / ก่อนเฟสนี้ | ของใหม่ | กรณีพิสูจน์รอบนี้ |
|---|---|---|---|
| ปรับขนาดกลาง | เมนู/ส่วนหัว/login ของPHPที่ตรวจไม่มีตัวควบคุมกลาง; `inpatient/css/mycss.css`กำหนด80%และpxหลายขนาด ของใหม่ก่อนเฟสนี้มีtokensแต่ไม่มีปุ่มปรับ | `TextSizeControl`ชุดเดียวในroot layout อยู่ก่อนส่วนเข้าใช้ จึงไม่ผูกกับสถานะล็อกอิน; วางแถบด้านบนในลำดับหน้า ไม่ลอยทับปุ่มบันทึก | เปิด/loginและอีก6หน้าที่4ความกว้างทั้ง100/125%; ภาพ56ภาพและmeasurements.json |
| ระดับและการเข้าถึง | ไม่มีความสามารถนี้ในflowที่ตรวจ เป็นUIเพิ่มตามคำสั่งผู้ใช้ | ปุ่มลด/เพิ่มและขนาดปกติ แสดงระดับปัจจุบัน ต่ำสุดปิดปุ่มลด สูงสุดปิดปุ่มเพิ่ม; ใช้shared Button ชื่อไทย โฟกัสจากfoundation และstatus live region | Tab, Enter, Space, disabled, aria-live, กลับ100 และ112.5%วัดinput18px |
| ขนาดตัวอักษรจริง | tokensเป็นrem แต่globalsยังมีfont-sizeแบบpx รวมlogin/ปุ่ม/label; หัวเรื่องใช้clampแยก | tokensคูณ`--text-scale`; ย้ายขนาดpxของข้อความบนจอไปtokens รวมclampหัวเรื่อง/KPI โดยไม่เปลี่ยนroot font-sizeหรือระยะห่าง | ช่องกรอก16→20px ตาราง14→17.5px เมนู14→17.5px หัวข้อขยาย25%ครบจุดที่วัด |
| จำค่า | ไม่มีค่าขนาดข้อความ | localStorageคีย์`inpatient-text-size` เฉพาะค่าที่รองรับ; ค่าผิด/อ่านไม่ได้ใช้100; storageใช้ไม่ได้ยังปรับในหน้าปัจจุบันได้ | 112.5/125ข้ามหน้าโดยกดเมนูและreload; ค่าผิด5แบบ; จำลองstorageใช้ไม่ได้ |
| แจ้งเตือนกับปุ่มบันทึก | QAเดิมพบToastบังปุ่มมือถือ เพราะoffsetใช้ความสูงคงที่ | ส่งความสูงแถบปุ่มจากResizeObserverเดิมไปCSSของหน้าฟอร์ม แล้ววางToastเหนือแถบตามความสูงจริง รวมโหมดกรอกเต็มจอ | 360pxทั้ง100/125บันทึกผ่าน ขอบล่างToastอยู่เหนือแถบปุ่ม24px และhit-testปุ่มผ่าน |
| พิมพ์และExcel | มีprint stylesheet/Excel XMLเดิม | printบังคับscale1และซ่อนตัวควบคุม; ไม่แตะReportViewer, ReportTables, report-view หรือการสร้างXML | ทั้ง15ชนิดเปรียบเทียบ100กับ125: font/line-height/padding/font-weight/กว้าง/สูงขององค์ประกอบพิมพ์เท่ากัน; ชื่อไฟล์และXMLเหมือนกันทุกไบต์ |

หลักฐานต้นทางอ่านอย่างเดียว: [เมนูPHP](../../inpatient/menu.php), [ส่วนหัวPHP](../../inpatient/header.php), [loginPHP](../../inpatient/login.php), [CSSเดิม](../../inpatient/css/mycss.css) ไม่เปลี่ยนวิธีพิมพ์/ส่งออกหรือแก้สูตรเพื่อทำงานขนาดตัวอักษรนี้

## ผลresponsiveและขนาดที่วัดจริง

EdgeบนWindows ทดสอบด้วยข้อมูลสมมติและดักทุกคำขอบริการ ไม่อ่าน/เขียนข้อมูลผู้ป่วยหรือฐานใช้งานจริง

| หน้า | 360px | 768px | 1024px | 1440px |
|---|---|---|---|---|
| `/login` | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |
| `/` | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |
| `/entries` (เปิดรายการเวรบ่ายสมมติ) | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |
| `/history` (ค้นแล้วมีรายการ) | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |
| `/indicators` | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |
| `/reports` | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |
| `/occupancy` | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 | ผ่าน100/125 |

“ผ่าน”ในตารางนี้หมายถึงไม่ล้นทั้งหน้า ตัวควบคุมอยู่ในความกว้างหน้าจอ และข้อความที่ตรวจวัดขยายตามระดับ ไม่ใช่ผลรับรองทุกฟังก์ชันของระบบ รายงานบนมือถือเริ่มมุมมองการ์ดตามเดิม และตรวจสลับตารางครองเตียงที่360px/125%เพิ่มแล้ว เลื่อนภายในกรอบได้โดยหน้าไม่ล้น

| ตัวอย่าง | 100% | 112.5% | 125% |
|---|---:|---:|---:|
| inputหน้าlogin | 16px | 18px | 20px |
| inputตัวเลขPTในentries ที่360/1440px | 16px | ไม่ได้วัดแยก | 20px |
| ตัวเลขตารางreports/occupancy ที่1440px | 14px | ไม่ได้วัดแยก | 17.5px |
| เมนูที่360/1440px | 14px | ไม่ได้วัดแยก | 17.5px |
| หัวข้อentries ที่360px | 24px | ไม่ได้วัดแยก | 30px |
| labelหน้าlogin | 13px | ไม่ได้วัดแยก | 16.25px |
| ข้อผิดพลาดloginและinputกล่องเพิ่มข่าว | 16px | ไม่ได้วัดแยก | 20px |

ที่360px/125% ปุ่มบันทึกอยู่ช่วงy=785–836ในviewportสูง1000pxและกดได้ Toastจบที่637.375 แถบปุ่มเริ่ม661.375 จึงไม่ทับกัน ที่100%ปุ่มอยู่y=798.21875–842.609375และhit-testผ่านเช่นกัน

## Browser zoom 200% จริง

ใช้Windows computer-useส่งปุ่มซูมของEdgeในหน้าต่างทดสอบแยก เห็นค่า **ซูม:200%** ในUIเบราว์เซอร์จริง ขณะตั้งขนาดข้อความในระบบ125% ไม่ใช้CSS zoomหรือpinchแทน:

- หน้า`/entries` ก่อนซูม: innerWidth1416, devicePixelRatio1, visualViewport.scale1
- หลังซูม: innerWidth708, devicePixelRatio2, visualViewport.scale1; document clientWidth/scrollWidthเท่ากัน700px (ส่วนต่างจากinnerWidthคือscrollbar)
- กดบันทึกผ่านคำขอเดิมที่ดักด้วยบริการจำลองได้ ไม่พบpage errorหรือคำขอบริการหลุดไปฐานจริง
- [ผลวัดซูม](screenshots/parity-phase-2/zoom-result.json) และ [ภาพหน้าเมื่อซูม200%](screenshots/parity-phase-2/entries-browser-zoom-200.png)

## ชุดทดสอบและขอบเขตที่พิสูจน์

| การตรวจรอบนี้ | ผล |
|---|---|
| Browser `text-size.cjs` | ผ่าน8กลุ่ม: responsive56กรณี, ระดับ/keyboard/persistence/fallback, alert, save/Toast, dialog, พิมพ์/Excel15ชนิด, ตารางมือถือ, storageใช้ไม่ได้ |
| Browser `text-size.cjs --zoom` | ผ่านzoom200%จริงบนentriesที่ระดับ125%; กดบันทึกสำเร็จ |
| Browser `entry-editing.cjs` | ผ่าน20กลุ่ม ครอบคลุมกรอกด้วยkeyboard, ค่าค้าง/guard, ข้อมูลชนกัน, สิทธิ์อ่านอย่างเดียว, ตัวชี้วัดและคำขอเดิม |
| `npm run test:ui` | ผ่าน35/35 |
| backend `.venv/Scripts/python.exe -m unittest discover -s tests` | ผ่าน17/17 |
| `npm run build` | ผ่าน |
| `npm run lint` | รันตรวจไม่ได้ ไม่มีscriptlintในpackage.jsonเดิม |
| `npx --no-install tsc --noEmit` | รันตรวจไม่ได้ ไม่มีcompilerของโครงการและnpxยกเลิก ไม่ติดตั้งเพิ่ม; ข้อความRunning TypeScriptของNextไม่ใช่ผลตรวจชนิดข้อมูลแยก |

ผลทั้งหมดในตารางเป็นการรันเฟสนี้ ไม่ยกผลเฟส7เดิมมาทดแทน พิมพ์ตรวจด้วยprint mediaในเบราว์เซอร์และเปรียบเทียบรูปแบบ/ขนาดของDOM ไม่ได้พิมพ์กระดาษหรือเปิดโปรแกรมExcelจริง ไม่รันPHP/MySQL/PostgreSQLหรือรับรองสูตรรายงานในเฟสนี้ การอ่านจริงด้วยNVDA/VoiceOverและsoft keyboardมือถือจริงยังไม่ได้ทำ

หลักฐานรวม: [result.json](screenshots/parity-phase-2/result.json), [ค่าที่วัด56กรณี](screenshots/parity-phase-2/measurements.json), [ตัวอย่างToast360px/125%](screenshots/parity-phase-2/entry-save-toast-360-125.png), [ตัวอย่างlogin360px/125%](screenshots/parity-phase-2/login-360-125.png), [ผลregressionการกรอก](screenshots/parity-phase-2/entry-regression/editing-qa.json)

## ไฟล์ที่แก้และวิธีรันซ้ำ

ตรวจdiffและSHA-256เทียบsnapshotก่อนเริ่ม497ไฟล์แล้ว: ไฟล์เดิม490ไฟล์ตรงเดิม เปลี่ยน7ไฟล์ตามรายการด้านล่าง ไม่มีลบไฟล์ ซอร์สinpatient/backend/AuthProvider/คำขอและตัวสร้างรายงาน/ส่งออกคงเดิมทั้งหมด Hookการกรอกต่างเพียงหนึ่งบรรทัดส่งความสูงแถบปุ่มให้CSS และprint blockเดิมในglobals.cssตรงทุกตัวอักษร ดู [ผลตรวจขอบเขต](screenshots/parity-phase-2/scope-check.json) ตรวจลิงก์เอกสารและจำนวนคอลัมน์ตารางผ่านด้วย

- `frontend/components/TextSizeControl.jsx` (ใหม่): ตัวควบคุมเดียวพร้อมค่าที่เก็บในอุปกรณ์และlive status
- `frontend/styles/text-size.css` (ใหม่): ระดับscale รูปแบบแถบ และprint reset
- `frontend/app/layout.js`: วางตัวควบคุมและนำเข้าstylesheetกลางก่อนAuthProvider
- `frontend/styles/tokens.css`: typography tokensที่ขยายได้ รวมขนาดเดิมของข้อความpxและหัวข้อclamp
- `frontend/app/globals.css`: แปลงเฉพาะขนาดข้อความบนจอเป็นtokens จำกัดtransitionปุ่มเฉพาะสี และให้คอลัมน์loginย่อได้ ขนาดpxที่เหลือเป็น8pxในprintเดิมโดยตั้งใจ
- `frontend/components/entries/useEntryEditing.js`, `frontend/styles/entries.css`: ส่งขนาดแถบปุ่มให้Toastและใช้ระยะตามความสูงจริง เปลี่ยนเฉพาะstyle measurement ไม่เปลี่ยนการบันทึก/ยกยอด/validation/คำขอ
- `frontend/tests/browser/text-size.cjs` (ใหม่), เอกสารนี้, `INPATIENT_PARITY_TH.md`, `docs/ui-progress.md` และหลักฐานใต้`screenshots/parity-phase-2/`

จากfrontend เปิดdev serverตามเดิม แล้วรันด้วยPlaywrightที่มีในเครื่อง ไม่เพิ่มdependencyให้โครงการ:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/Ult_Orange/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tests/browser/text-size.cjs
# สำหรับตรวจซูม: สคริปต์เปิดEdgeแยกและรอให้ตั้งbrowser zoom200%จริง
node tests/browser/text-size.cjs --zoom
```

พอร์ตเริ่มต้นคือ3000 เปลี่ยนด้วย`UI_BASE_URL`ได้ ผลเฟสนี้ไม่มีเรื่องต้องให้เจ้าของงานเลือกเพิ่มเติม ข้อจำกัดระบบเดิม/แหล่งข้อมูลที่ยังไม่มีให้ตรวจตามหลักฐานในเฟสที่เกี่ยวข้อง ไม่ใช้เป็นเหตุหยุดงานUIนี้
