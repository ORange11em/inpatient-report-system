# เฟส 5 · แผนผังและหลักฐานข้อมูลย้อนหลัง

ตรวจและบันทึก 20 พฤศจิกายน 2569 (อัปเดตตัวนำเข้าและซ้อมครบ 6 ตาราง 25 พฤศจิกายน 2569) · ใช้เฉพาะข้อมูลสมมติในชุดทดสอบ · ไม่อ่าน/เขียนฐานใช้งานจริง

## ข้อสรุปช่วงวันที่และแหล่งข้อมูล

ไฟล์ `inpatient/db/db_inpatient.sql` เป็น dump ระบุวันที่ 2014-09-05 แต่เป็น schema/reference dump: ไม่มีแถวใน `data_all`, `data_confirm`, `data_split_patient`, `pressure`, `readmit` หรือ `tb_news`; ตาราง `account` มีเพียงแถว seed หนึ่งแถวและมีรหัสผ่านเดิมแบบข้อความธรรมดา จึงไม่คัดลอกบัญชีหรือ credential และไม่อ้างว่าได้ตรวจช่วงข้อมูลจริงแล้ว

**ขอบเขตที่ใช้กับไฟล์ส่งออกในอนาคต:** นำเข้าทุกแถวที่อยู่ในสำเนาซึ่งผู้ดูแลจัดเตรียม โดยไม่ตั้งวันเริ่ม/วันสิ้นสุดขึ้นเอง; รายงานวันต่ำสุด/สูงสุดและจำนวนตามตารางจากแถวจริงก่อน apply หากต้องการตัดช่วงจะระบุใน manifest ของ batch และข้ามแถวก่อนวัน/หลังวันพร้อมเหตุผลชัดเจน ไม่มีวันเริ่มจริงที่สรุปได้จนกว่าจะมี export ฐานข้อมูลที่ได้รับอนุญาต การอ้างวัน 2014-09-05 เป็นวันเริ่มข้อมูลจึงไม่ถูกต้อง

## Mapping และสถานะตรวจ

