# ระบบรายงานจำนวนผู้ป่วยใน (Inpatient Aggregate Reporting System)

ระบบเว็บสำหรับ **บันทึกจำนวนผู้ป่วยในรายหอผู้ป่วย → ยืนยัน/ส่งกลับแก้ไข → ออกรายงานและพิมพ์/ส่งออก PDF** สำหรับพยาบาลและหัวหน้าหอผู้ป่วย ใช้แทนขั้นตอนเดิมที่ทำในระบบ PHP และ Excel

- Frontend: Next.js 16 + React 19 (JavaScript) — ทำหน้าที่เป็นหน้าจอและ proxy คำขอไป API
- Backend: FastAPI + SQLAlchemy (async) + Alembic บน PostgreSQL
- ข้อมูลที่เก็บเป็น **ตัวเลขสรุป** (จำนวนเตียง ผู้ป่วยแยกประเภท บุคลากร แผลกดทับ รีแอดมิท) ไม่ได้ออกแบบให้เก็บชื่อหรือ HN ของผู้ป่วย
- การยืนยันตัวตนด้วย session cookie แบบ opaque, รหัสผ่านเก็บเป็น Argon2id hash, ทุกคำสั่งที่เขียนข้อมูลต้องมี CSRF token

> **สถานะ:** ใช้ภายในโรงพยาบาล อยู่ระหว่างตรวจรับเทียบกับระบบเดิม (`inpatient/`) ผลตรวจและช่องว่างที่ยังเหลือดูใน [INPATIENT_PARITY_TH.md](INPATIENT_PARITY_TH.md) — ยังไม่ถือเป็นการรับรองให้เลิกใช้ระบบเดิมทั้งระบบ

---

## ความต้องการของเครื่อง

| สิ่งที่ต้องมี | เวอร์ชัน |
|---|---|
| Node.js | 20.9 ขึ้นไป |
| Python | 3.11 ขึ้นไป |
| PostgreSQL | ฐานข้อมูลสำหรับพัฒนา (แยกจาก production) |

## เริ่มใช้งานในเครื่อง

ต้องเปิด **สองหน้าต่าง terminal**: หนึ่งสำหรับ backend (port 8000) และหนึ่งสำหรับ frontend (port 3000)

### 1) Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

$env:APP_ENV = "development"
$env:DATABASE_URL = "postgresql://<ผู้ใช้>:<รหัสผ่าน>@127.0.0.1:5432/<ชื่อฐานข้อมูลพัฒนา>"

.\.venv\Scripts\python.exe -m alembic upgrade head          # สร้าง/ปรับ schema
.\.venv\Scripts\python.exe -m app.cli.create_admin          # สร้างผู้ดูแลระบบคนแรก (ถามรหัสผ่าน)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

ตรวจว่า API ตอบ: <http://127.0.0.1:8000/healthz> — เอกสาร OpenAPI อยู่ที่ `/docs` (เปิดเฉพาะตอน `APP_ENV` ไม่ใช่ production)

> ถ้ามี `uv` อยู่แล้วใช้ `uv sync` / `uv run` แทนได้
> ถ้า username/password มีอักขระสงวนใน URL ต้อง percent-encode ก่อนใส่ `DATABASE_URL`

### 2) Frontend (Next.js)

```powershell
cd frontend
npm install
$env:BACKEND_API_URL = "http://127.0.0.1:8000"
npm run dev
```

เปิด <http://localhost:3000> — Next.js rewrite คำขอ `/api/v1/*` ไปที่ backend ตาม `frontend/next.config.mjs` (ใช้ `INPATIENT_DEV_API_URL` แทนได้เมื่อต้องสลับไป backend คนละพอร์ตในเครื่องเดียว)

### ตัวแปรสภาพแวดล้อม

`backend/.env.example` (backend ไม่อ่านไฟล์ `.env` อัตโนมัติ ต้องตั้งใน shell หรือ secret manager)

| ตัวแปร | ความหมาย |
|---|---|
| `APP_ENV` | `development` / `production` |
| `DATABASE_URL` | connection string ของ PostgreSQL |
| `DATABASE_SSL_REQUIRED` | บังคับ TLS ไปยังฐานข้อมูล (`true` ใน production) |
| `DB_SSL_CA_FILE` | path ของ CA certificate |
| `SESSION_TTL_MINUTES` | อายุ session (ค่าเริ่มต้น 480 นาที) |

`frontend/.env.example`

| ตัวแปร | ความหมาย |
|---|---|
| `BACKEND_API_URL` | address ของ API สำหรับ rewrite (ไม่ใช่ credential) |
| `NEXT_PUBLIC_SATISFACTION_URL` | URL ระบบความพึงพอใจภายนอก (ถ้ามี) |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | เปิดหน้าปิดปรับปรุงชั่วคราว |

**ห้าม commit ค่า `.env` จริง** — `.gitignore` ระดับรากปิด `.env*`, ไฟล์ฐานข้อมูล (`*.db`, `*.sqlite`, `*.dump`, `*.bak`) และโฟลเดอร์ `data/`, `db/`, `backups/` ไว้แล้ว

## หน้าจอหลัก

