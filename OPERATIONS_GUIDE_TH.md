# คู่มือเปิดระบบและเตรียมย้ายข้อมูล

คู่มือนี้ใช้สำหรับสภาพแวดล้อมพัฒนาในเครื่องเท่านั้น ปัจจุบันยังไม่มีการอนุมัติให้เชื่อมต่อ นำเข้า แก้ไข หรือตัดระบบไปยัง production

> **ข้อห้าม production:** ห้ามตั้ง `DATABASE_URL` ไปยังฐานข้อมูลจริง ห้ามใช้ tunnel/port forwarding ไปยังฐานข้อมูลจริง และห้ามเรียกคำสั่ง `--apply` กับ production จนกว่าจะได้รับคำสั่งโดยตรงจากผู้ใช้ให้ดำเนินการขั้นนั้น การตรวจว่า host เป็น `localhost` อย่างเดียวไม่พอ หาก localhost ถูก forward ไป production ก็ยังถือว่าเป็น production

## สถานะที่ตรวจพบ

ระบบใช้ Next.js, FastAPI และ PostgreSQL การทดสอบในฐานแยกผ่านทั้งการล็อกอิน บันทึก แก้ไข ยืนยัน ส่งกลับ และเปิดรายงาน ดูรายละเอียดใน [ผลตรวจเทียบกับ inpatient](INPATIENT_PARITY_TH.md)

หน้าใช้งานบนเครื่องนี้อยู่ที่ http://localhost:3000/entries โดย .env.development.local ของหน้าบ้านชี้ API รุ่นที่ตรวจแล้วไปยังพอร์ต 18763 เมื่อเปิด backend ใหม่ในเครื่องนี้ให้ใช้พอร์ต 18763 หรือปรับ INPATIENT_DEV_API_URL ให้ตรงกับพอร์ตที่เปิด ตัวอย่างด้านล่างใช้พอร์ตปกติของการติดตั้งใหม่

## 1. เปิด backend ใน PowerShell

ใช้ PostgreSQL ฐานข้อมูลพัฒนาในเครื่องที่แยกจาก production และเปิด PowerShell หน้าต่างหนึ่งสำหรับ backend:

```powershell
cd "C:\Users\Ult_Orange\Desktop\โฟลเดอร์ใหม่\new-system\backend"
$env:APP_ENV = "development"
$env:DATABASE_URL = "postgresql://<ผู้ใช้ฐานข้อมูล>:<รหัสผ่าน>@127.0.0.1:5432/<ชื่อฐานข้อมูลพัฒนา>"
```

แทนค่า placeholder ด้วยค่าของฐานข้อมูลพัฒนาในเครื่อง อย่าใส่บรรทัดที่มีค่าจริงลงไฟล์หรือ Git และอย่าส่งภาพหน้าจอ/ข้อความที่เผย credential ให้ผู้อื่น ตัวแปร `$env:` มีผลเฉพาะ PowerShell หน้าต่างนั้น และต้องตั้งใหม่เมื่อเปิดหน้าต่างใหม่; backend ไม่อ่านไฟล์ `.env` อัตโนมัติ

ถ้า username/password มีอักขระสงวนใน URL ต้อง percent-encode ก่อนใส่ `DATABASE_URL`; อย่าแก้ปัญหาด้วยการแปะ credential ลงแชตหรือ commit ลง repo

ติดตั้ง dependencies ครั้งแรกเท่านั้น (ถ้า `.venv` และ dependencies มีอยู่แล้วให้ข้าม):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

สร้าง/ปรับ schema ของ **ฐานพัฒนาเป้าหมายที่ตรวจสอบแล้วเท่านั้น**:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

สร้างบัญชี system admin เฉพาะเมื่อยังไม่มีบัญชีเริ่มต้นที่ใช้ได้; คำสั่งจะถาม username และรหัสผ่าน:

```powershell
.\.venv\Scripts\python.exe -m app.cli.create_admin
```

