-- อ่านอย่างเดียวสำหรับสำเนา MySQL/MariaDB ที่ฝ่ายไอทีอนุญาต
-- ไม่มี USE, INSERT, UPDATE, DELETE, DDL, credential หรือข้อมูลผู้ป่วย
-- ให้เลือกฐานสำเนาด้วย client ก่อนรัน ห้ามนำ SQL dump เดิมมารันแทนไฟล์นี้
-- MyISAM ไม่รับประกัน consistent snapshot: ต้องใช้สำเนาที่หยุดเปลี่ยนแปลงแล้ว
SELECT VERSION() AS database_version, DATABASE() AS selected_database, NOW() AS checked_at;

SELECT 'data_all' AS source_table, COUNT(*) AS row_count,
 MIN(idate) AS first_date_raw, MAX(idate) AS last_date_raw,
 COUNT(*)-COUNT(idate) AS null_dates,
 COALESCE(SUM(CAST(idate AS CHAR)='0000-00-00'),0) AS zero_dates FROM data_all
UNION ALL SELECT 'data_confirm',COUNT(*),MIN(idate),MAX(idate),COUNT(*)-COUNT(idate),
 COALESCE(SUM(CAST(idate AS CHAR)='0000-00-00'),0) FROM data_confirm
UNION ALL SELECT 'data_split_patient',COUNT(*),MIN(idate),MAX(idate),COUNT(*)-COUNT(idate),
 COALESCE(SUM(CAST(idate AS CHAR)='0000-00-00'),0) FROM data_split_patient
UNION ALL SELECT 'pressure',COUNT(*),MIN(idate),MAX(idate),COUNT(*)-COUNT(idate),
 COALESCE(SUM(CAST(idate AS CHAR)='0000-00-00'),0) FROM pressure
UNION ALL SELECT 'readmit',COUNT(*),MIN(idate),MAX(idate),COUNT(*)-COUNT(idate),
 COALESCE(SUM(CAST(idate AS CHAR)='0000-00-00'),0) FROM readmit
UNION ALL SELECT 'tb_news',COUNT(*),MIN(date_news),MAX(date_news),COUNT(*)-COUNT(date_news),
 COALESCE(SUM(CAST(date_news AS CHAR)='0000-00-00'),0) FROM tb_news;

-- วันที่ยืนยันกับเดือนรายงานเป็นคนละความหมายกับวันรายการ/วันแก้ไข
SELECT MIN(cdate) AS first_confirmation_time, MAX(cdate) AS last_confirmation_time,
 COUNT(*)-COUNT(cdate) AS missing_time,
 COALESCE(SUM(cuser IS NULL OR TRIM(cuser)=''),0) AS missing_actor FROM data_confirm;
SELECT MIN(NULLIF(month1,'')) AS first_reporting_month,
 MAX(NULLIF(month1,'')) AS last_reporting_month,
 COALESCE(SUM(month1 IS NULL OR TRIM(month1)=''),0) AS missing_month,
 COALESCE(SUM(month1 NOT REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),0) AS malformed_month FROM readmit;

-- เฉพาะข้อมูลอ้างอิง ไม่อ่าน account/pass_login
SELECT ward,name,ward_group,ordering,bedcount FROM ward ORDER BY ward;
SELECT wage_type_id,wage_type_name FROM wage_type ORDER BY wage_type_id;
SELECT ward,COUNT(*) AS occurrences FROM ward GROUP BY ward HAVING COUNT(*)>1;
SELECT wage_type_id,COUNT(*) AS occurrences FROM wage_type GROUP BY wage_type_id HAVING COUNT(*)>1;

-- ตรวจคีย์ที่ใช้จริงก่อนนำเข้า ไม่ JOIN reference แล้วเพิ่มจำนวนแถว
SELECT ward,wage_type_id,COUNT(*) AS row_count,MIN(idate) AS first_date,MAX(idate) AS last_date
 FROM data_all GROUP BY ward,wage_type_id ORDER BY ward,wage_type_id;
SELECT COUNT(*) AS rows_without_ward FROM data_all d
 WHERE NOT EXISTS(SELECT 1 FROM ward w WHERE w.ward=d.ward);
SELECT COUNT(*) AS rows_without_shift FROM data_all d
 WHERE NOT EXISTS(SELECT 1 FROM wage_type s WHERE s.wage_type_id=d.wage_type_id);
