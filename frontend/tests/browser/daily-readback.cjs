const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const pointer=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'inpatient-phase3-test-pointer.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(pointer.config,'utf8'));
const out=path.resolve(__dirname,'../../../docs/screenshots/parity-phase-3');
const base=process.env.UI_BASE_URL||'http://localhost:3000',A=config.wards['10'].id;
assert.equal(new URL(config.origin).hostname,'127.0.0.1');
// TODO: เชื่อม API — synthetic test environment only; one deliberate read failure tests recovery.
const checks=[],errors=[],history=[],sizes=[];
let failEvents=false;
async function get(page,target){return page.evaluate(async target=>{const r=await fetch('/api/v1'+target);return {status:r.status,body:await r.json()};},target);}
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 for(const name of ['rec_a','admin','multi','auditor','rec_b','reader','mixed','editor']){
  const context=await browser.newContext({viewport:{width:360,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'});
  await context.route('**/api/v1/**',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(failEvents&&u.pathname.endsWith('/events'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'synthetic_read_failure'})});
   const response=await route.fetch({url:config.origin+u.pathname+u.search});await route.fulfill({response});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base+'/login');
  await page.getByLabel('ชื่อบัญชี',{exact:true}).fill(config.credentials[name].username);await page.getByLabel('รหัสผ่าน',{exact:true}).fill(config.credentials[name].password);
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(base+'/entries');
  const rows=await get(page,'/entries?date_from=2026-10-31&date_to=2026-11-02');assert.equal(rows.status,200);
  const expected=['rec_a','reader'].includes(name)?8:name==='rec_b'?5:name==='auditor'?0:13;assert.equal(rows.body.length,expected);
  const report=(await get(page,'/reports/summary/daily-all?selected=2026-11-01&shift_type_id='+config.shifts[1])).body;
  const total=report.rows.reduce((n,row)=>n+row[report.columns.indexOf('คงเหลือ PT')],0);assert.equal(total,({rec_a:12,admin:18,multi:18,auditor:0,rec_b:6,reader:12,mixed:18,editor:18})[name]);history.push({actor:name,rows:rows.body.length,daily_all_closing_pt:total});
  if(name==='admin'){
   const month=await get(page,'/entries?date_from=2026-11-01&date_to=2026-11-30');assert.equal(month.body.length,7);assert.equal(month.body.filter(e=>e.status==='confirmed').length,4);
  }
  if(name!=='rec_a'){await context.close();continue;}
  const form=shift=>'/entry-form?ward_id='+A+'&service_date=2026-11-01&shift_type_id='+config.shifts[shift];
  const morning=(await get(page,form(2))).body,afternoon=(await get(page,form(3))).body;
  assert.deepEqual(morning.readmission,{readmit_count:2,discharge_count:40});assert.deepEqual(afternoon.readmission,morning.readmission);
  assert.equal(morning.pressure,null);assert.deepEqual(afternoon.pressure,{stage2_4_cases:1,at_risk_patient_days:10});
  checks.push('shared monthly 2/40 across morning/afternoon; pressure 1/10 only afternoon; no fabricated zero for absent morning pressure');
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+`/entries?ward=${A}&date=2026-12-03&shift=${config.shifts[3]}`);await page.locator('input[name=amount_bed]').waitFor({state:'attached'});
  const counters=['pt','nb'].flatMap(g=>['on','in','move','home','move_b','send','dead','non_voluntary','ad'].map(k=>g+'_'+k)).concat([1,2,3,4,5].map(i=>'patient_type'+i),['hn','rn','tn','pn','aid'].map(k=>'em_'+k));
  const wanted=Object.fromEntries(counters.map((key,i)=>[key,i+1]));Object.assign(wanted,{amount_bed:100,stage2_4_cases:2,at_risk_patient_days:50,readmit_count:3,discharge_count:60});
  for(const [name,value]of Object.entries(wanted)){const input=page.locator(`.daily-entry-form input[name="${name}"]`);await input.evaluate(e=>{e.closest('details').open=true;});await input.fill(String(value));}
  const saved=page.waitForResponse(r=>r.url().includes('/api/v1/entries/')&&r.request().method()==='PATCH');await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();const savedResponse=await saved;assert.equal(savedResponse.status(),200);const savedEntry=await savedResponse.json();
  const persisted=(await get(page,'/entries/'+savedEntry.id)).body;for(const name of counters.concat('amount_bed'))assert.equal(persisted[name],wanted[name]);
  const supplements=(await get(page,'/entry-form?ward_id='+A+'&service_date=2026-12-03&shift_type_id='+config.shifts[3])).body;assert.deepEqual(supplements.pressure,{stage2_4_cases:2,at_risk_patient_days:50});assert.deepEqual(supplements.readmission,{readmit_count:3,discharge_count:60});
  checks.push('28 distinct nonzero PT/NB/type/staff values plus beds and pressure/monthly fields round-trip through real form, service and database');
  await page.setViewportSize({width:360,height:1000});
  failEvents=true;const route=`/entries?ward=${A}&date=2026-12-04&shift=${config.shifts[2]}`;await page.goto(base+route);
  const activity=page.locator('.entry-activity');await activity.locator('summary').waitFor();await activity.locator('summary').focus();await page.keyboard.press('Enter');
  await activity.getByRole('heading',{name:'โหลดประวัติการทำรายการไม่สำเร็จ',exact:true}).waitFor();
  assert.equal(await page.locator('input[name=amount_bed]').inputValue(),'10');failEvents=false;await activity.getByRole('button',{name:'ลองใหม่',exact:true}).click();await activity.locator('li').last().waitFor();assert.equal(await activity.locator('li').count(),5);
  assert.match(await activity.innerText(),/phase3_admin/);assert.match(await activity.innerText(),/ตรวจยอดรับใหม่จากชุดสมมติ/);assert.match(await activity.innerText(),/2569/);
  checks.push('keyboard opens activity; failed read retries without losing form; five actual events, actor, reason and Thai Buddhist timestamp rendered');
  for(const width of [360,768,1024,1440])for(const level of [100,125]){
   await page.setViewportSize({width,height:1000});await page.getByRole('button',{name:'ขนาดปกติ',exact:true}).click();if(level===125)for(let i=0;i<2;i++)await page.getByRole('button',{name:'เพิ่มขนาดตัวอักษร',exact:true}).click();
   const m=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(document.querySelector('.entry-activity')).fontSize)}));assert.equal(m.client,m.scroll);assert.equal(m.font,level===125?17.5:14);sizes.push({width,level,...m});
  }
  await page.setViewportSize({width:360,height:1000});await activity.screenshot({path:path.join(out,'activity-360-125.png')});
  await page.goto(base+`/history?status=confirmed&ward_id=${A}&date_from=2026-12-04&date_to=2026-12-04`);await page.getByRole('button',{name:/^ตัวกรอง/}).click();await page.getByRole('button',{name:'ค้นหารายการ',exact:true}).click();await page.getByRole('button',{name:'ตรวจสอบ',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'ตรวจสอบข้อมูลประจำวัน',exact:true});await dialog.locator('.entry-activity summary').click();await dialog.locator('.entry-activity li').last().waitFor();assert.equal(await dialog.locator('.entry-activity li').count(),5);await dialog.locator('.entry-activity').screenshot({path:path.join(out,'history-activity-360-125.png')});
  checks.push('same shared activity component renders all five events in history inspection dialog at 360px/125%');await context.close();
 }
 checks.push('eight-account cross-month history and daily-all scopes: recorder A 8/12, B 5/6, multi/admin 13/18, auditor 0/0; November 7 rows/4 confirmed after cycle');assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'readback-result.json'),JSON.stringify({passed:true,checks,history,sizes,errors},null,2));console.log('PASS',checks.length,'readback/recovery groups;',sizes.length,'activity responsive cases');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