| ตารางเดิม | พฤติกรรมเดิมที่ยืนยันจากโค้ด | ปลายทางใหม่/วิธีจับคู่ | วันที่ที่ย้าย | สถานะ/ข้อยกเว้น |
|---|---|---|---|---|
| `data_all` | `manage_data.php` INSERT `i_status=0`, UPDATE `last_date/user_update`; `report_*.php` อ่าน `ward,idate,wage_type_id` และตัวนับ | `daily_entries`: `ward→wards.legacy_code`, `wage_type_id→shift_types.legacy_shift_id`, วัน ISO, counter map `on_pt→pt_on` ฯลฯ; สถานะ 0/ว่าง=รอยืนยัน, 1=ยืนยันแล้ว; crosswalk SHA-256 ของคีย์ธุรกิจ | ทุกแถวที่ส่งมา ไม่กรองวัน | เครื่องมือเดิม dry-run/apply/reconcile ทำได้; ช่องตัวนับว่างถูกปฏิเสธแทนการแปลงเป็น 0; เตียงว่างคง null |
| `data_split_patient` | `manage_data.php` เขียนเฉพาะเวรบ่าย (`wage_type=3`); มี 13 สาขา × สามัญ `_n`/พิเศษ `_s`, 26 ค่า nullable | `specialty_counts` ของ daily entry เวรบ่ายตรงหอ/วัน/เวร; ค่า `NULL` ต้องเก็บเป็นไม่มีข้อมูล/ข้อยกเว้น ไม่สร้างเป็นศูนย์ | วัน `idate` ทุกแถว | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table data_split_patient`) ซ้อม P1 5 แถว (สามัญ 11 / พิเศษ 4) ผ่าน; รันซ้ำไม่เพิ่มแถว |
| `pressure` | `manage_data.php` REPLACE เฉพาะเมื่อบันทึกเวรบ่าย; PK หอ+วัน; `do_pressure`,`risk_pressure` nullable; ไม่มีแถวต่างจากแถวศูนย์ | `pressure_daily` หอ+วัน; 0 เป็นค่าตัวเลข; แถวที่ไม่มีค่าใดหรือ NULL ต้องมีข้อยกเว้น/เก็บความต่างไว้ ไม่ถือว่าเป็น 0 | วัน `idate` ทุกแถว | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table pressure`) ซ้อม P1 4 แถว (รวม 3/65, คงแถว 0/0) ผ่าน; ปฏิเสธค่าว่างลง `legacy_import_issues` |
| `readmit` | REPLACE ด้วย `month1=YYYY-MM`, `idate` วันที่แก้ล่าสุด, จำนวนกลับมารักษาซ้ำ/จำหน่าย nullable | `readmission_monthly` ใช้วันแรกของ `month1`; เก็บ `idate` ต้นทางเป็น provenance เพิ่มเติมใน `updated_at`; null แยกจาก 0 | เดือน `month1`; เก็บวันแก้ `idate` | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table readmit`) ซ้อม P1 4 แถว (รวม 4/80, พ.ย. 3/50=6%) และตรวจ provenance `idate` ผ่าน |
| `data_confirm` | `confirm_data_save.php` INSERT event แยก มี `ward,idate,wage_type_id,cdate,cuser`; ไม่ได้เป็นฟิลด์สถานะในตารางเดียวกัน | `legacy_confirmation_records` แยกจาก `daily_entries.status`; map รายการด้วยหอ/วัน/เวร; map ผู้ยืนยันด้วยไฟล์ `legacy_account_id,target_username`; เวลาและ actor nullable; `legacy_import_issues` บันทึกเหตุที่จับคู่ไม่ได้ | วันของการยืนยันทั้งหมดที่ให้มา | `import_legacy_confirmations.py` ซ้อม P1 3 แถวบน PostgreSQL แยก ผ่านครบ dry-run/apply/rerun |
| `tb_news` | `news_save.php`: เพิ่มใหม่เก็บวัน/เวลา/`user_update`; แก้ไขเปลี่ยนผู้แก้ล่าสุด แต่วัน/เวลาเดิมคงเดิม; ลบ DELETE | `announcements`: title/detail, status, date+time, `publisher_username` จับคู่จาก `user_update` เฉพาะเมื่อ map ได้; source id ต้องมี crosswalk; ไม่มีผู้ประกาศหรือวันที่ให้เก็บเป็น null/ข้อยกเว้น ไม่ใช้บัญชีผู้นำเข้า | ทุกข่าวที่ส่งมา | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table tb_news`) ซ้อม P1 2 แถว (N1 เผยแพร่จับคู่ผู้ประกาศได้, N2 ร่างไม่มี mapping เก็บ `publisher_username=NULL` และบันทึก `legacy_account_unmapped`) ผ่าน |
| `account` | ใช้ `id` ใน session; มี `pass_login` แบบข้อความธรรมดาใน dump | ไม่ย้ายบัญชี/รหัสผ่าน; ใช้ crosswalk แบบ explicit legacy id→บัญชีผู้ใช้ใหม่ที่สร้างไว้แล้ว; ไม่มีการสร้างบัญชีหรือ credential จาก dump | ไม่ใช้ตาราง account เป็นประวัติย้อนหลัง; เฉพาะ mapping ผู้ยืนยัน/ผู้ประกาศในช่วง event ที่ย้าย | หอของบัญชีเดิมไม่ใช้มอบสิทธิ์ใหม่โดยอัตโนมัติ; unresolved เป็นข้อยกเว้น |
| `ward` | รหัสเดิมและชื่อ/กลุ่มใช้ในรายงาน; `bedcount` เป็นค่าใน dump ไม่บอก effective date | `wards.legacy_code`; กลุ่ม/ลำดับตามข้อมูลตั้งต้นที่ตรวจสอบ; ห้ามสร้างประวัติเตียงย้อนหลังจาก bedcount ปัจจุบันโดยเดา | ข้อมูลอ้างอิงไม่ใช้ช่วงวัน | mapping ต้องตรวจ uniqueness/active; ความจุย้อนหลังต้องมีแหล่งวันที่มีผลต่างหาก |
| `wage_type` | 1 ดึก, 2 เช้า, 3 บ่าย จากฟอร์ม/รายงาน | `shift_types.legacy_shift_id` ไม่สมมติว่า PK ใหม่เท่ากับ 1/2/3 | ข้อมูลอ้างอิง | มี seed ใหม่ แต่ต้องตรวจ mapping ต่อ environment |
| `tb_month` | ตารางชื่อเดือนสำหรับการแสดงผล | ไม่ย้าย; ปฏิทินกลางใหม่แสดง พ.ศ. และส่ง ISO | ไม่เกี่ยวกับช่วงข้อมูล | ข้อมูลอ้างอิงที่แทนด้วย utility |

## ความหมายของข้อมูลและข้อยกเว้น

