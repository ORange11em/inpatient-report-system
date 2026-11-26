ระบบหน้าบ้าน Next.js/JavaScript สำหรับบันทึกข้อมูลราย ward โดยเรียกข้อมูลผ่าน HTTP API ของ Python backend เท่านั้น ไม่เชื่อมต่อฐานข้อมูลและไม่เก็บ session/CSRF token ใน localStorage

## เปิดระบบในเครื่อง

ใช้ Node.js 20.9 ขึ้นไป จาก PowerShell:

    npm install
    $env:BACKEND_API_URL = "http://127.0.0.1:8000"
    npm run dev

ให้เปิด backend ในอีกหน้าต่าง terminal ที่ port 8000 ก่อน แล้วเข้า http://localhost:3000 หน้าบ้าน proxy คำขอ /api/v1 ไป Python API ตาม Next rewrite ใน next.config.mjs ตัวแปร BACKEND_API_URL เป็น address ไม่ใช่ credential

ในเครื่องพัฒนาที่มี API เปิดพร้อมกันสองรุ่น Next.js dev ใช้ `INPATIENT_DEV_API_URL` ใน .env.development.local เพื่อเลือก backend ของโครงการนี้ ค่าที่ใช้กับรุ่นนี้ในเครื่องคือ http://127.0.0.1:18763 และเปิดหน้าบ้านที่ http://localhost:3000 หากเริ่ม API ใหม่ให้ระบุพอร์ตเดียวกับค่าที่ตั้งไว้

## หน้าจอ

- /login: เข้าสู่ระบบด้วย session cookie จาก API
- /entries: เลือก ward/วันที่/เวร เปิดรายการเดิมหรือสร้างใหม่ แก้ไขและยืนยันรายการที่ยังไม่ยืนยัน
- /indicators: อ่าน/บันทึก pressure รายวัน และ readmit/discharge รายเดือน ผ่าน API indicators
- /history: ค้นประวัติตาม ward วันที่ และสถานะ; การส่งกลับแก้ไขให้ API ตรวจสิทธิ์ผู้ดูแล
- /reports เปิด พิมพ์ และส่งออกรายงานตามหอ ช่วงเวลา และสถานะ
- /occupancy เปิดรายงานครองเตียงตามปีงบประมาณ
- / ข่าวประกาศที่เผยแพร่และเครื่องมือจัดการสำหรับผู้ดูแล

รายละเอียดการยกยอด เงื่อนไขเวรบ่าย รีแอดมิต และผลทดสอบอยู่ใน [ผลตรวจเทียบ](../INPATIENT_PARITY_TH.md)
