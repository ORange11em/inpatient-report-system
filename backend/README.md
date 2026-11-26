# Python backend

Backend นี้แยกจากระบบเดิมในโฟลเดอร์ inpatient และให้หน้าบ้านเรียกผ่าน HTTP API เท่านั้น ใช้ FastAPI, SQLAlchemy async, Alembic และ PostgreSQL

## เปิดระบบสำหรับพัฒนา

ต้องมี Python 3.11 ขึ้นไปและ PostgreSQL ที่เตรียมไว้แล้ว ไม่จำเป็นต้องติดตั้ง uv ใช้ virtual environment ของ Python ได้จาก PowerShell ในโฟลเดอร์นี้:

    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install --upgrade pip
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    $env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/<database>"
    .\.venv\Scripts\python.exe -m alembic upgrade head
    .\.venv\Scripts\python.exe -m app.cli.create_admin
    .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

หากติดตั้ง uv อยู่แล้ว สามารถใช้ uv sync และ uv run ตามปกติได้

ตั้ง DATABASE_URL ใน terminal สำหรับเครื่องพัฒนา หรือใช้ secret manager ในระบบที่ deploy จริง ห้ามใส่ค่าจริงในไฟล์หรือ commit ลง Git การ migrate สร้าง schema ตั้งค่าเวร และเพิ่มหออ้างอิง 19 หอเมื่อรายการหอว่าง การสร้างผู้ดูแลระบบจะถามชื่อและรหัสผ่านแบบไม่แสดงรหัสผ่านบนหน้าจอ

API มี base path /api/v1; เอกสาร OpenAPI อยู่ที่ /docs ใน development เท่านั้น ให้ reverse proxy ของหน้าบ้านส่ง /api/v1 ไป backend และให้ browser เรียก API ผ่าน origin เดียวกัน ฐานข้อมูลไม่เปิดให้หน้าบ้านเชื่อมต่อโดยตรง

## ข้อมูลที่รองรับในรุ่นนี้

- Ward, ประเภทเวรที่ตั้งค่าได้, ผู้ใช้, บทบาทระดับระบบ/ward และ session
- รายการรายวันหนึ่งรายการต่อ ward + วันที่ ค.ศ. แบบ ISO + ประเภทเวร; มี unique constraint ป้องกันซ้ำ
- ฟิลด์จำนวน PT/NB ที่พบในแบบเดิม, patient_type1–5, amount_bed snapshot, บุคลากร, รายการแยกสาขา
- pressure รายวัน และ readmit/discharge รายเดือน
- ประวัติสร้าง/แก้/ยืนยัน/ส่งกลับ และตารางรองรับ legacy key แบบ hash กับ migration batch

จำนวนทุกช่องตรวจเป็นจำนวนเต็มไม่ติดลบทั้งใน request schema และ constraint ที่ฐานข้อมูล รายการแก้ไขแบบยืนยันแล้วไม่ได้แก้ทับได้ การส่งกลับต้องระบุเหตุผล การอนุมัติสถานะและสิทธิ์ตรวจที่ API ฝั่ง server ด้วย

## เวรและการคำนวณ

API ใช้ legacy_shift_id 1 ดึก, 2 เช้า, 3 บ่าย ฟอร์มดึงรายการและยอดตั้งต้นจาก GET /api/v1/entry-form บันทึกตัวเลขเวร ข้อมูลแยกสาขา แผลกดทับรายวัน และรีแอดมิตรายเดือนในธุรกรรมเดียว จำนวนเตียงเป็น snapshot บังคับสำหรับการลงเวร ส่วนข้อมูลย้อนหลังที่นำเข้าสามารถคงค่าว่างเดิมได้

รายงานครองเตียงปีงบประมาณใช้สูตรจาก inpatient ปีงบประมาณสิ้นสุดเดือนกันยายน ดูรายละเอียดสูตร ช่วงเวลา และข้อแตกต่างใน [ผลตรวจเทียบ](../INPATIENT_PARITY_TH.md)

## Session และการป้องกันข้อมูล

Login ใช้ username/password; password จัดเก็บเป็น Argon2id hash ด้วย pwdlib ไม่เก็บ plaintext และไม่ย้าย credential จากระบบเดิม Session เป็น opaque random cookie ที่ server เก็บเฉพาะ SHA-256 hash, cookie HttpOnly/SameSite=Lax และ Secure เมื่อ APP_ENV=production; mutation ต้องมี X-CSRF-Token ที่ได้จาก /auth/csrf หรือ login สิทธิ์ตรวจทุก request

ใน production ต้องกำหนด APP_ENV=production, DATABASE_SSL_REQUIRED=true และ DB_SSL_CA_FILE ตาม CA ของฐานข้อมูล ให้ TLS termination/proxy เข้ารหัส browser-to-service และ service-to-database, เปิด encryption-at-rest ของ volume/database และเข้ารหัส backup ผ่านผู้ให้บริการ/KMS ที่ deploy ใช้ การตั้งค่า KMS/volume/backup เป็นงาน deployment และยังไม่ได้เปิดให้จากโค้ดนี้ ไม่มี key หรือ secret ฝังใน source; ไฟล์ .env ถูก ignore และแอปไม่อ่าน .env อัตโนมัติ

ข้อมูลที่ schema รุ่นนี้เก็บเป็นตัวเลขสรุป ไม่ได้ออกแบบให้เก็บชื่อหรือรหัสผู้ป่วย หากต้องเพิ่มข้อมูลระบุตัวบุคคล ต้องกำหนด data minimization, field encryption/key management, access/audit policy แยกก่อน

แนะนำให้ reverse proxy บังคับ HTTPS, จำกัดการเข้าถึง /docs ใน production (ปิดไว้โดยค่าเริ่มต้น), ตั้ง rate limit ที่ gateway สำหรับ login และติดตาม audit/backup โดยไม่บันทึก password, session cookie, CSRF token หรือข้อมูลผู้ป่วยลง log

## API โดยย่อ

- POST /api/v1/auth/login, POST /auth/logout, GET /auth/me, GET /auth/csrf
- GET/POST /api/v1/wards และ GET/POST /wards/{ward_id}/capacity
- GET/POST /api/v1/shifts และ PATCH /shifts/{shift_id}
- GET/POST /api/v1/entries, GET/PATCH /entries/{entry_id}
- POST /entries/{entry_id}/confirm และ POST /entries/{entry_id}/return
- GET /api/v1/reports/daily, /api/v1/reports/occupancy และ /api/v1/reports/summary/{kind}
- GET /api/v1/entry-form, /api/v1/entries/pending-count และ GET/POST/PUT/DELETE ข่าวผ่าน /api/v1/news
- PUT /api/v1/indicators/pressure/{ward_id}/{service_date}
- PUT /api/v1/indicators/readmission/{ward_id}/{reporting_month}
- POST /api/v1/admin/users

Mutating endpoints หลัง login ต้องส่ง X-CSRF-Token ยกเว้น login และการเริ่ม session

## ขอบเขต

หน้าบ้านอยู่ใน frontend การสร้างบัญชีผู้ดูแลเริ่มต้นใช้ app.cli.create_admin

เครื่องมือทดลองนำเข้าจากสำเนา CSV และข้อจำกัดด้านความปลอดภัยอยู่ใน docs/legacy_import.md; โหมดปกติเป็น dry-run และปฏิเสธฐานข้อมูลที่ไม่ใช่ loopback