SELECT ward,idate,wage_type_id,COUNT(*) AS occurrences FROM data_all
 GROUP BY ward,idate,wage_type_id HAVING COUNT(*)>1;
-- ประวัติยืนยันซ้ำอาจเป็นเหตุการณ์จริง ให้ตรวจและคงไว้ ไม่ลบทิ้ง
SELECT ward,idate,wage_type_id,COUNT(*) AS event_count FROM data_confirm
 GROUP BY ward,idate,wage_type_id HAVING COUNT(*)>1;
SELECT ward,idate,COUNT(*) AS occurrences FROM data_split_patient
 GROUP BY ward,idate HAVING COUNT(*)>1;
SELECT COUNT(*) AS specialty_rows_without_afternoon_entry FROM data_split_patient d
 WHERE NOT EXISTS(SELECT 1 FROM data_all a WHERE a.ward=d.ward AND a.idate=d.idate AND a.wage_type_id=3);
SELECT COUNT(*) AS pressure_rows_without_afternoon_entry FROM pressure d
 WHERE NOT EXISTS(SELECT 1 FROM data_all a WHERE a.ward=d.ward AND a.idate=d.idate AND a.wage_type_id=3);
SELECT COUNT(*) AS confirmation_rows_without_entry FROM data_confirm d
 WHERE NOT EXISTS(SELECT 1 FROM data_all a
 WHERE a.ward=d.ward AND a.idate=d.idate AND a.wage_type_id=d.wage_type_id);

-- กระทบยอดหอ/วัน/เวร; SUM คง NULL เมื่อทั้งกลุ่มไม่มีค่า พร้อมจำนวน NULL
SELECT ward,idate,wage_type_id,COUNT(*) AS row_count,
 SUM(on_pt) AS on_pt,SUM(in_pt) AS in_pt,SUM(move_pt) AS move_pt,
 SUM(home_pt) AS home_pt,SUM(move_b_pt) AS move_b_pt,SUM(send_pt) AS send_pt,
 SUM(dead_pt) AS dead_pt,SUM(non_voluntary_pt) AS non_voluntary_pt,SUM(ad_pt) AS ad_pt,
 SUM(on_nb) AS on_nb,SUM(in_nb) AS in_nb,SUM(move_nb) AS move_nb,
 SUM(home_nb) AS home_nb,SUM(move_b_nb) AS move_b_nb,SUM(send_nb) AS send_nb,
 SUM(dead_nb) AS dead_nb,SUM(non_voluntary_nb) AS non_voluntary_nb,SUM(ad_nb) AS ad_nb,
 SUM(patient_type1) AS patient_type1,SUM(patient_type2) AS patient_type2,
 SUM(patient_type3) AS patient_type3,SUM(patient_type4) AS patient_type4,SUM(patient_type5) AS patient_type5,
 SUM(em_hn) AS em_hn,SUM(em_rn) AS em_rn,SUM(em_tn) AS em_tn,SUM(em_pn) AS em_pn,SUM(em_aid) AS em_aid,
 COUNT(*)-COUNT(on_pt) AS on_pt_nulls,COUNT(*)-COUNT(amount_bed) AS bed_nulls,
 MIN(amount_bed) AS min_beds,MAX(amount_bed) AS max_beds,
 SUM(i_status=1) AS confirmed_rows,SUM(i_status=0 OR i_status IS NULL) AS unconfirmed_rows
 FROM data_all GROUP BY ward,idate,wage_type_id ORDER BY ward,idate,wage_type_id;

-- แผลกดทับ/รายเดือน ห้ามเฉลี่ยอัตราหรือเติม NULL ด้วยศูนย์
SELECT ward,idate,COUNT(*) AS row_count,SUM(do_pressure) AS cases,SUM(risk_pressure) AS risk_days,
 COUNT(*)-COUNT(do_pressure) AS cases_nulls,COUNT(*)-COUNT(risk_pressure) AS risk_nulls
 FROM pressure GROUP BY ward,idate ORDER BY ward,idate;
SELECT ward,month1,COUNT(*) AS row_count,SUM(readmit_amount) AS readmit_count,
 SUM(discharge_amount) AS discharge_count,COUNT(*)-COUNT(readmit_amount) AS readmit_nulls,
 COUNT(*)-COUNT(discharge_amount) AS discharge_nulls
 FROM readmit GROUP BY ward,month1 ORDER BY ward,month1;
