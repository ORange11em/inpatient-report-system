import test from "node:test";
import assert from "node:assert/strict";
import { dailyReportSummary, defaultReportFilters, displayedReportCell, occupancyDelta, occupancyTable, pressureDrilldownTarget, printColumnGroups, reportCatalog, reportCellValue, reportColumnLabel, reportFilename, reportForChannel, reportHasData, reportPeriod, spreadsheetXML, wardDisplayMeta } from "../lib/report-view.mjs";

test("รายงานที่มีแต่ชื่อหอกับ null ยังไม่มีข้อมูล แต่ศูนย์และจำนวนเวรที่ขาดเป็นข้อมูลจริง", () => {
  assert.equal(reportHasData({kind:"los",rows:[["หอตัวอย่าง",null,null]]}),false);
  assert.equal(reportHasData({kind:"los",rows:[["หอตัวอย่าง",0,null]]}),true);
  assert.equal(reportHasData({kind:"occupancy",occupancy:{wards:[{}]}}),true);
  assert.equal(reportHasData({kind:"occupancy",occupancy:{wards:[]}}),false);
});

test("คงรายงาน 15 ประเภท และแปลงชื่อไฟล์ทั้งวัน/เดือน/ช่วง/ปีงบประมาณเป็น พ.ศ.", () => {
  assert.equal(Object.keys(reportCatalog).length,15);
  for (const kind of Object.keys(reportCatalog)) {
    const filters=defaultReportFilters(kind,"2026-11-19"),result={kind,title:reportCatalog[kind][0],filters};
    const filename=reportFilename(result);
    assert.match(filename,/\.xml$/);assert.doesNotMatch(filename,/2026|2027/);
    assert.match(filename,reportCatalog[kind][1]==="year"?/2570/:/2569/);
    assert.doesNotMatch(reportPeriod(filters),/2026|2027/);
  }
});
test("แปลงเฉพาะตำแหน่งวันที่ ไม่แก้ชื่อหอ ข้อความอื่น หรือค่าตัวเลข", () => {
  assert.equal(reportCellValue("2026-11-19","วันที่"),"19 พ.ย. 2569");
  assert.equal(reportCellValue("2026-11-01 – 2026-11-30","วันที่ / ช่วง"),"1 พ.ย. 2569 - 30 พ.ย. 2569");
  assert.equal(reportCellValue("2026-11-19","เวร"),"2026-11-19");
  assert.equal(reportCellValue(83.123,"ครองเตียง (%)"),83.123);
  assert.equal(reportColumnLabel("10/2569"),"ต.ค. 69");
  assert.equal(reportColumnLabel("2027-09"),"ก.ย. 70");
  assert.equal(displayedReportCell(null,"ครองเตียง (%)","daily"),"—");
  assert.equal(displayedReportCell(0,"ครองเตียง (%)","daily"),"0.00");
});
test("ใช้ผลพิมพ์/ส่งออกของช่องทางนั้นและคงบริบท ห้ามดึงผลหน้าจอมาแทน", () => {
  const screen={kind:"productivity",title:"ทดสอบ",filters:{month:"2026-11"},columns:["หอผู้ป่วย","1"],rows:[["สมมติ",46.43]],channels:{print:{columns:["หอผู้ป่วย","1"],rows:[["สมมติ",35.71]]},excel:{columns:["หอผู้ป่วย","1"],rows:[["สมมติ",35.71]]}}};
  assert.equal(reportForChannel(screen,"print").rows[0][1],35.71);assert.equal(reportForChannel(screen,"print").title,"ทดสอบ");
  assert.match(spreadsheetXML({...reportForChannel(screen,"excel"),period:"พ.ย. 2569"}),/>35.71</);
  assert.equal(screen.rows[0][1],46.43);assert.equal(reportForChannel(screen,"screen"),screen);
  assert.equal(displayedReportCell(11.5,"เฉลี่ยนอน PT","monthly"),"11.500");assert.equal(displayedReportCell(50,"อัตราต่อ 1,000 วันนอน","pressure-detail"),"50.00");
});
test("ปฏิทินแผลกดทับที่ยังไม่บันทึกแสดงวันได้โดยไม่สร้างศูนย์", () => {
  assert.equal(reportHasData({kind:"pressure-detail",rows:[["สมมติ","2026-11-01",null,null,null,"ยังไม่บันทึก"]]}),true);
  assert.equal(reportHasData({kind:"pressure-detail",rows:[]}),false);
});
test("XML คงตัวเลขจริงและ null ไม่แปลงเป็นศูนย์ พร้อม escape ข้อความ", () => {
  const result={title:"รายงาน & ทดสอบ",period:"พฤศจิกายน 2569",columns:["หอผู้ป่วย","วันที่","จำนวน","ร้อยละ","ไม่มีข้อมูล"],rows:[["  หอ ก  ","2026-11-19",1234,83.123,null],["<ตัวอย่าง>","2026-11-20",0,0,null]]};
  const xml=spreadsheetXML(result);
  assert.match(xml,/รายงาน &amp; ทดสอบ/);assert.match(xml,/&lt;ตัวอย่าง&gt;/);
  assert.match(xml,/ss:Type="Number">1234</);assert.match(xml,/ss:Type="Number">83\.123</);assert.match(xml,/ss:Type="Number">0</);
  assert.match(xml,/ss:Type="String"><\/Data>/);assert.doesNotMatch(xml,/2026-11/);
  assert.equal(result.rows[0][0],"  หอ ก  ");assert.equal(result.rows[0][3],83.123);
});
test("adapter ครองเตียงใช้ complete/null/ตัวหารและยอดรวมเดิม", () => {
  const ward={name:"หอตัวอย่าง",months:[{complete:true,bed_rate:0},{complete:true,bed_rate:null},{complete:false,num_record:45,num_all_record:93,bed_rate:999}],fiscal_year:{complete:false,sum_record:45,sum_all_record:1095},previous_fiscal_year:{complete:true,average:87.123}};
  const report={months:["2026-10","2026-11","2026-12"],wards:[ward],total:ward};
  const table=occupancyTable(report);
  assert.deepEqual(table.rows[0],["หอตัวอย่าง",0,null,"45/93 เวร","45/1095 เวร",87.123]);
  assert.equal(table.rows[1][0],"รวมทุกหอที่มีสิทธิ์");
  assert.equal(occupancyDelta({complete:true,average:90},{complete:true,average:85}),5);
  assert.equal(occupancyDelta({complete:false,average:90},{complete:true,average:85}),null);
  assert.equal(occupancyDelta({complete:true,average:null},{complete:true,average:85}),null);
});
test("แบ่งคอลัมน์พิมพ์ไม่ทำข้อมูลหาย และทวนบริบทเดิมทุกชุด", () => {
  const result={kind:"daily",columns:Array.from({length:49},(_,i)=>String(i))},groups=printColumnGroups(result);
  assert.ok(groups.length>1);for(const group of groups){assert.deepEqual(group.slice(0,3),[0,1,2]);assert.ok(group.length<=12);}
  assert.deepEqual([...new Set(groups.flat())].sort((a,b)=>a-b),Array.from({length:49},(_,i)=>i));
  assert.equal(printColumnGroups({kind:"occupancy",columns:Array(15)}).length,1);
});
test("สรุปรายวันใช้คงเหลือเวรล่าสุดต่อหอ ไม่รวมยอดตั้งต้นหลายเวร", () => {
  const wards=[{id:"a"},{id:"b"}],shifts=[{id:73,legacy_shift_id:3,is_active:true},{id:11,legacy_shift_id:1,is_active:true}];
  const entries=[{ward_id:"a",shift_type_id:11,pt_on:10,pt_in:2,amount_bed:20,status:"confirmed"},{ward_id:"a",shift_type_id:73,pt_on:12,pt_in:3,pt_home:1,amount_bed:20,status:"unconfirmed"}];
  const summary=dailyReportSummary(entries,wards,shifts,defaultReportFilters("daily","2026-11-19"));
  assert.equal(summary.closing,14);assert.equal(summary.received,5);assert.equal(summary.discharged,1);assert.equal(summary.vacant,6);assert.equal(summary.occupancy,70);assert.equal(summary.complete.length,1);assert.equal(summary.missing.length,1);
  const filtered=dailyReportSummary(entries,wards,shifts,{...defaultReportFilters(),status:"confirmed"});assert.equal(filtered.closing,12);assert.equal(filtered.complete.length,0);
  entries[1].amount_bed=null;assert.equal(dailyReportSummary(entries,wards,shifts,defaultReportFilters()).vacant,null);
  entries.push({...entries[0],shift_type_id:999});assert.equal(dailyReportSummary(entries,wards,shifts,defaultReportFilters()).available,false);
});
test("ลิงก์เจาะดูรายละเอียดแผลกดทับรายวันทำงานเฉพาะช่องตัวเลขรายเดือนของหอที่มีสิทธิ์", () => {
  const wards = [
    { id: "ward-10", name: "อายุรกรรมชาย", short_name: "อช", legacy_code: "10" },
    { id: "ward-22", name: "สังเกตุอาการณ์", short_name: null, legacy_code: "22" },
  ];
  const valid = pressureDrilldownTarget("pressure", "11/2569", "อายุรกรรมชาย", 50, wards);
  assert.deepEqual(valid, {
    wardId: "ward-10",
    wardName: "อายุรกรรมชาย",
    month: "2026-11",
    href: "/reports?kind=pressure-detail&ward=ward-10&month=2026-11",
  });
  const zeroRate = pressureDrilldownTarget("pressure", "10/2569", "อายุรกรรมชาย", 0, wards);
  assert.equal(zeroRate?.href, "/reports?kind=pressure-detail&ward=ward-10&month=2026-10");
  assert.equal(pressureDrilldownTarget("pressure", "11/2569", "อายุรกรรมชาย", null, wards), null);
  assert.equal(pressureDrilldownTarget("pressure", "รวมปี", "อายุรกรรมชาย", 46.15, wards), null);
  assert.equal(pressureDrilldownTarget("pressure", "11/2569", "รวมทุกหอที่เลือก", 50, wards), null);
  assert.equal(pressureDrilldownTarget("pressure", "11/2569", "หอที่ไม่มีสิทธิ์", 50, wards), null);
  assert.equal(pressureDrilldownTarget("readmission", "11/2569", "อายุรกรรมชาย", 5, wards), null);

  assert.deepEqual(wardDisplayMeta("อายุรกรรมชาย", wards), { fullName: "อายุรกรรมชาย", shortName: "อช" });
  assert.deepEqual(wardDisplayMeta("สังเกตุอาการณ์", wards), { fullName: "สังเกตุอาการณ์", shortName: null });
  assert.deepEqual(wardDisplayMeta("รวมทุกหอที่เลือก", wards), { fullName: "รวมทุกหอที่เลือก", shortName: null });
});