- `data_all.i_status` คือสถานะปัจจุบันของรายการ ไม่ใช่ log ว่าใครยืนยันเมื่อไร; `data_confirm` คือประวัติ event แยกแถว สามารถมีหลายรายการ/ไม่มีผู้ยืนยันหรือเวลาได้
- `0` ที่บันทึกจริงคงเป็น 0; ช่องว่าง/NULL และแถวที่ไม่มีในตารางคงเป็นไม่มีข้อมูล การนำเข้าค่าตัวเลขว่างใน `data_all` ปัจจุบันรายงาน `blank_count_field` ไม่เติม 0
- ตารางข้อยกเว้นใหม่เก็บ hash แถวและ reason code ไม่คัดลอก payload ผู้ป่วย; บันทึก `legacy_account_ref` เฉพาะในตาราง history ที่จำเป็นต้องตรวจ mapping ไม่อ่าน/เก็บ `pass_login`
- `legacy_confirmation_records` เก็บสถานะ event เดิมแยกจากสถานะใหม่; API ประวัติรายการให้ `legacy_confirmed` โดยแสดง “ไม่พบข้อมูลผู้ยืนยัน/วันและเวลายืนยัน” เมื่อไม่มีหลักฐาน ห้ามสร้างค่าแทน
- การรันซ้ำของตัวนำเข้าเวรเดิมใช้ source crosswalk และ business key; history ใช้ hash ของแถวพร้อมลำดับ occurrence เพื่อรักษาแถวซ้ำที่ต้นทางมีจริงโดยไม่สร้างซ้ำเมื่อป้อนสำเนาเดิมและลำดับเดิม

## ชุดตัวเลขสมมติใช้ซ้ำ

ใช้ P1 v1 ใน [`parity-fixtures-phase-1.md`](parity-fixtures-phase-1.md): หอ A รหัส 10, B รหัส 11; เวร 1/2/3 = ดึก/เช้า/บ่าย; 31 ต.ค.–2 พ.ย. 2569; 13 แถว, C8/U5; A8, B5; B ขาดเช้า 1 พ.ย.; A ขาดเช้าและ B ขาดทั้งวัน 2 พ.ย.; เตียง A เปลี่ยน 20→25 ระหว่างวัน และ B=10; มีข้อมูลเสริม 5 แถวบ่าย, แผลกดทับ 4 แถว, readmit 4 หอ-เดือน, ข่าว 2 รายการตามข้อกำหนด P1

ค่าคาดหวังที่ตรวจมือได้:

| จุดตรวจ | ผลคาดหวัง |
|---|---|
| `data_all` ทั้งชุด | อ่าน 13; หอ A 8 (ยืนยัน 5/รอยืนยัน 3); B 5 (3/2); รวมยืนยัน 8/รอยืนยัน 5; ข้อมูลค้างรอยืนยัน 5 |
| `data_split_patient` | 5 แถวเวรบ่าย; ห้องสามัญรวม 11, ห้องพิเศษรวม 4 ตามค่าที่ต้องการกรอกใน fixture (แยกจากบั๊ก `manage_data.php` ที่จงใจต้องทดสอบคนละกรณี) |
| `pressure` | 4 แถว; รวม 3 ครั้ง/65 วันนอนเสี่ยง; พ.ย. 3/60 = 50 ต่อพัน; B 1 พ.ย. 0/0 ต้องคงแถวศูนย์และไม่มีตัวหาร |
| `readmit` | 4 แถว; พ.ย. 3/50 = 6%; เดือน ต.ค. A=1/20, B=0/10; เดือน พ.ย. A=2/40, B=1/10 |
| `data_confirm` สังเคราะห์สำหรับการย้าย | 3 event ตัวอย่าง: A 1 พ.ย. ดึก `2026-11-01 08:15:00`, legacy user `r-a`; A 1 พ.ย. เช้า เวลา/ผู้ใช้เป็นค่าว่าง; B 1 พ.ย. บ่าย user `orphan-7` แต่ไม่มี mapping. expected: 3 ประวัติ, 1 จับคู่ผู้ใช้, 1 ไม่มี actor/time, 1 unmapped account; ไม่เปลี่ยนยอด C/U ของ daily entries |
| ข่าวสมมติ | 2 แถว; ผู้ประกาศแสดงได้เฉพาะเมื่อ legacy id จับคู่บัญชีใหม่ได้; ไม่มี mappingต้องเป็นข้อยกเว้น |

P1 เป็นตัวเลขสังเคราะห์ที่ทดสอบด้วยมือเท่านั้น ไม่ใช่ค่าที่อ่านจากโรงพยาบาลหรือ dump จริง รายงานจริงจากฐานนำเข้าจะยังตรวจไม่ได้จนกว่าจะมี export ที่ได้รับอนุญาต

## ผลรันเฟส 5

