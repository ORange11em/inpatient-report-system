const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=process.env.UI_TEST_OUT || path.resolve(__dirname,'../../../docs/screenshots/phase-3b');
// TODO: เชื่อม API — synthetic count fixtures; all service requests are intercepted.
const ward={id:'example-ward',name:'หอผู้ป่วยตัวอย่าง',code:'TEST',can_write:true};
const shifts=[1,2,3].map((i)=>({id:i+10,legacy_shift_id:i,display_order:i,display_name:['ดึก','เช้า','บ่าย'][i-1],is_active:true}));
const date='2026-11-19',url='http://localhost:3000/entries?ward=example-ward&date='+date+'&shift=13';
let entry=null,month={readmit_count:1,discharge_count:30},userId='example-user',reader=false,fail=false,pressure=null;
const reads=[],writes=[],dialogs=[],errors=[],checks=[];
const counts=Object.fromEntries(['pt','nb'].flatMap(g=>['on','in','move','home','move_b','send','dead','non_voluntary','ad'].map(k=>[g+'_'+k,0])));
Object.assign(counts,{pt_on:10,nb_on:1,amount_bed:20,patient_type1:10,...Object.fromEntries([2,3,4,5].map(i=>['patient_type'+i,0])),...Object.fromEntries(['hn','rn','tn','pn','aid'].map(s=>['em_'+s,1]))});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok',reducedMotion:'reduce'});
 await context.route('**/api/v1/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname.slice(7),method=req.method();let body,status=200;
  if(method==='GET')reads.push(p+u.search);else writes.push({path:p,method,body:req.postData()?req.postDataJSON():null});
  if(/^\/entries\/[^/]+\/events$/.test(p))body=[];
  else if(p==='/auth/me')body={id:userId,username:'บัญชีตัวอย่าง',is_admin:!reader,is_active:true};
  else if(p==='/auth/csrf')body={csrf_token:'synthetic-csrf'};
  else if(p==='/wards')body=[{...ward,can_write:!reader}];
  else if(p==='/shifts')body=shifts;
  else if(p==='/entries/pending-count')body={count:1};
  else if(p==='/entry-form')body={entry,pt_on:10,nb_on:1,amount_bed:20,source_date:'2026-11-18',source_shift_id:13,readmission:month,pressure};
  else if((p==='/entries'||p==='/entries/example-entry')&&['POST','PATCH'].includes(method)){
   if(fail){status=409;body={detail:'entry_version_conflict'};}
   else{const data=req.postDataJSON();entry={...counts,...entry,...data,id:'example-entry',ward_id:ward.id,service_date:date,shift_type_id:13,status:'unconfirmed',version:(entry?.version||0)+1,created_at:date+'T01:00:00Z',updated_at:date+'T02:00:00Z'};if(data.readmission)month=data.readmission;if(data.pressure)pressure=data.pressure;body=entry;}
  }else if(p==='/entries/example-entry/confirm'){entry={...entry,status:'confirmed',version:entry.version+1};body=entry;}
  else if(p==='/auth/logout')body=null;
  else if(p==='/entries')body=[];
  else if(p.startsWith('/indicators/'))body=[];
  else{status=404;body={detail:'synthetic_path'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('dialog',async d=>{dialogs.push(d.type());await d.accept();});page.on('pageerror',e=>errors.push(e.message));
 const field=name=>page.locator('input[name="'+name+'"]');
 const openField=async name=>{await field(name).evaluate(el=>{el.closest('details').open=true;});await field(name).focus();};
 const load=async()=>{await page.goto(url);await field('amount_bed').waitFor({state:'attached'});await page.waitForTimeout(100);};
 const savedDrafts=()=>page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('inpatient-entry-draft:')).map(([key,raw])=>({key,...JSON.parse(raw)})));
 await load();
 await openField('readmit_count');await field('readmit_count').fill('');await page.keyboard.press('Control+s');await page.getByRole('alert').filter({hasText:'ทั้งสองช่อง'}).waitFor();await page.waitForTimeout(30);assert.equal(await field('readmit_count').evaluate(e=>e===document.activeElement),true);assert.equal(writes.length,0);await field('readmit_count').fill('1');checks.push('monthly pair validation focuses missing field without losing values');
 await openField('pt_on');await page.keyboard.press('Digit2');assert.equal(await field('pt_on').inputValue(),'2');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.name==='nb_on');
 await page.keyboard.press('Tab');await page.waitForFunction(()=>document.activeElement?.name==='pt_in');
 await page.keyboard.press('Shift+Enter');await page.waitForFunction(()=>document.activeElement?.name==='nb_on');
 assert.equal(writes.length,0);checks.push('select-all / Enter / Tab / Shift+Enter without submitting');
 await openField('pt_on');await field('pt_on').fill('13');
 assert.equal(await field('pt_on').evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}))),false);
 assert.equal(await field('pt_on').inputValue(),'13');assert.ok((await field('pt_on').getAttribute('class')).includes('entry-input--changed'));
 await page.waitForTimeout(100);assert.equal((await savedDrafts())[0].values.pt_on,'13');checks.push('wheel/changed highlight/persist raw counts');
 await field('pt_on').fill('10');await page.waitForTimeout(80);assert.equal((await savedDrafts()).length,0);assert.ok(!(await field('pt_on').getAttribute('class')).includes('entry-input--changed'));await field('pt_on').fill('13');await page.waitForTimeout(80);checks.push('undo to baseline clears local draft and highlight');
 const noBefore=reads.filter(x=>x.startsWith('/entry-form?')).length;
 await page.evaluate(()=>scrollTo(0,0));await page.getByRole('radio',{name:'เช้า',exact:true}).click();
 const guard=page.getByRole('dialog',{name:'มีข้อมูลที่ยังไม่บันทึก',exact:true});await guard.waitFor();
 await page.evaluate(()=>window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='s')window.hotkeyPrevented=e.defaultPrevented;}));await page.keyboard.press('Control+s');assert.equal(await page.evaluate(()=>window.hotkeyPrevented),true);assert.equal(writes.length,0);checks.push('save hotkey is suppressed while a dialog is open');
 await guard.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 assert.equal(await field('pt_on').inputValue(),'13');assert.equal(reads.filter(x=>x.startsWith('/entry-form?')).length,noBefore);checks.push('context cancel keeps data and makes no request');
 const dateBox=page.getByRole('textbox',{name:/วันที่/});await dateBox.fill('20/11/2569');await dateBox.press('Tab');await guard.waitFor();await guard.getByRole('button',{name:'ยกเลิก',exact:true}).click();assert.equal(await dateBox.inputValue(),'19/11/2569');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('.entry-context-form')),true);checks.push('cancel date change restores Buddhist date text');
 await page.getByRole('link',{name:/รายงานผู้ป่วยใน/}).first().click();await guard.waitFor();await page.keyboard.press('Escape');assert.ok(page.url().includes('/entries?'));checks.push('navigation cancel');
 await page.evaluate(()=>scrollTo(0,0));await page.getByRole('radio',{name:'เช้า',exact:true}).click();await guard.waitFor();await guard.getByRole('button',{name:'ดำเนินการต่อ',exact:true}).click();
 assert.equal(await field('amount_bed').count(),0);assert.equal(reads.filter(x=>x.startsWith('/entry-form?')).length,noBefore);
 await page.getByRole('button',{name:'เปิดแบบฟอร์ม',exact:true}).click();await field('amount_bed').waitFor({state:'attached'});assert.equal(await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).count(),0);assert.equal(await page.locator('input[type=number][name]').count(),31);
 await page.evaluate(()=>scrollTo(0,0));await page.getByRole('radio',{name:'บ่าย',exact:true}).click();await page.getByRole('button',{name:'เปิดแบบฟอร์ม',exact:true}).click();await field('amount_bed').waitFor({state:'attached'});await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).waitFor();checks.push('confirmed context change keeps prior shift draft isolated');
 await page.reload();await field('amount_bed').waitFor({state:'attached'});await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).waitFor();
 assert.equal(await field('pt_on').inputValue(),'10');
 await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).click();assert.equal(await field('pt_on').inputValue(),'13');checks.push('reload offers draft without applying, explicit restore');
 await openField('pt_on');await field('pt_on').fill('25');
 const windows=[];
 for(const width of [360,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(90);
  const metrics=await page.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.equal(metrics.client,metrics.scroll);windows.push(metrics);
  await page.evaluate(()=>scrollTo(0,document.querySelector('.entry-review').getBoundingClientRect().top+scrollY-110));await page.waitForTimeout(100);
  await page.screenshot({path:path.join(out,'review-'+width+'.png')});
 }
 checks.push('warnings/totals/four widths retain values');
 fail=true;await page.keyboard.press('Control+s');const saveDialog=page.getByRole('dialog',{name:'ยืนยันการบันทึกข้อมูล',exact:true});await saveDialog.waitFor();await saveDialog.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await page.getByRole('alert').filter({hasText:'รายการถูกเปลี่ยน'}).waitFor();
 assert.equal(writes.length,1);assert.equal(await field('pt_on').inputValue(),'25');assert.ok((await savedDrafts()).length>0);checks.push('Ctrl+S uses original request; conflict keeps input and draft');
 fail=false;await page.keyboard.press('Meta+s');await saveDialog.waitFor();await saveDialog.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();await page.getByText('บันทึกข้อมูลเวรบ่าย แล้ว',{exact:true}).waitFor();
 assert.equal((await savedDrafts()).length,0);assert.equal(await page.getByRole('link',{name:'ไปหน้ารอยืนยัน',exact:true}).count(),1);checks.push('Cmd+S success clears drafts and shows shortcuts/toast');
 await openField('pt_on');await field('pt_on').fill('26');await page.waitForTimeout(60);
 entry={...entry,version:entry.version+1};await page.reload();await field('amount_bed').waitFor({state:'attached'});
 await page.getByText('ค่าค้างไม่ตรงกับข้อมูลล่าสุด',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).count(),0);assert.equal(await field('pt_on').inputValue(),'25');checks.push('new server version does not restore old draft');
 await page.getByRole('button',{name:'ลบค่าค้างชุดเก่า',exact:true}).click();
 await openField('pt_on');await field('pt_on').fill('27');await page.waitForTimeout(60);month={readmit_count:2,discharge_count:30};await page.reload();await field('amount_bed').waitFor({state:'attached'});
 await page.getByText('ค่าค้างไม่ตรงกับข้อมูลล่าสุด',{exact:true}).waitFor();assert.equal(await field('pt_on').inputValue(),'25');checks.push('shared monthly change prevents restore at same entry version');
 await page.getByRole('button',{name:'ลบค่าค้างชุดเก่า',exact:true}).click();
 await openField('pt_on');await field('pt_on').fill('28');await page.waitForTimeout(60);userId='another-user';await page.reload();await field('amount_bed').waitFor({state:'attached'});await page.waitForTimeout(80);assert.equal(await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).count(),0);checks.push('another account cannot restore');
 userId='example-user';entry={...entry,status:'confirmed',version:entry.version+1};await page.reload();await field('amount_bed').waitFor({state:'attached'});assert.equal(await field('pt_on').isDisabled(),true);assert.equal(await page.getByRole('button',{name:'คืนค่าที่กรอกค้างไว้',exact:true}).count(),0);checks.push('confirmed data stays disabled and ignores drafts');const writesBeforeReadonly=writes.length;await page.keyboard.press('Control+s');assert.equal(writes.length,writesBeforeReadonly);
 const monthly=page.locator('.entry-monthly');await monthly.locator('summary').click();
 await monthly.getByRole('link',{name:'เปิดข้อมูลเดือนเดียวกันในหน้าตัวชี้วัดเสริม',exact:true}).click();await page.waitForURL('**/indicators?*');
 const indicatorWard=page.getByRole('combobox',{name:/^หอผู้ป่วยสำหรับตัวชี้วัด/});
 await indicatorWard.locator('option[value="example-ward"]').waitFor({state:'attached'});
 assert.equal(await indicatorWard.inputValue(),ward.id);assert.equal(await page.getByRole('textbox',{name:/^วันที่ข้อมูลแผลกดทับ/}).inputValue(),'19/11/2569');assert.equal(await page.getByRole('textbox',{name:/^เดือนรายงานการกลับมารักษาซ้ำ/}).inputValue(),'พฤศจิกายน 2569');
 await page.locator('.indicator-panel .ui-number').first().waitFor();assert.equal(reads.some(r=>r.startsWith('/indicators/')),true);checks.push('related page prefilled in Buddhist dates and auto-loads as approved in phase 5');
 // Navigation guard also covers the mobile drawer and logout.
 entry={...entry,status:'unconfirmed'};await load();await openField('pt_on');await field('pt_on').fill('29');await page.setViewportSize({width:360,height:1000});
 await page.getByRole('button',{name:'เมนู',exact:true}).click();const drawer=page.getByRole('dialog',{name:'เมนูทั้งหมด',exact:true});
 await drawer.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await guard.waitFor();await guard.getByRole('button',{name:'ยกเลิก',exact:true}).click();assert.equal(writes.some(w=>w.path==='/auth/logout'),false);
 await drawer.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await guard.getByRole('button',{name:'ดำเนินการต่อ',exact:true}).click();await page.waitForURL('**/login');assert.equal(writes.at(-1).path,'/auth/logout');checks.push('logout guarded and original request resumes');
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('synthetic storage unavailable');}}));
 await load();await openField('pt_on');await field('pt_on').fill('33');
 await page.getByRole('alert').filter({hasText:'เก็บค่าค้างในเครื่องไม่ได้'}).waitFor();await page.keyboard.press('Control+s');await saveDialog.waitFor();await saveDialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await page.getByText('บันทึกข้อมูลเวรบ่าย แล้ว',{exact:true}).waitFor();checks.push('storage unavailable warns but does not block saving');
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(path.join(out,'editing-qa.json'),JSON.stringify({passed:true,checks,windows,dialogs,reads:[...new Set(reads)],writes,errors},null,2));
 console.log(JSON.stringify({passed:true,checks,windows,errors}));await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