test("รายงานประจำวันรวมทุกตึก (daily-all) มีช่องลงนามและหมายเหตุท้ายตารางใน XML ส่วนรายงานอื่นไม่มี", () => {
  const dailyAllXml = spreadsheetXML({
    kind: "daily-all",
    title: "รายงานประจำวันรวมทุกตึก",
    period: "19 พฤศจิกายน 2569",
    columns: ["หอผู้ป่วย", "เวร"],
    rows: [["หอ ก", "ดึก"]],
  });
  assert.match(dailyAllXml, /<Row><Cell><Data ss:Type="String">แพทย์เวร<\/Data><\/Cell><Cell><Data ss:Type="String"><\/Data><\/Cell><\/Row>/);
  assert.match(dailyAllXml, /<Row><Cell><Data ss:Type="String">พยาบาลเวรตรวจการ<\/Data><\/Cell><Cell><Data ss:Type="String"><\/Data><\/Cell><\/Row>/);
  assert.match(dailyAllXml, /<Row><Cell><Data ss:Type="String">หากไม่มีรายชื่อตึก แสดงว่าในวันดังกล่าว ตึกยังไม่มีการบันทึกข้อมูล<\/Data><\/Cell><\/Row>/);

  const dailyXml = spreadsheetXML({
    kind: "daily",
    title: "รายงานประจำวัน",
    period: "19 พฤศจิกายน 2569",
    columns: ["หอผู้ป่วย", "เวร"],
    rows: [["หอ ก", "ดึก"]],
  });
  assert.doesNotMatch(dailyXml, /แพทย์เวร/);
  assert.doesNotMatch(dailyXml, /พยาบาลเวรตรวจการ/);
  assert.doesNotMatch(dailyXml, /หากไม่มีรายชื่อตึก แสดงว่าในวันดังกล่าว ตึกยังไม่มีการบันทึกข้อมูล/);
});
