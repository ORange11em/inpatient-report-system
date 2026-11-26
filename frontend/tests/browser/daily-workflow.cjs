const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const pointer=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'inpatient-phase3-test-pointer.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(pointer.config,'utf8'));
const base=process.env.UI_BASE_URL||'http://localhost:3000';
const out=path.resolve(__dirname,'../../../docs/screenshots/parity-phase-3');fs.mkdirSync(out,{recursive:true});
// TODO: เชื่อม API — real HTTP is forwarded only to the freshly created private test service.
// No mocked responses, production connection, real patient data, or credentials in reports.
assert.equal(new URL(config.origin).hostname,'127.0.0.1');
const checks=[],errors=[],writes=[],responsive=[],lifecycle=[],pages={};
const A=config.wards['10'].id,B=config.wards['11'].id;
const url=(date,shift,ward=A)=>`/entries?ward=${ward}&date=${date}&shift=${config.shifts[shift]}`;
const specials=['obs','nb','gyn','surg','med','psych','skin','ped','ortho','eye','ent','dent','neuro_surg'];
async function call(page,method,target,data) {
 return page.evaluate(async({method,target,data})=>{
  const headers={'Content-Type':'application/json'};
  if(method!=='GET') headers['X-CSRF-Token']=(await(await fetch('/api/v1/auth/csrf')).json()).csrf_token;
  const r=await fetch('/api/v1'+target,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
  return {status:r.status,body:r.status===204?null:await r.json()};
 },{method,target,data});
}
async function open(page,route) {
 await page.goto(base+route);
 if(route.startsWith('/entries?')) await page.locator('.daily-entry-form input[name=amount_bed]').waitFor({state:'attached'});
 else if(route==='/') await page.locator('.home-layout').waitFor();
 else await page.locator('main').waitFor();
 await page.evaluate(()=>document.fonts.ready);
}
async function field(page,name,value) {
 const input=page.locator(`.daily-entry-form input[name="${name}"]`);
 await input.evaluate(e=>{const section=e.closest('details');if(section)section.open=true;});
 if(value!==undefined)await input.fill(value);
 return input;
}
async function save(page,label) {
 const wait=page.waitForResponse(r=>r.url().includes('/api/v1/entries')&&['POST','PATCH'].includes(r.request().method()));
 await page.getByRole('button',{name:label,exact:true}).click();
 const response=await wait;assert.ok(response.ok(),String(response.status()));
 await page.locator('.entry-toast .ui-toast').waitFor();return response.json();
}
async function confirm(page) {
 const wait=page.waitForResponse(r=>r.url().endsWith('/confirm')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'ยืนยันการส่งข้อมูล',exact:true}).click();
 const response=await wait;assert.equal(response.status(),200);return response.json();
}
async function fonts(page,level) {
 await page.getByRole('button',{name:'ขนาดปกติ',exact:true}).click();
 if(level===125)for(let i=0;i<2;i++)await page.getByRole('button',{name:'เพิ่มขนาดตัวอักษร',exact:true}).click();
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  for(const name of ['rec_a','admin','editor','reader','multi','mixed','rec_b','auditor']) {
   const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok',reducedMotion:'reduce'});
   await context.route('**/api/v1/**',async route=>{
    const r=route.request(),u=new URL(r.url());
    if(r.method()!=='GET'&&!u.pathname.includes('/auth/')) writes.push({actor:name,method:r.method(),path:u.pathname});
    const response=await route.fetch({url:config.origin+u.pathname+u.search});await route.fulfill({response});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push({name,error:e.message}));page.on('dialog',d=>d.accept());pages[name]=page;
   await open(page,'/login');await page.getByLabel('ชื่อบัญชี',{exact:true}).fill(config.credentials[name].username);
   await page.getByLabel('รหัสผ่าน',{exact:true}).fill(config.credentials[name].password);
   await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(base+'/entries');
   await page.locator('.shell-header').waitFor();
   const wards=await call(page,'GET','/wards');assert.equal(wards.status,200);
   const expected=['admin','editor','multi','mixed'].includes(name)?2:name==='auditor'?0:1;assert.equal(wards.body.length,expected);
  }
  checks.push('real login and ward scoping for 8 accounts, including read-only/multi-ward/mixed/admin/auditor');
  const rec=pages.rec_a,admin=pages.admin,reader=pages.reader;
  await open(rec,url('2026-12-03',3));assert.equal(await rec.locator('.daily-entry-form input[name*=":"]').count(),26);
  const expectedSpecialties=[];
  for(let i=0;i<specials.length;i++)for(const [j,category]of ['n','s'].entries()) {
   const value=i*2+j;await field(rec,specials[i]+':'+category,String(value));expectedSpecialties.push({specialty_code:specials[i],category_code:category,count_value:value});
  }
  const specialtyRow=await save(rec,'บันทึกการแก้ไข');assert.deepEqual([...specialtyRow.specialties].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),expectedSpecialties.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  checks.push('all 13 specialties × 2 categories saved through actual form, distinct GYN/SKIN values preserved');
  // Select context using actual controls, not only deep links.
  await open(rec,'/entries');await rec.locator('.entry-context-form select').selectOption(A);
  const day=rec.getByRole('textbox',{name:/^วันที่/});await day.fill('4/12/2569');await day.press('Tab');
  await rec.getByRole('radio',{name:'เช้า',exact:true}).click();await rec.getByRole('button',{name:'เปิดแบบฟอร์ม',exact:true}).click();
  await rec.locator('.daily-entry-form').waitFor();
  assert.match(await rec.locator('.entry-form-heading').innerText(),/4 ธันวาคม 2569/);
  assert.equal(await (await field(rec,'amount_bed')).inputValue(),'10');
  for(const name of ['amount_bed','pt_on']) {
   const input=await field(rec,name,'');const before=writes.length;await rec.keyboard.press('Control+s');
   assert.equal(await input.evaluate(e=>e.validity.valid),false);assert.equal(writes.length,before);await input.fill(name==='amount_bed'?'10':'0');
  }
  await field(rec,'readmit_count','');const before=writes.length;await rec.keyboard.press('Control+s');
  await rec.locator('#entry-error').waitFor();assert.match(await rec.locator('#entry-error').innerText(),/ทั้งสองช่อง/);assert.equal(writes.length,before);await field(rec,'readmit_count','0');
  let entry=await save(rec,'บันทึกข้อมูล');assert.equal(entry.service_date,'2026-12-04');assert.equal(entry.shift_type_id,config.shifts['2']);assert.equal(entry.pt_on,0);
  lifecycle.push({step:'บันทึก',actor:'phase3_rec_a',status:entry.status,version:entry.version});
  checks.push('select ward/day/shift; carry beds; zero saved; blank required values and incomplete monthly pair stop submission without mutation');
  entry=await confirm(rec);lifecycle.push({step:'ยืนยัน',actor:'phase3_rec_a',status:entry.status,version:entry.version});
  await open(rec,url('2026-12-04',2));assert.equal(await rec.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).count(),0);
  assert.ok(await rec.locator('.daily-entry-form input[name]').evaluateAll(es=>es.every(e=>e.matches(':disabled'))));
  const denied=await call(rec,'PATCH','/entries/'+entry.id,{expected_version:entry.version,pt_in:9});assert.equal(denied.status,409);
  checks.push('confirmed entry read-only in UI and rejects direct write');
  await open(admin,`/history?status=confirmed&ward_id=${A}&date_from=2026-12-04&date_to=2026-12-04`);
  await admin.getByRole('button',{name:'ค้นหารายการ',exact:true}).click();await admin.locator('.history-results').waitFor();
  await admin.getByRole('button',{name:'ตรวจสอบ',exact:true}).click();const inspect=admin.getByRole('dialog',{name:'ตรวจสอบข้อมูลประจำวัน',exact:true});await inspect.waitFor();
  await inspect.getByRole('button',{name:'ส่งกลับแก้ไข',exact:true}).click();const back=admin.getByRole('dialog',{name:'ส่งกลับแก้ไข',exact:true});await back.waitFor();
  const reason=back.getByRole('textbox',{name:/เหตุผลที่ส่งกลับแก้ไข/});await reason.fill('   ');const noWrite=writes.length;await back.getByRole('button',{name:'ส่งกลับให้แก้ไข',exact:true}).click();
  await back.getByText('กรุณาระบุเหตุผลที่ส่งกลับแก้ไข',{exact:true}).waitFor();assert.equal(writes.length,noWrite);
  await reason.fill('ตรวจยอดรับใหม่จากชุดสมมติ');await back.getByRole('button',{name:'ส่งกลับให้แก้ไข',exact:true}).click();await back.waitFor({state:'hidden'});
  entry=(await call(admin,'GET','/entries/'+entry.id)).body;lifecycle.push({step:'ส่งกลับพร้อมเหตุผล',actor:'phase3_admin',status:entry.status,version:entry.version});
  await open(rec,url('2026-12-04',2));await rec.getByText('เหตุผลที่ส่งกลับแก้ไข',{exact:true}).waitFor();
  assert.match(await rec.locator('.entry-activity').innerText(),/ตรวจยอดรับใหม่จากชุดสมมติ/);assert.match(await rec.locator('.entry-activity').innerText(),/phase3_admin/);
  await field(rec,'pt_in','1');entry=await save(rec,'บันทึกการแก้ไข');lifecycle.push({step:'แก้ไขหลังส่งกลับ',actor:'phase3_rec_a',status:entry.status,version:entry.version});
  entry=await confirm(rec);lifecycle.push({step:'ยืนยันซ้ำ',actor:'phase3_rec_a',status:entry.status,version:entry.version});
  const events=(await call(rec,'GET','/entries/'+entry.id+'/events')).body;
  assert.deepEqual(events.map(e=>e.action_code),['created','confirmed','returned','updated','confirmed']);
  assert.deepEqual(events.map(e=>e.actor_username),['phase3_rec_a','phase3_rec_a','phase3_admin','phase3_rec_a','phase3_rec_a']);
  checks.push('UI complete cycle with real persisted status/version/actors/reason; ward can see the actual return reason');
  for(const [name,total]of [['rec_a',12],['reader',12],['multi',18],['mixed',18],['admin',18]]) {
   const r=await call(pages[name],'GET',`/reports/summary/daily-all?selected=2026-11-01&shift_type_id=${config.shifts['1']}`);assert.equal(r.status,200);
   const column=r.body.columns.indexOf('คงเหลือ PT');
   assert.equal(r.body.rows.at(-1)[column],total);
   assert.equal(r.body.rows.slice(0,-1).reduce((sum,row)=>sum+row[column],0),total);
  }
  await open(pages.multi,url('2026-11-01',3,B));assert.ok(await pages.multi.locator('.daily-entry-form input[name]').evaluateAll(es=>es.every(e=>e.matches(':disabled'))));
  assert.equal((await call(reader,'GET','/entries/'+config.entries.B1101N.id+'/events')).status,403);
  checks.push('single-ward daily-all=12 versus multi-ward/admin=18; multi-ward read-only form and event permission boundaries');
  // News author follows the actual latest writer, including publishing by a different administrator.
  await open(admin,'/');await admin.getByRole('button',{name:'เพิ่มข่าว',exact:true}).click();let dialog=admin.getByRole('dialog',{name:'เพิ่มข่าวประกาศ',exact:true});
  await dialog.getByRole('textbox',{name:/หัวข้อข่าว/}).fill('ข่าวทดสอบผ่านหน้าจอ');await dialog.getByRole('textbox',{name:/รายละเอียด/}).fill('ข้อมูลสมมติสำหรับตรวจข่าว');await dialog.getByRole('button',{name:'บันทึกข่าว',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await open(reader,'/');assert.equal(await reader.locator('.home-news-item').filter({hasText:'ข่าวทดสอบผ่านหน้าจอ'}).count(),0);
  const editor=pages.editor;await open(editor,'/');let article=editor.locator('.home-news-item').filter({hasText:'ข่าวทดสอบผ่านหน้าจอ'});
  await article.getByRole('button',{name:'แก้ไขข่าว',exact:true}).click();dialog=editor.getByRole('dialog',{name:'แก้ไขข่าวประกาศ',exact:true});
  await dialog.getByRole('checkbox',{name:'เผยแพร่ให้หอผู้ป่วย',exact:true}).check();await dialog.getByRole('button',{name:'บันทึกข่าว',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await open(reader,'/');article=reader.locator('.home-news-item').filter({hasText:'ข่าวทดสอบผ่านหน้าจอ'});await article.locator('summary').click();
  assert.equal(await article.locator('.home-news-publisher').innerText(),'ผู้ประกาศ: '+config.credentials.editor.username);
  assert.notEqual(config.credentials.reader.username,config.credentials.editor.username);assert.equal(await reader.getByRole('button',{name:'เพิ่มข่าว',exact:true}).count(),0);
  await open(editor,'/');article=editor.locator('.home-news-item').filter({hasText:'ข่าวทดสอบผ่านหน้าจอ'});await article.getByRole('button',{name:'แก้ไขข่าว',exact:true}).click();dialog=editor.getByRole('dialog',{name:'แก้ไขข่าวประกาศ',exact:true});
  await dialog.getByRole('textbox',{name:/รายละเอียด/}).fill('แก้ไขเนื้อหาข่าวสมมติแล้ว');await dialog.getByRole('button',{name:'บันทึกข่าว',exact:true}).click();await dialog.waitFor({state:'hidden'});
  for(const width of [360,768,1024,1440])for(const n of [100,125]) {
   await reader.setViewportSize({width,height:1000});await fonts(reader,n);
   const m=await reader.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.equal(m.client,m.scroll);responsive.push({route:'/',width,level:n,...m});
   await reader.screenshot({path:path.join(out,`news-${width}-${n}.png`)});
  }
  await open(admin,'/');article=admin.locator('.home-news-item').filter({hasText:'ข่าวทดสอบผ่านหน้าจอ'});await article.getByRole('button',{name:'ลบข่าว',exact:true}).click();await article.waitFor({state:'detached'});
  await open(reader,'/');assert.equal(await reader.locator('.home-news-item').filter({hasText:'ข่าวทดสอบผ่านหน้าจอ'}).count(),0);
  const legacy=reader.locator('.home-news-item').filter({hasText:'ข่าวจำลองก่อนเพิ่มผู้ประกาศ'});await legacy.locator('summary').click();assert.match(await legacy.locator('.home-news-publisher').innerText(),/ไม่พบข้อมูลผู้ประกาศเดิม/);
  checks.push('UI news create/draft/publish/edit/delete with second writer; reader sees actual author; unknown legacy author is not fabricated');
  for(const width of [360,768,1024,1440])for(const route of ['/login',url('2026-12-04',2),`/history?status=unconfirmed`]) {
   await rec.setViewportSize({width,height:1000});await open(rec,route);await fonts(rec,125);
   if(route.includes('/history')) await rec.locator('.history-results').waitFor();
   const m=await rec.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.equal(m.client,m.scroll);responsive.push({route,width,level:125,...m});
   await rec.screenshot({path:path.join(out,`${route.split('?')[0].slice(1)}-${width}-125.png`)});
  }
  await open(rec,url('2026-11-02',2));assert.match(await rec.getByText('แหล่งข้อมูลยกมา',{exact:true}).locator('..').innerText(),/2 พ.ย. 2569/);
  assert.equal(await rec.getByRole('link',{name:'อัตราความพึงพอใจ',exact:true}).count(),0);checks.push('missing external satisfaction configuration produces no fabricated endpoint; backfill form shows actual same-day source');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({passed:true,checks,lifecycle,events,responsive,writes,errors,satisfaction:'No configured endpoint; URL construction covered by unit tests. External authentication not tested.'},null,2));
  console.log('PASS',checks.length,'real-service browser groups;',responsive.length,'responsive cases; no page errors');
 }catch(error){for(const [name,page]of Object.entries(pages)){if(!page.isClosed()&&name==='rec_a'){await page.screenshot({path:path.join(out,'browser-failure.png')});fs.writeFileSync(path.join(out,'browser-failure.txt'),error.stack+'\n'+await page.locator('body').innerText());}}throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