อย่ารันซ้ำโดยไม่ตรวจว่ามีผู้ดูแลระบบอยู่แล้ว และอย่าใช้บัญชีตัวอย่างหรือเผยรหัสผ่านในเอกสาร/แชต จากนั้นเริ่ม backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

ตรวจ `http://127.0.0.1:8000/healthz` ว่า API ตอบได้ เอกสาร API สำหรับ development อยู่ที่ `http://127.0.0.1:8000/docs` การตอบ health ไม่ได้แปลว่าการยืนยันตัวตนและการบันทึกผ่านแล้ว

## 2. เปิด frontend ใน PowerShell อีกหน้าต่าง

```powershell
cd "C:\Users\Ult_Orange\Desktop\โฟลเดอร์ใหม่\new-system\frontend"
$env:BACKEND_API_URL = "http://127.0.0.1:8000"
npm run dev
```

เปิด `http://localhost:3000` หน้าบ้านส่งคำขอ `/api/v1` ผ่าน Next.js ไป backend เท่านั้น ไม่ควรใส่ connection string หรือเชื่อมฐานข้อมูลจาก frontend หากเครื่องยังไม่มี dependencies จึงค่อยรัน `npm install` ในโฟลเดอร์ frontend ก่อน `npm run dev` เก็บหน้าต่าง backend และ frontend ไว้ระหว่างใช้งาน และหยุดแต่ละตัวด้วย `Ctrl+C` ในหน้าต่างของตัวเอง

ถ้า login แสดงข้อผิดพลาด ให้ตรวจ traceback ในหน้าต่าง backend และตรวจว่าฐานพัฒนาเปิดอยู่, `DATABASE_URL` ถูกต้อง, schema migrate แล้ว และมี admin ที่ active อยู่ อย่าคาดเดารหัสผ่านจากภาพหรือเปลี่ยนค่าฐานข้อมูลจริงเพื่อแก้ปัญหา

## 3. สำรองและซ้อมกู้คืนในสภาพแวดล้อมพัฒนา

สำรองก่อน migration หรือ import ทุกครั้ง เลือกโฟลเดอร์เก็บสำรองที่จำกัดสิทธิ์และอยู่นอกโฟลเดอร์ source; ระวังว่า dump อาจมีข้อมูลอ่อนไหวแม้เป็นสำเนา ใช้เฉพาะชุดข้อมูลทดสอบ/ข้อมูลที่ผ่านการปกปิดในงานพัฒนา

ตัวอย่าง PowerShell ใช้ PostgreSQL tools (`pg_dump`, `pg_restore`) และจะถามรหัสผ่านโดยไม่ใส่รหัสผ่านใน command:

```powershell
$backup = "D:\restricted-backups\inpatient-dev-2026-11-18.dump"
pg_dump --format=custom --host=127.0.0.1 --port=5432 --username=DB_USER --password --dbname=DEV_DATABASE --file=$backup
Get-FileHash -Algorithm SHA256 -Path $backup
pg_restore --list $backup
```

เก็บ checksum แยกจากไฟล์ backup และจำกัดการเข้าถึง/เข้ารหัสไฟล์สำรอง สำหรับ production ในอนาคตต้องใช้ระบบสำรองที่องค์กรอนุมัติและเข้ารหัสด้วย KMS/ระบบจัดการกุญแจขององค์กร คู่มือนี้ยังไม่กำหนดหรือเปิดใช้บริการดังกล่าว

ซ้อม restore โดยสร้าง **ฐานข้อมูลกู้คืนใหม่ชื่อไม่ซ้ำ** และตรวจชื่อเป้าหมายก่อนสั่ง restore; ห้ามใช้ฐานที่กำลังใช้งานหรือสั่งทับฐานเดิม:

```powershell
createdb --host=127.0.0.1 --port=5432 --username=DB_USER inpatient_dev_recovery_20261118
pg_restore --exit-on-error --no-owner --host=127.0.0.1 --port=5432 --username=DB_USER --dbname=inpatient_dev_recovery_20261118 $backup
```

