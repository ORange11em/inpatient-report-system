"use client";

import { useState } from "react";
import { Icon, Button, Card, FormField, TextInput, Select, NumberInput, StatusBadge, InfoCallout, EmptyState, ErrorState, Skeleton, Legend, InfoPopover, ShiftSelector, ThaiDatePicker, ThaiMonthPicker, DateRangePicker, FiscalYearSelect, PageHeader, FilterBar, DataTable, TableScroll, StickyActionBar, Dialog, ConfirmDialog, Drawer, BottomSheet, Toast } from "@/components/ui";
import { formatThaiDate, formatThaiMonth, formatThaiTime, formatThaiNumber, formatFiscalYear } from "@/lib/thai-date.mjs";

// TODO: เชื่อม API — ตัวเลขและชื่อทั้งหมดเป็นข้อมูลสมมติเพื่อทดสอบหน้าตาเท่านั้น
const exampleRows = [
  { id: "a", ward: "หอตัวอย่าง ก", count: 18, received: 4, status: "unconfirmed" },
  { id: "b", ward: "หอตัวอย่าง ข · ชื่อยาวสำหรับตรวจการแสดงผล", count: 12, received: 2, status: "confirmed" },
  { id: "c", ward: "หอตัวอย่าง ค", count: 7, received: 0, status: "unrecorded" },
];
const options = [{ value: "a", label: "หอตัวอย่าง ก" }, { value: "b", label: "หอตัวอย่าง ข" }, { value: "c", label: "หอตัวอย่าง ค (ปิดใช้งาน)", disabled: true }];
const shifts = [{ value: "morning", label: "เช้า", status: "confirmed" }, { value: "afternoon", label: "บ่าย", status: "unconfirmed" }, { value: "night", label: "ดึก", status: "unrecorded" }];
const columns = [{ key: "ward", label: "หอผู้ป่วย", sortable: true }, { key: "count", label: "จำนวนคงเหลือ", numeric: true, sortable: true, render: formatThaiNumber }, { key: "received", label: "รับใหม่", numeric: true, sortable: true }, { key: "status", label: "สถานะ", render: value => <StatusBadge status={value} /> }];
const sections = [["tokens", "สีและตัวอักษร"], ["buttons", "ปุ่มและไอคอน"], ["fields", "ช่องกรอก"], ["dates", "วันที่และเวร"], ["states", "สถานะ"], ["layouts", "หัวหน้าจอและตัวกรอง"], ["tables", "ตาราง"], ["overlays", "หน้าต่างและการแจ้งเตือน"]];
const tones = [["success", "สำเร็จ"], ["warning", "ควรตรวจสอบ"], ["danger", "เกิดข้อผิดพลาด"], ["info", "ข้อมูลเพิ่มเติม"], ["neutral", "ข้อมูลทั่วไป"]];

function Example({ title, children, note }) { return <div className="ui-kit-example"><h3>{title}</h3>{children}{note && <p className="ui-field-hint">{note}</p>}</div>; }
function Section({ id, number, title, description, children }) { return <section id={id} className="ui-kit-section" aria-labelledby={`${id}-title`}><div className="ui-kit-section-heading"><span className="ui-kit-number">{number}</span><div><h2 id={`${id}-title`}>{title}</h2><p className="ui-muted">{description}</p></div></div>{children}</section>; }

