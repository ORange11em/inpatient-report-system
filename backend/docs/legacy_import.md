# เครื่องมือนำเข้าข้อมูลย้อนหลัง

The importer reads a normalized, read-only CSV copy for data_all. It never reads the original SQL dump, never imports account credentials, and never modifies source files. The example header is in docs/templates/data_all_template.csv. No real or patient-level data belongs in the template.

## Safety gates

- Default mode is dry-run. It reads the CSV and queries only a PostgreSQL database whose host resolves to loopback (localhost/127.0.0.1/::1). It does not insert or update records.
- Write mode requires --apply, APP_ENV=development or test, a loopback DATABASE_URL, and an existing active system admin named with --actor-username.
- Do not use a production database URL or a tunnel to production. The importer rejects non-loopback hosts.
- Every apply run is one database transaction. Source business keys are SHA-256 hashed and tracked in legacy_key_map; a repeat run skips mapped keys. A natural-key match without a crosswalk is also skipped and never overwritten.
- Errors and skipped reasons are summarized by code only. Row values, passwords and connection strings are not printed.

## CSV mapping

The CSV is a normalized export staging contract, not a direct dump of the old SQL. Required columns are ward, idate, wage_type_id, amount_bed and the PT/NB, patient_type1–5 and staff counter fields in the template.

- ward maps through wards.legacy_code.
- idate must be a valid Gregorian YYYY-MM-DD.
- wage_type_id maps through shift_types.legacy_shift_id. Migration 0003 supplies 1 night, 2 morning and 3 afternoon. Missing or inactive mappings fail.
- amount_bed is preserved as the row snapshot; blank remains null.
- Numeric counter cells must be present and nonnegative. Blank values are rejected rather than silently changed to zero.
- Optional i_status accepts 0 or blank for unconfirmed and 1 for confirmed. The import audit identifies the actor and batch. Historical confirmation events require a separate export.
- Re-imported source keys are skipped. Data in target with a matching ward/date/shift but no crosswalk is skipped for review, never overwritten.

เครื่องมือเดิม `import_legacy.py`/`reconcile_legacy.py` ครอบคลุม `data_all` ส่วน `data_confirm` ใช้ `import_legacy_confirmations.py` และข้อมูลเสริมอีก 4 ตาราง (`data_split_patient`, `pressure`, `readmit`, `tb_news`) ใช้ `import_legacy_supplements.py` และ `reconcile_legacy_supplements.py`

dump SQL ที่ได้รับไม่มีแถวใช้งานใน `data_all`, `data_confirm`, `data_split_patient`, `pressure`, `readmit`, `tb_news`; จึงหา min/max วันที่จริงหรือจำนวนซ้ำจริงไม่ได้ ช่วงข้อมูลที่ใช้กับ export รอบต่อไปคือทุกแถวที่ผู้ดูแลจัดเตรียม ไม่ตั้ง cutoff เอง และต้องสรุปวันต่ำสุด/สูงสุดต่อ table ก่อน apply

## ตารางเสริม 4 ตาราง (data_split_patient, pressure, readmit, tb_news)

ใช้แนวทางความปลอดภัยเดียวกับ `import_legacy.py` (เฉพาะ `APP_ENV=development` หรือ `test` บน loopback เท่านั้น, dry-run เป็นค่าเริ่มต้น, `--apply` ต้องระบุ `--actor-username` ที่เป็น `system_admin` ซึ่งใช้งานอยู่):

- `data_split_patient -> specialty_counts`: นำเข้าเฉพาะเวรบ่าย (`legacy_shift_id = 3`) 13 สาขา × ห้องสามัญ (`_n`) / ห้องพิเศษ (`_s`) รวม 26 ช่อง ต้องมีรายการเวรบ่ายของหอและวันนั้นอยู่แล้ว ห้ามเติม 0 แทนค่าว่าง (`blank_specialty_count_field`)
- `pressure -> pressure_daily`: จับคู่หอและวันที่ (`ward`, `idate`) คงความต่างระหว่างเลข `0` (รวมกรณี `0/0`) กับค่าว่าง (`blank_pressure_field`)
- `readmit -> readmission_monthly`: จับคู่หอและเดือนรายงาน `month1` (`YYYY-MM` -> วันแรกของเดือน) คง `idate` เดิมไว้เป็น provenance ใน `updated_at` (หากไม่มี `idate` จะบันทึก `readmit_idate_missing` ลง `legacy_import_issues`) และห้ามเติม 0 แทนค่าว่าง (`blank_readmit_field`)
- `tb_news -> announcements`: จับคู่ `id` เดิมใน `legacy_key_map` แปลงสถานะ `1 -> published=true`, `0 -> published=false` จับคู่ `user_update` ผ่าน `--account-map` (`legacy_account_id,target_username`) เท่านั้น ห้ามย้ายรหัสผ่านจาก `account` และห้ามใช้ `--actor-username` ปลอมเป็นผู้ประกาศข่าวเดิม หากไม่มีผู้ประกาศหรือจับคู่ไม่ได้จะเก็บ `publisher_username = NULL` พร้อมบันทึก `news_publisher_missing` หรือ `legacy_account_unmapped` ลง `legacy_import_issues`