หลัง restore ให้เชื่อมแอปเข้าฐาน recovery แยกชั่วคราวและตรวจ schema/จำนวนรวม โดยห้ามคัดลอกข้อมูลส่วนบุคคลมาใส่รายงาน บันทึกว่ากู้คืนสำเร็จ ใช้เวลานานเท่าใด และพบ error ใดก่อนถือว่าแผนกู้คืนผ่าน

## 4. ขั้นตอนนำเข้าข้อมูลเก่าในสำเนาฐานพัฒนาเท่านั้น

เครื่องมือนำเข้ารุ่นนี้อ่านไฟล์ CSV ที่ normalize แล้วสำหรับ `data_all` เท่านั้น ไม่อ่าน/แก้ dump ต้นฉบับ ไม่ย้ายบัญชี และยังไม่รองรับตารางแยกผู้ป่วย, pressure, readmit, confirmation/audit, news หรือข้อมูล ward/capacity อ้างอิง

1. ทำสำเนาไฟล์ต้นทางแบบอ่านอย่างเดียวไปยังพื้นที่ staging จำกัดสิทธิ์ เก็บต้นฉบับเดิมไม่เปลี่ยน และทำงานกับสำเนา CSV ที่ผ่านการปกปิดข้อมูลส่วนบุคคลแล้วเท่านั้น
2. ตรวจหัวคอลัมน์เทียบกับ `backend\docs\templates\data_all_template.csv` ห้ามใส่ชื่อ เลขประจำตัว หรือข้อมูลผู้ป่วยลง template
3. เปิด terminal ใหม่ ตั้ง `APP_ENV=development` และ `DATABASE_URL` ไปยังฐานพัฒนา loopback ที่ตรวจแล้ว ห้ามมี tunnel/forward ไป production ตั้งค่านั้นใหม่ใน terminal เดียวกับคำสั่ง
4. เริ่มด้วย dry-run (ค่าเริ่มต้น ไม่เขียนข้อมูล):

```powershell
cd "C:\Users\Ult_Orange\Desktop\โฟลเดอร์ใหม่\new-system\backend"
$env:APP_ENV = "development"
$env:DATABASE_URL = "postgresql://<ผู้ใช้ฐานข้อมูล>:<รหัสผ่าน>@127.0.0.1:5432/<ชื่อฐานข้อมูลพัฒนา>"
.\.venv\Scripts\python.exe -m app.cli.import_legacy --source "D:\restricted-staging\data_all.csv"
```

5. ตรวจเฉพาะผลรวมจำนวนแถวที่จะนำเข้า/ข้าม/ผิดพลาดและ error codes; แก้ mapping ที่ฐานพัฒนาและยืนยันรายการเวร/ward ก่อน หากคอลัมน์จำนวนว่าง, วันไม่ใช่ Gregorian `YYYY-MM-DD`, รหัสเวร/ward ไม่มี mapping หรือ `i_status` มีค่าอื่นนอกจากค่าว่าง 0 และ 1 แถวนั้นจะไม่ผ่านตามกติกาปัจจุบัน
6. คำสั่ง `--apply` ด้านล่างเป็นตัวอย่างสำหรับ **ฐานพัฒนาเท่านั้น** ไม่ให้ใช้กับ production ในเฟสนี้ การ apply เขียนเป็น transaction เดียวและพิมพ์ `migration_batch_id`; รหัสธรรมชาติที่นำเข้าแล้วหรือชนกับรายการเดิมจะถูกข้าม ไม่เขียนทับ:

```powershell
.\.venv\Scripts\python.exe -m app.cli.import_legacy --source "D:\restricted-staging\data_all.csv" --apply --actor-username ADMIN_USERNAME
```

7. ใช้ไฟล์ CSV เดิมที่ไม่เปลี่ยนแปลงและ `migration_batch_id` เดียวกันตรวจยอดแบบ read-only:

```powershell
.\.venv\Scripts\python.exe -m app.cli.reconcile_legacy --source "D:\restricted-staging\data_all.csv" --batch-id BATCH_UUID
```