export default function UiKit() {
  const [number, setNumber] = useState("24");
  const [text, setText] = useState("");
  const [ward, setWard] = useState("a");
  const [date, setDate] = useState("2026-11-19");
  const [month, setMonth] = useState("2026-11");
  const [range, setRange] = useState({ from: "2026-11-13", to: "2026-11-19" });
  const [year, setYear] = useState(2570);
  const [shift, setShift] = useState("afternoon");
  const [overlay, setOverlay] = useState(null);
  const [toast, setToast] = useState(null);
  const [pending, setPending] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [applied, setApplied] = useState(false);
  const [barState, setBarState] = useState("normal");
  const notify = title => setToast({ title, tone: "success", description: "ตัวอย่างการแสดงผล ไม่มีการบันทึกข้อมูลจริง" });
  const close = () => setOverlay(null);
  function demoConfirm() { setPending(true); setTimeout(() => { setPending(false); setOverlay(null); notify("ดำเนินการตัวอย่างสำเร็จ"); }, 900); }

  return <div className="ui-kit-page"><a className="ui-skip-link" href="#kit-main">ข้ามไปเนื้อหาหลัก</a>
    <header className="ui-kit-topbar"><a className="ui-kit-brand" href="#kit-main"><span className="ui-kit-brand-mark">IP</span><div><strong>ระบบรายงานจำนวนผู้ป่วยใน</strong><span>พื้นฐานการออกแบบ</span></div></a><span className="ui-badge ui-tone--info">พื้นที่ตรวจงาน · เฟส 1</span></header>
    <main id="kit-main" className="ui-kit-main" tabIndex={-1}>
      <PageHeader title="ชุดองค์ประกอบหน้าจอ" description="ตรวจรูปแบบ สถานะ และการใช้งานร่วมกัน ก่อนนำไปใช้กับแต่ละหน้า" breadcrumbs={[{ label: "พื้นที่ตรวจงาน" }, { label: "พื้นฐานการออกแบบ" }]} actions={<Button variant="secondary" icon="refresh" onClick={() => window.location.reload()}>เริ่มตัวอย่างใหม่</Button>} />
      <InfoCallout title="ข้อมูลตัวอย่างทั้งหมด">หน้านี้เปิดได้เฉพาะโหมดพัฒนา ทดลองปุ่มและกรอกข้อมูลได้โดยไม่มีการบันทึกข้อมูลจริง เวลาเวรและคำอธิบายทางการพยาบาลยังรอการยืนยัน</InfoCallout>
      <nav className="ui-kit-toc" aria-label="หมวดองค์ประกอบ">{sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>

      <Section id="tokens" number="01" title="สี ตัวอักษร และระยะห่าง" description="โทนเขียวอมฟ้า อ่านภาษาไทยได้เต็มบรรทัด และแยกความหมายด้วยข้อความร่วมกับสี">
        <div className="ui-kit-grid"><Card title="ตัวอักษรไทย · Sarabun"><p className="ui-kit-heading-sample">บันทึกง่าย ตรวจทานชัดเจน</p><p>ตรวจพยัญชนะ สระบน สระล่าง และวรรณยุกต์ เช่น ผู้ป่วย น้ำเกลือ ผู้ให้การพยาบาล</p><p className="ui-muted">ข้อความรองยังอ่านได้ชัดเจนที่ขนาด 14 พิกเซล</p><p className="ui-kit-numbers">{formatThaiNumber(1234567)} <span>{formatThaiNumber(85, { percent: true })}</span></p><p className="ui-field-hint">ตัวเลขเรียงหลักตรงกัน · ร้อยละ 1 ตำแหน่ง</p></Card>
          <Card title="สีตามความหมาย"><div className="ui-kit-stack">{tones.map(([tone, label]) => <div className={`ui-kit-swatch ui-tone--${tone}`} key={tone}><span aria-hidden="true" /><strong>{label}</strong><span className="ui-field-hint">ข้อความ + สัญลักษณ์</span></div>)}</div></Card></div>
        <Card title="รูปแบบการ์ดและระยะห่าง"><div className="ui-kit-spacing" aria-label="ระยะห่างตามระบบ 4 และ 8 พิกเซล">{[1, 2, 3, 4, 6, 8].map(step => <div key={step}><span style={{ width: `var(--space-${step})` }} /><small>{step * 4} พิกเซล</small></div>)}</div><p className="ui-field-hint">การ์ดมุมมน 12 พิกเซล · ช่องกรอกและปุ่ม 8 พิกเซล · เป้าสัมผัสอย่างน้อย 44 พิกเซล</p></Card>
      </Section>

      <Section id="buttons" number="02" title="ปุ่มและไอคอน" description="ปุ่ม 4 รูปแบบ พร้อมปกติ ชี้เมาส์ โฟกัส ปิดใช้งาน และกำลังทำงาน">
        {[['primary', 'ปุ่มหลัก'], ['secondary', 'ปุ่มรอง'], ['ghost', 'ปุ่มเรียบ'], ['destructive', 'การดำเนินการที่ต้องระวัง']].map(([variant, title]) => <Card key={variant} title={title}><div className="ui-kit-button-states">
          <Example title="ปกติ"><Button variant={variant} icon={variant === "destructive" ? "warning" : "save"} onClick={() => notify("กดปุ่มตัวอย่างแล้ว")}>ดำเนินการ</Button></Example>
          <Example title="ชี้เมาส์"><Button variant={variant} className="is-preview-hover">ดำเนินการ</Button></Example>
          <Example title="โฟกัส"><Button variant={variant} className="is-preview-focus">ดำเนินการ</Button></Example>
          <Example title="ปิดใช้งาน"><Button variant={variant} disabled>ดำเนินการ</Button></Example>
          <Example title="กำลังทำงาน"><Button variant={variant} loading>กำลังบันทึก</Button></Example>
          <Example title="ไอคอนอย่างเดียว"><Button variant={variant} icon="plus" aria-label={`เพิ่มรายการด้วย${title}`} onClick={() => notify("เพิ่มรายการตัวอย่าง")} /></Example>
        </div></Card>)}
        <Card title="ชุดไอคอนกลาง"><div className="ui-kit-icons">{["check", "close", "chevron", "arrow", "calendar", "info", "warning", "error", "clock", "empty", "refresh", "filter", "more", "save", "lock", "plus", "sort"].map(name => <div key={name}><Icon name={name} /><code>{name}</code></div>)}</div></Card>
      </Section>

      <Section id="fields" number="03" title="ช่องกรอกและตัวเลือก" description="ทุกช่องมีชื่อ คำแนะนำ และข้อผิดพลาดที่เชื่อมกับช่องกรอก ใช้ค่าว่างและศูนย์ต่างกัน">
        <Card title="ข้อความ"><div className="ui-kit-fields"><TextInput label="ปกติ" placeholder="กรอกข้อความตัวอย่าง" value={text} onChange={event => setText(event.target.value)} hint="ลองกด Tab เพื่อดูเส้นโฟกัส" /><TextInput label="จำเป็นต้องกรอก" required defaultValue="ข้อความตัวอย่าง" /><TextInput label="มีข้อผิดพลาด" defaultValue="" error="กรุณากรอกข้อความให้ครบ" /><TextInput label="ปิดใช้งาน" defaultValue="ไม่สามารถแก้ไขได้" disabled /><TextInput label="อ่านอย่างเดียว" value="ข้อมูลสำหรับตรวจดู" readOnly /></div></Card>
        <Card title="ตัวเลือกแบบเดียวกันทั้งระบบ"><div className="ui-kit-fields"><Select label="หอผู้ป่วย" value={ward} onChange={event => setWard(event.target.value)} options={options} /><Select label="ยังไม่ได้เลือก" defaultValue="" placeholder="เลือกหอผู้ป่วย" options={options} required /><Select label="มีข้อผิดพลาด" value="" onChange={() => {}} placeholder="เลือกหอผู้ป่วย" options={options} error="กรุณาเลือกหอผู้ป่วย" /><Select label="ปิดใช้งาน" value="a" options={options} disabled /><Select label="อ่านอย่างเดียว" value="a" options={options} readOnly /></div></Card>
        <Card title="จำนวนเต็ม"><div className="ui-kit-fields"><NumberInput label="จำนวนตัวอย่าง" value={number} onChange={setNumber} hint="เลือกทั้งช่องเมื่อโฟกัส หมุนล้อเมาส์แล้วค่าไม่เปลี่ยน" /><NumberInput label="ค่าว่าง" value="" onChange={() => {}} required /><NumberInput label="ศูนย์" value="0" onChange={() => {}} /><NumberInput label="มีข้อผิดพลาด" value="" onChange={() => {}} error="กรุณากรอกจำนวนเต็มไม่ติดลบ" /><NumberInput label="ปิดใช้งาน" value="12" disabled /><NumberInput label="อ่านอย่างเดียว" value="12" readOnly /></div></Card>
        <Card title="ช่องกรอกแบบกำหนดเอง"><FormField label="หมายเหตุ" hint="ตัวอย่างการใช้ชื่อและคำอธิบายร่วมกัน">{field => <textarea {...field} className="ui-input" rows={3} placeholder="ข้อความสำหรับตรวจหน้าตาเท่านั้น" />}</FormField></Card>
      </Section>

      <Section id="dates" number="04" title="วันที่ไทย ปีงบประมาณ และเวร" description="แสดงปีพุทธศักราช พิมพ์วันที่ได้ทั้ง พ.ศ./ค.ศ. และเลือกจากปฏิทินได้">
        <Card title="วันที่"><div className="ui-kit-fields"><ThaiDatePicker label="วันที่เลือกได้" value={date} onChange={setDate} required /><ThaiDatePicker label="ยังไม่เลือกวันที่" value="" onChange={() => {}} /><ThaiDatePicker label="วันที่มีข้อผิดพลาด" value="" error="กรุณาเลือกวันที่ให้ถูกต้อง" /><ThaiDatePicker label="วันที่ปิดใช้งาน" value="2026-11-19" disabled /><ThaiDatePicker label="วันที่อ่านอย่างเดียว" value="2026-11-19" readOnly /></div></Card>
        <Card title="เดือนและปีงบประมาณ"><div className="ui-kit-fields"><ThaiMonthPicker value={month} onChange={setMonth} /><ThaiMonthPicker label="เดือนที่มีข้อผิดพลาด" value="" error="กรุณาเลือกเดือน" /><ThaiMonthPicker label="เดือนปิดใช้งาน" value={month} disabled /><ThaiMonthPicker label="เดือนอ่านอย่างเดียว" value={month} readOnly /><FiscalYearSelect value={year} onChange={setYear} /><FiscalYearSelect label="ปีงบประมาณปิดใช้งาน" value={year} disabled /><FiscalYearSelect label="ปีงบประมาณอ่านอย่างเดียว" value={year} readOnly /><FiscalYearSelect label="ปีงบประมาณมีข้อผิดพลาด" value={year} error="กรุณาตรวจปีงบประมาณ" /></div></Card>
        <Card title="ช่วงวันที่"><DateRangePicker value={range} onChange={setRange} anchor="2026-11-19" /><details className="ui-kit-details"><summary>ดูช่วงวันที่ในสถานะเพิ่มเติม</summary><div className="ui-kit-stack"><DateRangePicker label="ช่วงวันที่มีข้อผิดพลาด" value={{ from: "2026-11-19", to: "2026-11-13" }} onChange={() => {}} /><DateRangePicker label="ช่วงวันที่ปิดใช้งาน" value={range} disabled /><DateRangePicker label="ช่วงวันที่อ่านอย่างเดียว" value={range} readOnly /></div></details></Card>
        <Card title="เวร"><ShiftSelector options={shifts} value={shift} onChange={setShift} /><p className="ui-field-hint">ตัวอย่างสถานะเท่านั้น ช่วงเวลาเวรรอการยืนยันจากเจ้าของงาน</p><div className="ui-kit-divider" /><ShiftSelector label="เวรปิดใช้งาน" options={shifts} value="morning" disabled /><div className="ui-kit-divider" /><ShiftSelector label="ยังไม่ได้เลือกเวร" options={shifts.map(option => ({ ...option, status: undefined }))} value="" onChange={setShift} /></Card>
        <Card title="รูปแบบวันที่และตัวเลขกลาง"><dl className="ui-kit-format-list"><div><dt>วันที่</dt><dd>{formatThaiDate(date)}</dd></div><div><dt>เดือน</dt><dd>{formatThaiMonth(month)}</dd></div><div><dt>เดือนแบบสั้น</dt><dd>{formatThaiMonth(month, { short: true, shortYear: true })}</dd></div><div><dt>เวลา</dt><dd>{formatThaiTime("14:30")}</dd></div><div><dt>ปีงบประมาณ</dt><dd>{formatFiscalYear(year)}</dd></div><div><dt>ไม่มีข้อมูล</dt><dd>{formatThaiDate("")}</dd></div></dl></Card>
      </Section>

      <Section id="states" number="05" title="สถานะและคำอธิบาย" description="ใช้สัญลักษณ์และข้อความร่วมกับสี แสดงสถานะการโหลด ไม่มีข้อมูล และข้อผิดพลาด">
        <Card title="ป้ายสถานะ"><div className="ui-actions">{["unrecorded", "overdue", "unconfirmed", "confirmed", "readonly", "unknown"].map(status => <StatusBadge key={status} status={status} />)}</div><p className="ui-field-hint">ป้ายเลยกำหนดเป็นตัวอย่างหน้าตา ไม่มีกฎตัดรอบจริงในหน้านี้</p></Card>
        <div className="ui-kit-grid"><Card title="ยังไม่มีข้อมูล"><EmptyState action={<Button variant="secondary" icon="plus" onClick={() => notify("เริ่มรายการตัวอย่าง")}>เริ่มเพิ่มรายการ</Button>} /></Card><Card title="เกิดข้อผิดพลาด"><ErrorState onRetry={() => notify("ลองใหม่ในตัวอย่างแล้ว")} /></Card><Card title="กำลังลองใหม่"><ErrorState loading onRetry={() => {}} /></Card><Card title="กำลังโหลด"><Skeleton lines={4} /></Card></div>
        <Card title="กล่องข้อมูลและคำอธิบาย"><div className="ui-kit-stack">{tones.map(([tone, title]) => <InfoCallout key={tone} {...{ tone, title }}>ข้อความประกอบสถานะ ช่วยบอกสิ่งที่ควรทำต่อให้ชัดเจน</InfoCallout>)}<div className="ui-actions"><strong>คำอธิบายเพิ่มเติม</strong><InfoPopover>แตะเพื่ออ่านได้บนจอสัมผัส กด Esc หรือแตะด้านนอกเพื่อปิด</InfoPopover></div><Legend items={[{ icon: "clock", label: "รอยืนยัน", description: "บันทึกข้อมูลแล้ว" }, { icon: "lock", label: "อ่านอย่างเดียว", description: "ไม่สามารถแก้ไขในขณะนี้" }]} /></div></Card>
      </Section>

      <Section id="layouts" number="06" title="หัวหน้าจอและตัวกรอง" description="จัดปุ่มไว้ด้านขวาบนจอใหญ่ มือถือรวมปุ่มในเมนูและเปิดตัวกรองเป็นแผงด้านล่าง">
        <Card><PageHeader title="ชื่อหน้าตัวอย่าง" description="คำอธิบายงานที่ต้องทำภายในหนึ่งบรรทัด" breadcrumbs={[{ label: "ชุดองค์ประกอบ", href: "#kit-main" }, { label: "หน้าตัวอย่าง" }]} actions={<><Button icon="plus" onClick={() => notify("เพิ่มรายการตัวอย่าง")}>เพิ่มรายการ</Button><Button variant="secondary" onClick={() => notify("เปิดดูตัวอย่าง")}>เปิดดู</Button></>} /></Card>
        <Card title="ตัวกรองข้อมูล"><FilterBar syncToUrl query={{ sampleWard: ward, sampleStatus: filterStatus }} onApply={() => setApplied(true)} onReset={() => { setWard("a"); setFilterStatus(""); setApplied(false); }} chips={[{ label: options.find(option => option.value === ward)?.label || "ทุกหอตัวอย่าง" }, ...(filterStatus ? [{ label: filterStatus === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน", onRemove: () => setFilterStatus("") }] : [])]}>
          <Select label="เลือกหอผู้ป่วย" options={options} value={ward} onChange={event => setWard(event.target.value)} /><Select label="สถานะข้อมูล" options={[{ value: "", label: "ทั้งหมด" }, { value: "unconfirmed", label: "รอยืนยัน" }, { value: "confirmed", label: "ยืนยันแล้ว" }]} value={filterStatus} onChange={event => setFilterStatus(event.target.value)} />
        </FilterBar>{applied && <p className="ui-field-hint" role="status">ใช้ตัวกรองตัวอย่างแล้ว</p>}</Card>
        <Card title="ตัวกรองขณะกำลังโหลด"><FilterBar loading onReset={() => {}}><Select label="หอผู้ป่วยระหว่างโหลด" value="a" options={options} disabled /></FilterBar></Card>
      </Section>

      <Section id="tables" number="07" title="ตารางและมุมมองการ์ด" description="เรียงลำดับได้ เลื่อนในกรอบ หัวตารางและคอลัมน์แรกค้างอยู่ มือถือสลับเป็นการ์ดได้">
        <Card title="มีข้อมูลและแถวรวม"><DataTable label="จำนวนผู้ป่วยตัวอย่าง" columns={columns} rows={exampleRows} summary={{ ward: "รวมตัวอย่าง", count: 37, received: 6, status: "readonly" }} /></Card>
        <div className="ui-kit-grid">{[["loading", "ตารางกำลังโหลด"], ["empty", "ตารางไม่มีข้อมูล"], ["error", "ตารางมีข้อผิดพลาด"]].map(([state, title]) => <Card title={title} key={state}><DataTable columns={columns} rows={[]} state={state} onRetry={() => notify("ลองโหลดตารางตัวอย่างแล้ว")} /></Card>)}</div>
        <Card title="กรอบสำหรับตารางทั่วไป"><TableScroll label="คำอธิบายฟิลด์ตัวอย่าง"><table className="ui-table"><thead><tr><th>รายการ</th><th>คำอธิบาย</th></tr></thead><tbody><tr><th scope="row">จำนวนตัวอย่าง</th><td>เลื่อนภายในกรอบได้โดยไม่ทำให้หน้าจอกว้างเกิน</td></tr></tbody></table></TableScroll></Card>
      </Section>

      <Section id="overlays" number="08" title="หน้าต่าง แผง และข้อความแจ้งเตือน" description="ทดลองเปิด ปิดด้วย Esc/พื้นหลัง และใช้ Tab ภายในหน้าต่าง เมื่อปิดแล้วโฟกัสกลับไปที่ปุ่มเดิม">
        <Card title="หน้าต่างโต้ตอบ"><div className="ui-actions"><Button variant="secondary" onClick={() => setOverlay("dialog")}>เปิดหน้าต่างทั่วไป</Button><Button onClick={() => setOverlay("confirm")}>เปิดยืนยัน</Button><Button variant="destructive" onClick={() => setOverlay("destructive")}>เปิดยืนยันแบบระวัง</Button><Button variant="secondary" onClick={() => setOverlay("drawer")}>เปิดแผงด้านข้าง</Button><Button variant="secondary" onClick={() => setOverlay("sheet")}>เปิดแผงด้านล่าง</Button></div><p className="ui-field-hint">ปุ่มยืนยันแสดงสถานะกำลังทำงานก่อนปิดหน้าต่าง ใช้ข้อมูลตัวอย่างเท่านั้น</p></Card>
        <Card title="ข้อความแจ้งเตือนทุกสถานะ"><div className="ui-kit-stack">{tones.filter(([tone]) => tone !== "neutral").map(([tone, title]) => <Toast key={tone} {...{ tone, title }} description="ข้อความแจ้งผลพร้อมคำแนะนำสั้น ๆ" onClose={() => notify("ปิดข้อความตัวอย่างแล้ว")} />)}<Button variant="secondary" onClick={() => notify("บันทึกตัวอย่างแล้ว")}>ทดลองแจ้งผลและปิดข้อความ</Button></div></Card>
        <Card title="แถบการดำเนินการด้านล่าง"><Select label="สถานะแถบการดำเนินการ" value={barState} onChange={event => setBarState(event.target.value)} options={[{ value: "normal", label: "มีการแก้ไขที่ยังไม่บันทึก" }, { value: "loading", label: "กำลังบันทึก" }, { value: "disabled", label: "อ่านอย่างเดียว" }, { value: "saved", label: "บันทึกแล้ว" }]} /></Card>
      </Section>
      <StickyActionBar summary={<div><strong>{barState === "saved" ? "บันทึกล่าสุด 14:32 น." : barState === "disabled" ? "ข้อมูลนี้อ่านอย่างเดียว" : barState === "loading" ? "กำลังบันทึกข้อมูลตัวอย่าง" : "มีการแก้ไขที่ยังไม่บันทึก"}</strong><p className="ui-field-hint">ข้อมูลตัวอย่าง · ไม่มีการบันทึกข้อมูลจริง</p></div>}><Button icon="save" loading={barState === "loading"} disabled={barState === "disabled"} onClick={() => { setBarState("saved"); notify("บันทึกตัวอย่างสำเร็จ"); }}>บันทึกข้อมูล</Button></StickyActionBar>
      <footer className="ui-kit-footer">พื้นฐานการออกแบบ · เฟส 1 · สถานะและตัวเลขทั้งหมดใช้สำหรับตรวจงาน</footer>
    </main>
    <Dialog open={overlay === "dialog"} onClose={close} title="หน้าต่างตัวอย่าง" description="ลองใช้คีย์บอร์ด Tab และ Shift+Tab ภายในหน้าต่าง" actions={<Button onClick={close}>เสร็จสิ้น</Button>}><TextInput label="ข้อความในหน้าต่าง" placeholder="ลองกรอกข้อความ" /><p>กด Esc หรือแตะพื้นหลังเพื่อปิด</p></Dialog>
    <ConfirmDialog open={["confirm", "destructive"].includes(overlay)} onClose={close} onConfirm={demoConfirm} title={overlay === "destructive" ? "ลบรายการตัวอย่างหรือไม่?" : "ยืนยันรายการตัวอย่างหรือไม่?"} description="การดำเนินการนี้เป็นเพียงตัวอย่างเพื่อทดสอบรูปแบบหน้าต่าง" destructive={overlay === "destructive"} loading={pending} confirmLabel={overlay === "destructive" ? "ลบตัวอย่าง" : "ยืนยันตัวอย่าง"} />
    <Drawer open={overlay === "drawer"} onClose={close} title="เมนูตัวอย่าง"><nav className="ui-kit-drawer-links" aria-label="เมนูภายในหน้าตัวอย่าง">{sections.map(([id, label]) => <a href={`#${id}`} onClick={close} key={id}>{label}<Icon name="arrow" /></a>)}</nav></Drawer>
    <BottomSheet open={overlay === "sheet"} onClose={close} title="แผงตัวเลือกตัวอย่าง" actions={<Button onClick={() => { close(); notify("ใช้ตัวเลือกตัวอย่างแล้ว"); }}>ใช้ตัวเลือกนี้</Button>}><Select label="หอผู้ป่วยในแผง" value={ward} options={options} onChange={event => setWard(event.target.value)} /></BottomSheet>
    <div className="ui-kit-floating-toast"><Toast open={Boolean(toast)} {...toast} onClose={() => setToast(null)} /></div>
  </div>;
}