แยกผลซ้อมจากข้อมูลจริง: dump จริงที่แนบมา (`inpatient/db/db_inpatient.sql`) มี 0 operational rows ใน 6 ตารางข้างต้น จึงอ่านจริง 0 / นำเข้าจริง 0 / ข้ามจริง 0; ไม่มีผลยอดก่อน–หลังของข้อมูลจริงให้รายงาน

**ผลซ้อมชุดข้อมูลสมมติ P1 ครบทั้ง 6 ตารางบนฐาน PostgreSQL แยก (25 พฤศจิกายน 2569):**

| ตารางต้นทาง → ปลายทาง | เครื่องมือ CLI | ผล dry-run / apply / รันซ้ำ | ผลกระทบยอด (reconciliation) และตรวจรายงานจริง |
|---|---|---|---|
| `data_all` → `daily_entries` | `import_legacy.py` / `reconcile_legacy.py` | dry-run คาดนำเข้า 13; apply อ่าน 13/นำเข้า 13/ข้าม 0/ผิด 0 (C8/U5); รันซ้ำ นำเข้า 0/ข้าม 13 | `match_status=match`; รายงาน `daily-all` ยอดคงเหลือ PT หอ A=12, รวม A+B=18 |
| `data_confirm` → `legacy_confirmation_records` | `import_legacy_confirmations.py` | dry-run คาดนำเข้า 3; apply นำเข้า 3/ข้าม 0/ผิด 0 (ข้อยกเว้น 2); รันซ้ำ นำเข้า 0/ข้าม 3 | ประวัติ 3 รายการ (จับคู่ผู้ใช้ 1, ไม่มีผู้ใช้ 2, ไม่มีเวลา 1); สถานะ C8/U5 ไม่ถูกเปลี่ยน |
| `data_split_patient` → `specialty_counts` | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table data_split_patient`) | dry-run คาดนำเข้า 5; apply อ่าน 5/นำเข้า 5 (130 เซลล์)/ข้าม 0/ผิด 0; รันซ้ำ นำเข้า 0/ข้าม 5 | `match_status=match` (สามัญรวม 11, พิเศษรวม 4); รายงาน `specialty` พ.ย. MED สามัญรวม 6, รวมทุกสาขาสามัญ 9 / พิเศษ 3 |
| `pressure` → `pressure_daily` | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table pressure`) | dry-run คาดนำเข้า 4; apply อ่าน 4/นำเข้า 4/ข้าม 0/ผิด 0; รันซ้ำ นำเข้า 0/ข้าม 4 | `match_status=match` (รวม 3 ครั้ง / 65 วันนอนเสี่ยง, แถว 0/0 จำนวน 1 แถว); รายงาน `pressure` หอ A พ.ย.=50.00, รวมปี=46.15, หอ B พ.ย.=ขีด (`null`); `pressure-detail` หอ A พ.ย. รวมเดือน 3/60/50.00 |
| `readmit` → `readmission_monthly` | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table readmit`) | dry-run คาดนำเข้า 4; apply อ่าน 4/นำเข้า 4/ข้าม 0/ผิด 0; รันซ้ำ นำเข้า 0/ข้าม 4 | `match_status=match` (รวมกลับมารักษาซ้ำ 4 / จำหน่าย 80, provenance `idate` ตรงทั้ง 4 แถว); รายงาน `readmission` พ.ย. หอ A=5.00%, หอ B=10.00%, รวม=6.00%, รวมปี=5.00% |
| `tb_news` → `announcements` | `import_legacy_supplements.py` / `reconcile_legacy_supplements.py` (`--table tb_news`) | dry-run คาดนำเข้า 2; apply อ่าน 2/นำเข้า 2/ข้าม 0/ผิด 0 (บันทึก `legacy_account_unmapped` 1 แถว); รันซ้ำ นำเข้า 0/ข้าม 2 | `match_status=match` (เผยแพร่ 1, ร่าง 1, จับคู่ผู้ประกาศ 1, ไม่พบ mapping 1); หน้าแรก `/` บัญชีหอเห็นเฉพาะ N1 พร้อมชื่อผู้ประกาศที่จับคู่ได้ ส่วนผู้ดูแลเห็นทั้ง N1 และ N2 (แสดง “ไม่พบข้อมูลผู้ประกาศเดิม” โดยไม่ปลอมชื่อผู้นำเข้า) |

**สิ่งที่ยังรอจากโรงพยาบาลก่อนย้ายข้อมูลจริง:** สำเนาฐานข้อมูลหรือไฟล์ส่งออก CSV จากฐานปฏิบัติงานจริงที่ฝ่ายไอทีรับรอง พร้อม manifest และตารางจับคู่บัญชี (`account-map.csv`) ของผู้ใช้งานจริง