รายงาน reconciliation แสดง checksum, จำนวนแถว, mismatch counts และผลรวมแยกฟิลด์ โดยไม่พิมพ์ค่ารายแถวหรือข้อมูลส่วนบุคคล หากมี mismatch/แถวข้าม/ข้อผิดพลาด ให้หยุดและสอบสวนก่อน ไม่ถือว่าเป็นการอนุมัติใช้งานจริง

การนำเข้าที่ commit แล้วไม่มีคำสั่งลบ/ย้อน batch อัตโนมัติในเครื่องมือนี้ หากซ้อมในฐานพัฒนาแล้วมีปัญหา ให้หยุดการเขียนเพิ่ม เก็บรายงาน batch ไว้ และกู้คืน snapshot ลงฐาน recovery ใหม่เพื่อตรวจสอบ ห้ามลบแถวด้วยมือหรือ restore ทับฐานที่กำลังใช้งานโดยไม่มีแผนและการทบทวน

## 5. ขอบเขตก่อนย้ายข้อมูลจริง

- **ขอบเขตข้อมูล:** ต้องตัดสินใจว่าจะย้ายตาราง/ตัวชี้วัดใดเพิ่มและตรวจความสัมพันธ์อย่างไร เครื่องมือปัจจุบันเทียบได้เฉพาะ `data_all`
- การทดสอบด้วยข้อมูลสังเคราะห์ผ่านแล้ว การเทียบยอดข้อมูลจริงยังต้องใช้สำเนาข้อมูลจากโรงพยาบาล
- **การปฏิบัติการ:** ผู้รับผิดชอบ backup/restore, อายุเก็บ backup, ที่เก็บเข้ารหัส, ผู้ดูแลบัญชี, การเฝ้าระวัง และช่องทางแจ้งเหตุ production ยังต้องกำหนด

## 6. Checklist ก่อนพิจารณาเปลี่ยนจากระบบเก่า

ให้ถือว่ายังไม่พร้อม cutover จนกว่ารายการต่อไปนี้จะครบและได้รับอนุมัติจากผู้รับผิดชอบ:

- ยืนยัน mapping เวร, กติกาวันที่, สถานะ/audit, สูตรครองเตียงและฐานจำนวนเตียงเป็นลายลักษณ์อักษร
- ยืนยันขอบเขตข้อมูลและสิทธิ์ผู้ใช้; ตรวจ API ให้ครอบคลุมหน้าจอและ workflow ที่จำเป็น
- ตรวจล็อกอิน การ build และ workflow บันทึก/แก้/ยืนยัน/ส่งกลับ/ประวัติบนฐานพัฒนา
- ใช้สำเนาที่ผ่านการปกปิดข้อมูล ทำ dry-run, import ทดลองในฐานพัฒนาแยก, แล้ว reconciliation จำนวนและผลรวมให้ตรงตามเกณฑ์ที่ตกลง
- ทดสอบ backup และ restore จนเปิดฐาน recovery และตรวจผลได้ พร้อมระบุผู้รับผิดชอบและเวลาในการกู้คืน
- ทบทวน TLS, การเข้ารหัสฐานและ backup, secret manager/KMS, สิทธิ์ขั้นต่ำ, audit, rate limit และนโยบาย log โดยไม่บันทึก secrets หรือข้อมูลผู้ป่วย
- จัดทำแผน cutover/หยุดรับข้อมูล/ตรวจยอด/สื่อสารผู้ใช้/rollback ที่มีเจ้าของงานและเวลาชัดเจน
- ก่อนแตะ production ต้องมีคำสั่งโดยตรงให้ดำเนินการขั้น production นั้น และอนุมัติฐานเป้าหมาย, backup ที่ตรวจแล้ว, หน้าต่างดำเนินการ และเงื่อนไขหยุด/ย้อนกลับเป็นการเฉพาะ

จนกว่าจะครบเงื่อนไขและมีคำสั่งดังกล่าว ให้ใช้ระบบเก่าตามปกติและใช้ระบบใหม่นี้เฉพาะการพัฒนา/ทดสอบที่แยกจากข้อมูลใช้งานจริง