ตัวอย่างคำสั่ง dry-run, apply และ reconcile:

    .\.venv\Scripts\python.exe -m app.cli.import_legacy_supplements --table data_split_patient --source C:\path\to\copy\data_split_patient.csv
    .\.venv\Scripts\python.exe -m app.cli.import_legacy_supplements --table data_split_patient --source C:\path\to\copy\data_split_patient.csv --apply --actor-username <admin-username>
    .\.venv\Scripts\python.exe -m app.cli.reconcile_legacy_supplements --table data_split_patient --source C:\path\to\copy\data_split_patient.csv --batch-id <migration-batch-uuid>

    .\.venv\Scripts\python.exe -m app.cli.import_legacy_supplements --table tb_news --source C:\path\to\copy\tb_news.csv --account-map C:\path\to\copy\account-map.csv --apply --actor-username <admin-username>
    .\.venv\Scripts\python.exe -m app.cli.reconcile_legacy_supplements --table tb_news --source C:\path\to\copy\tb_news.csv --account-map C:\path\to\copy\account-map.csv --batch-id <migration-batch-uuid>

## ประวัติยืนยันจาก data_confirm

`data_all.i_status` คือสถานะรายการปัจจุบัน ส่วน `data_confirm` เป็น event history แยกกัน ห้ามแปลงประวัติให้เป็นสถานะหรือใส่ event โดยใช้ผู้รันนำเข้าแทนผู้ยืนยัน เครื่องมือนี้เก็บ event ไว้ใน `legacy_confirmation_records`; actor และเวลา nullable ได้ และเขียนแถวที่จับคู่ไม่ได้ไว้ใน `legacy_import_issues` ด้วย hash/reason code โดยไม่พิมพ์ข้อมูลต้นทางดิบ

ไฟล์บัญชีเชื่อมต้องมีหัว `legacy_account_id,target_username`; บัญชีเป้าหมายต้องมีอยู่และ active อยู่แล้ว เครื่องมือไม่ย้าย `pass_login` ไม่สร้างบัญชีใหม่ และการ apply ต้องระบุผู้รันซึ่งเป็น system admin ที่มีอยู่แล้ว

    .\.venv\Scripts\python.exe -m app.cli.import_legacy_confirmations --source C:\path\to\copy\data_confirm.csv --account-map C:\path\to\copy\account-map.csv
    .\.venv\Scripts\python.exe -m app.cli.import_legacy_confirmations --source C:\path\to\copy\data_confirm.csv --account-map C:\path\to\copy\account-map.csv --apply --actor-username <admin-username>

หัวไฟล์ `data_confirm.csv`: `ward,idate,wage_type_id,cdate,cuser`. วันใช้ Gregorian ISO `YYYY-MM-DD`; timestamp ใช้ datetime ต้นทาง; ค่าว่างคงเป็นไม่มีข้อมูล รายการที่ยังไม่มี daily entry จะถูกเก็บไว้พร้อมข้อยกเว้น ไม่แต่งรายการเป้าหมายขึ้นมา การรันซ้ำกับไฟล์เดิมใช้ hash ของแถว/ลำดับ occurrence และไม่เพิ่ม event หรือข้อยกเว้นซ้ำ

## Commands

From PowerShell in new-system/backend, set DATABASE_URL to a local development PostgreSQL database and APP_ENV=development. First run a dry-run:

    .\.venv\Scripts\python.exe -m app.cli.import_legacy --source C:\path\to\copy\data_all.csv

Review the JSON summary. To write only to the local development database:

    .\.venv\Scripts\python.exe -m app.cli.import_legacy --source C:\path\to\copy\data_all.csv --apply --actor-username <admin-username>

The tool records an apply batch and imported source keys so later runs are idempotent. It does not provide automatic deletion/rollback of a committed batch; restore the development database snapshot or use a reviewed batch-specific recovery procedure.

## Read-only reconciliation

Apply mode prints a migration_batch_id. After import, compare using the same unchanged CSV and that batch id:

    .\.venv\Scripts\python.exe -m app.cli.reconcile_legacy --source C:\path\to\copy\data_all.csv --batch-id <migration-batch-uuid>

Reconciliation ของ `data_all` เป็น read-only และใช้ guard development/test + loopback เช่นเดิม ตรวจ checksum เดียวกับ batch แล้วรายงานจำนวนแถว ยอดรวม และฟิลด์ต่างโดยไม่พิมพ์ค่ารายแถว ส่วน `data_confirm` คืนจำนวนและ reason code จากเครื่องมือนำเข้าและเก็บข้อยกเว้นไว้ในฐานทดสอบ; ยังไม่มี CLI reconciliation แยกเพื่อตรวจยอดเหตุการณ์ทางบัญชีแบบรายงาน