| เส้นทาง | ใช้ทำอะไร |
|---|---|
| `/login` | เข้าสู่ระบบ |
| `/entries` | เลือกหอ/วันที่/เวร บันทึก แก้ไข และยืนยันรายการ |
| `/indicators` | แผลกดทับรายวัน และรีแอดมิท/จำหน่ายรายเดือน |
| `/history` | ค้นประวัติและติดตามการส่งกลับแก้ไข |
| `/reports` | เปิด/พิมพ์/ส่งออกรายงานรายวันและรายเดือน |
| `/occupancy` | รายงานครองเตียงตามปีงบประมาณ |
| `/users` | จัดการผู้ใช้และสิทธิ์ (ผู้ดูแลระบบ) |
| `/` | ข่าวประกาศ |

API ใช้ base path `/api/v1` (auth, wards, shifts, entries, reports, indicators, news, admin) รายการ endpoint ฉบับเต็มอยู่ใน [backend/README.md](backend/README.md)

## โครงสร้างโฟลเดอร์

```text
new-system/
├─ frontend/                  หน้าจอ Next.js (JavaScript)
│  ├─ app/                    หน้าจอตามเส้นทาง (login, entries, indicators, history, reports, occupancy, users)
│  ├─ components/             คอมโพเนนต์ใช้ร่วม (AppShell, DateField, ReportViewer, TextSizeControl ฯลฯ)
│  ├─ lib/                    ตัวช่วยฝั่งหน้าจอ (api client, วันที่ พ.ศ., มุมมองรายงาน)
│  ├─ styles/                 design tokens และ CSS ของแต่ละหน้า
│  ├─ tests/                  ชุดทดสอบด้วย node:test
│  └─ next.config.mjs         rewrite /api/v1 ไปยัง backend
├─ backend/                   API ด้วย FastAPI
│  ├─ app/                    api.py (เส้นทางทั้งหมด), models, schemas, security, reports, occupancy
│  ├─ app/cli/                create_admin, นำเข้า/กระทบยอดข้อมูลเดิม
│  ├─ alembic/                migration 0001–0008
│  ├─ docs/                   เอกสารนำเข้าข้อมูลเดิม + template CSV
│  └─ tests/                  unittest + สคริปต์ซ้อมย้ายข้อมูลและตรวจความตรงกันของรายงาน
├─ docs/                      สเปก UI, ผลตรวจเทียบระบบเดิม, ภาพหน้าจอ, บันทึกการซ้อมย้ายข้อมูล
├─ output/pdf/                ตัวอย่าง PDF ที่ระบบสร้าง (ข้อมูลสมมติ)
├─ INPATIENT_PARITY_TH.md     ผลตรวจเทียบระบบใหม่กับระบบเดิมทีละเฟส
├─ OPERATIONS_GUIDE_TH.md     คู่มือเปิดระบบและข้อห้ามเกี่ยวกับ production
└─ LICENSE                    สัญญาอนุญาต MIT
```

## การทดสอบ

```powershell
# backend (unittest, ไม่ต้องใช้ฐานข้อมูล)
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -t .

# frontend (node:test)
cd frontend
npm run test:ui

# ตรวจว่า build ผ่าน
cd frontend
npm run build
```

สคริปต์ใน `backend/tests/` ที่มีคำว่า `run_` / `check_` เป็นเครื่องมือซ้อมย้ายข้อมูลและตรวจความตรงกันของรายงาน ต้องใช้ฐานข้อมูลทดสอบและสำเนาข้อมูลที่ได้รับอนุญาต — ดู [OPERATIONS_GUIDE_TH.md](OPERATIONS_GUIDE_TH.md) และ [backend/docs/legacy_import.md](backend/docs/legacy_import.md)

## เอกสารเพิ่มเติม

- [docs/ui-spec.md](docs/ui-spec.md) — สเปก UX/UI และ design tokens
- [docs/ui-progress.md](docs/ui-progress.md) — ความคืบหน้าและคำถามที่ค้างของงาน UI
- [docs/system-architecture-and-flow.md](docs/system-architecture-and-flow.md) — สถาปัตยกรรมและลำดับการทำงาน
- [INPATIENT_PARITY_TH.md](INPATIENT_PARITY_TH.md) — ผลตรวจเทียบระบบเดิม (สูตรรายงาน สิทธิ์ ข้อมูลที่ต่าง)

## ข้อควรระวัง

- รีโปนี้เป็น **public**: ห้าม commit ข้อมูลผู้ป่วยจริง ภาพหน้าจอจากฐานข้อมูลจริง ไฟล์ฐานข้อมูล หรือ credential ใด ๆ ภาพ/PDF ใน `docs/` และ `output/` สร้างจากข้อมูลสมมติ
- เอกสารนี้อธิบายเฉพาะสภาพแวดล้อมพัฒนา ยังไม่มีการอนุมัติให้เชื่อมต่อหรือย้ายข้อมูลไป production
- ระบบนี้เป็นเครื่องมือช่วยสรุปรายงาน ไม่ใช่เครื่องมือวินิจฉัยหรือตัดสินใจทางคลินิก

## สัญญาอนุญาต

เผยแพร่ภายใต้ [MIT License](LICENSE) — ใช้ แก้ไข และแจกจ่ายได้ โดยระบุลิขสิทธิ์เดิมและไม่มีภาระรับประกันใด ๆ (ผู้ถือลิขสิทธิ์คือ `ORange11em`; แก้ชื่อใน `LICENSE` ได้ตามหน่วยงานที่เป็นเจ้าของงาน)
