const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixtures = require('./report-fixtures.cjs');
const base = process.env.UI_BASE_URL || 'http://localhost:3000';
const out = process.env.UI_TEST_OUT || path.resolve(__dirname, '../../../docs/screenshots/parity-phase-2');
const zoom = process.argv.includes('--zoom');
fs.mkdirSync(out, { recursive: true });
// TODO: เชื่อม API — every service request is intercepted; all accounts/counts are fictitious.
const errors = [], unexpected = [], writes = [], checks = [], sizes = [], exportsChecked = [], printChecked = [], saves = [], dialogFonts = [];
const key = 'inpatient-text-size';
const entryUrl = '/entries?ward=example-0&date=2026-11-20&shift=73';
const routes = ['/login', '/', entryUrl, '/history', '/indicators', '/reports', '/occupancy'];
const counters = Object.fromEntries(['pt','nb'].flatMap(g => ['on','in','move','home','move_b','send','dead','non_voluntary','ad'].map(k => [g+'_'+k, 0])));
Object.assign(counters, { pt_on:10, amount_bed:30, ...Object.fromEntries([1,2,3,4,5].map(i => ['patient_type'+i, i===1?10:0])), ...Object.fromEntries(['hn','rn','tn','pn','aid'].map(k => ['em_'+k, 1])) });
const rows = () => fixtures.dailyEntries().slice(0,6).map(r => ({...counters, ...r, service_date:'2026-11-20'}));
async function services(route) {
  const req=route.request(), u=new URL(req.url()), p=u.pathname.slice(7), method=req.method();
  let body={}, status=200;
  if(method!=='GET') writes.push({path:p,method,body:req.postData()?req.postDataJSON():null});
  if(/^\/entries\/[^/]+\/events$/.test(p))body=[];
  else if(p==='/auth/me') body={id:'text-size-test',username:'บัญชีทดสอบขนาดข้อความ',is_admin:true,is_active:true};
  else if(p==='/auth/csrf') body={csrf_token:'synthetic'};
  else if(p==='/auth/login') {status=401;body={detail:'invalid_credentials'};}
  else if(p==='/wards') body=fixtures.wards.slice(0,2);
  else if(p==='/shifts') body=fixtures.shifts;
  else if(p==='/entries/pending-count') body={count:1};
  else if(p==='/news') body=[{id:'synthetic-news',title:'ประกาศสำหรับทดสอบ',body:'ตัวเลขสมมติเท่านั้น',published:true,version:1,created_at:'2026-11-20T03:00:00Z'}];
  else if(p==='/entry-form') body={entry:{...counters,id:'synthetic-entry',ward_id:u.searchParams.get('ward_id'),service_date:u.searchParams.get('service_date'),shift_type_id:Number(u.searchParams.get('shift_type_id')),status:'unconfirmed',version:1,specialties:[]},pt_on:10,nb_on:0,amount_bed:30,source_date:null,source_shift_id:null,pressure:{stage2_4_cases:1,at_risk_patient_days:10},readmission:{readmit_count:1,discharge_count:20}};
  else if(p==='/entries'&&method==='GET') body=rows();
  else if(p==='/entries/synthetic-entry'&&method==='PATCH') body={...counters,...req.postDataJSON(),id:'synthetic-entry',ward_id:'example-0',service_date:'2026-11-20',shift_type_id:73,status:'unconfirmed',version:2,specialties:[]};
  else if(p.startsWith('/indicators/pressure/')) body=[{service_date:u.searchParams.get('date_from'),stage2_4_cases:1,at_risk_patient_days:10}];
  else if(p.startsWith('/indicators/readmission/')) body=[{reporting_month:u.searchParams.get('month_from'),readmit_count:1,discharge_count:20}];
  else if(p==='/reports/daily') body={service_date:u.searchParams.get('service_date'),entries:rows().map(r=>({...r,service_date:u.searchParams.get('service_date')}))};
  else if(p==='/reports/occupancy') body=fixtures.occupancy(Number(u.searchParams.get('fiscal_year_end')||2027));
  else if(p.startsWith('/reports/summary/')) body=fixtures.summary(p.split('/').at(-1),u.searchParams);
  else {unexpected.push(method+' '+p);status=404;body={detail:'synthetic_unknown'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
}
async function prepare(context) {
  await context.route('**/api/v1/**', services);
  await context.addInitScript(() => {const D=Date,t=D.parse('2026-11-20T03:00:00Z');window.Date=new Proxy(D,{construct(T,a){return Reflect.construct(T,a.length?a:[t]);},get(T,p){return p==='now'?()=>t:Reflect.get(T,p);}});});
}
async function load(page, route) {
  await page.goto(base+route);
  await page.locator('.text-size-control').waitFor();
  if(route.startsWith('/entries')) await page.locator('input[name=amount_bed]').waitFor({state:'attached'});
  else if(route==='/history') {
    if(page.viewportSize().width<768) await page.getByRole('button',{name:/^ตัวกรอง/}).click();
    await page.getByRole('button',{name:'ค้นหารายการ',exact:true}).click();await page.locator('.history-status-filters').waitFor();
  }
  else if(route==='/reports'||route==='/occupancy') await page.locator('.report-screen .generic-report-table,.report-screen .occupancy-report').first().waitFor();
  else if(route==='/indicators') await page.locator('.indicator-panel input').first().waitFor();
  else if(route==='/') await page.locator('.home-shift').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);
}
async function level(page, target) {
  await page.getByRole('button',{name:'ขนาดปกติ',exact:true}).click();
  for(let n=100;n<target;n+=12.5) await page.getByRole('button',{name:'เพิ่มขนาดตัวอักษร',exact:true}).click();
  await page.waitForFunction(n=>document.documentElement.dataset.textSize===String(n),target);
}
async function measure(page) {
  return page.evaluate(() => {
    const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const font=e=>visible(e)?Number.parseFloat(getComputedStyle(e).fontSize):null;
    const first=s=>[...document.querySelectorAll(s)].find(visible);
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
      input:font(first('main input:not([type=radio])')),entryInput:font(first('.entry-page input[name=pt_on]')),table:font(first('main tbody td')),heading:font(first('main h1')),
      label:font(first('main label')),button:font(first('main button')),menu:font(first('.shell-link-full,.shell-link-short,.shell-mobile-link')),
      tables:[...document.querySelectorAll('main .ui-table-scroll')].filter(visible).map(e=>({client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX})),
      control:document.querySelector('.text-size-control').getBoundingClientRect().toJSON()};
  });
}
async function captureExport(page) {
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออก Excel',exact:true}).click();
  const download=await event,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream) chunks.push(chunk);
  return {name:download.suggestedFilename(),xml:Buffer.concat(chunks).toString('utf8')};
}
async function printMetrics(page) {
  await page.emulateMedia({media:'print'});
  const value=await page.evaluate(()=>({control:getComputedStyle(document.querySelector('.text-size-control')).display,
    body:getComputedStyle(document.body).fontSize,
    cells:[...document.querySelectorAll('.report-print-only th,.report-print-only td,.report-print-header p,.report-print-header strong')].map(e=>{
      const s=getComputedStyle(e),r=e.getBoundingClientRect();return [s.fontSize,s.lineHeight,s.padding,s.fontWeight,r.width,r.height];
    })}));
  await page.emulateMedia({media:'screen'});return value;
}
(async()=>{
 const browser=await chromium.launch({headless:!zoom,channel:'msedge',args:zoom?['--window-size=1440,1000']:[]});
 let activePage;
 try {
  const context=await browser.newContext({viewport:zoom?null:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok',reducedMotion:'reduce',acceptDownloads:true});
  await prepare(context);const page=await context.newPage();activePage=page;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  if(zoom) {
    await load(page,entryUrl);await level(page,125);await page.evaluate(()=>{document.title='ตรวจขนาดตัวอักษร — Zoom QA';scrollTo(0,0);});
    const before=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale}));
    fs.writeFileSync(path.join(out,'zoom-ready.json'),JSON.stringify({before}));console.log('Ready for native browser zoom at 200%',before);
    await page.waitForFunction(dpr=>devicePixelRatio>=dpr*1.99,before.dpr,{timeout:240000});
    const m=await measure(page);assert.equal(m.scroll,m.client);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
    await page.locator('.entry-actions').scrollIntoViewIfNeeded();
    const save=page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true});await save.click();const saveDialog=page.getByRole('dialog',{name:'ยืนยันการบันทึกข้อมูล',exact:true});await saveDialog.waitFor();await saveDialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await page.locator('.entry-toast .ui-toast').waitFor();
    const after=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth}));
    assert.ok(Math.abs(after.dpr/before.dpr-2)<.01);
    await page.screenshot({path:path.join(out,'entries-browser-zoom-200.png')});
    fs.writeFileSync(path.join(out,'zoom-result.json'),JSON.stringify({before,after,checks:['native browser zoom 200% with text level 125%, no page overflow, save succeeded'],errors,unexpected},null,2));
    console.log('PASS zoom',after);await page.waitForTimeout(15000);return;
  }
  for(const width of [360,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const route of routes) {
      await load(page,route);const pair={route,width};
      for(const n of [100,125]) {
        await level(page,n);await page.evaluate(()=>scrollTo(0,0));
        const m=await measure(page);assert.equal(m.scroll,m.client,JSON.stringify({route,n,...m}));pair[n]=m;
        assert.ok(m.control.x>=0&&m.control.right<=width+1);
        await page.screenshot({path:path.join(out,`${route==='/'?'home':route.split('?')[0].slice(1)}-${width}-${n}.png`)});
      }
      for(const field of ['input','entryInput','table','heading','label','button','menu']) if(pair[100][field]&&pair[125][field]) assert.ok(Math.abs(pair[125][field]/pair[100][field]-1.25)<.01,JSON.stringify({route,width,field,before:pair[100][field],after:pair[125][field]}));
      sizes.push(pair);
    }
  }
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(sizes,null,2));
  checks.push('7 routes × 4 widths × 2 levels: no page overflow, measured fonts grow 25%');
  await load(page,'/login');await level(page,100);
  assert.equal(await page.getByRole('button',{name:'ลดขนาดตัวอักษร',exact:true}).isDisabled(),true);
  const increase=page.getByRole('button',{name:'เพิ่มขนาดตัวอักษร',exact:true});await page.getByRole('button',{name:'ขนาดปกติ',exact:true}).focus();await page.keyboard.press('Tab');assert.ok(await increase.evaluate(e=>e===document.activeElement));await page.keyboard.press('Enter');
  assert.match(await page.locator('.text-size-control [role=status]').innerText(),/112.5%/);
  assert.equal(await page.locator('.login-card input').first().evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize)),18);
  assert.equal(await increase.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
  await page.keyboard.press('Space');assert.equal(await increase.isDisabled(),true);
  await page.getByRole('button',{name:'ลดขนาดตัวอักษร',exact:true}).click();assert.match(await page.locator('.text-size-control [role=status]').innerText(),/112.5%/);
  for(const target of [112.5,125]) {
    await level(page,target);await load(page,'/');assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),String(target));
    await page.getByRole('link',{name:'รายงานผู้ป่วยใน',exact:true}).click();await page.waitForURL(base+'/reports');
    await page.waitForFunction(n=>document.documentElement.dataset.textSize===String(n),target);
    await page.reload();await page.waitForFunction(n=>document.documentElement.dataset.textSize===String(n),target);
  }
  for(const raw of ['broken','101','112.5oops','null','999']) {await page.evaluate(({k,v})=>localStorage.setItem(k,v),{k:key,v:raw});await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.textSize==='100');}
  checks.push('keyboard Enter/Space, focus outline, min/max disabled, live level, reset, navigation/reload and invalid storage');
  console.log('Responsive matrix and preference checks passed');
  await load(page,'/login');const alertFonts=[];
  for(const target of [100,125]) {
    await level(page,target);await page.getByLabel('ชื่อบัญชี',{exact:true}).fill('synthetic-only');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('synthetic-only');
    await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.locator('.login-card [role=alert]').waitFor();
    alertFonts.push(await page.locator('.login-card [role=alert]').evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize)));
  }
  assert.deepEqual(alertFonts,[16,20]);checks.push('login alert text grows 16→20px with fictitious rejected credentials');
  await page.setViewportSize({width:360,height:1000});
  for(const n of [100,125]) {
    await load(page,entryUrl);await level(page,n);await page.locator('.entry-actions').scrollIntoViewIfNeeded();
    const save=page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true});await save.click();const saveDialog=page.getByRole('dialog',{name:'ยืนยันการบันทึกข้อมูล',exact:true});await saveDialog.waitFor();await saveDialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await page.locator('.entry-toast .ui-toast').waitFor();
    const m=await page.evaluate(()=>{const a=document.querySelector('.entry-actions'),t=document.querySelector('.entry-toast .ui-toast');const ar=a.getBoundingClientRect(),tr=t.getBoundingClientRect();const b=a.querySelector('button'),br=b.getBoundingClientRect();return {action:ar.toJSON(),toast:tr.toJSON(),button:br.toJSON(),hit:b.contains(document.elementFromPoint(br.x+br.width/2,br.y+br.height/2)),height:innerHeight};});
    assert.ok(m.toast.bottom<=m.action.top,JSON.stringify(m));assert.ok(m.hit);assert.ok(m.button.bottom<=m.height&&m.button.top>=0);
    saves.push({level:n,...m});
    await page.screenshot({path:path.join(out,`entry-save-toast-360-${n}.png`)});
  }
  checks.push('360px both sizes: saved via original request; toast above measured action bar and save button hit-test passes');
  console.log('Save and toast checks passed');
  await page.setViewportSize({width:1440,height:1000});await load(page,'/');
  for(const n of [100,125]) {
    await level(page,n);await page.getByRole('button',{name:'เพิ่มข่าว',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'เพิ่มข่าวประกาศ',exact:true});await dialog.waitFor();
    const m=await dialog.getByRole('textbox',{name:/หัวข้อข่าว/}).evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize));assert.equal(m,n===100?16:20);dialogFonts.push(m);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  }
  checks.push('dialog input font grows 16→20px; Escape closes dialog');
  await load(page,'/reports');
  for(const kind of ['daily','daily-all','monthly','census-day','census-month','turnover','los','occupancy','productivity','specialty','skill-mix','nursing-hours','pressure','pressure-detail','readmission']) {
    await page.getByRole('combobox',{name:'ประเภทรายงาน',exact:true}).selectOption(kind);await page.getByRole('button',{name:'แสดงรายงาน',exact:true}).click();await page.locator('.report-screen .ui-table tbody tr').first().waitFor();
    await level(page,100);const normalExport=await captureExport(page),normalPrint=await printMetrics(page);
    await level(page,125);const largeExport=await captureExport(page),largePrint=await printMetrics(page);
    assert.deepEqual(largeExport,normalExport,kind+' XML changed');assert.deepEqual(largePrint,normalPrint,kind+' print changed');assert.equal(largePrint.control,'none');
    exportsChecked.push({kind,name:largeExport.name,bytes:Buffer.byteLength(largeExport.xml)});printChecked.push({kind,cells:largePrint.cells.length,font:largePrint.cells[0]?.[0]});
    if(kind==='daily') {await page.emulateMedia({media:'print'});await page.screenshot({path:path.join(out,'print-daily-125.png')});await page.emulateMedia({media:'screen'});}
  }
  checks.push('all 15 reports: exported XML/name byte-identical and print font/geometry identical between 100% and 125%');
  await load(page,'/occupancy');await page.setViewportSize({width:360,height:1000});await level(page,125);await page.getByRole('button',{name:'ตาราง',exact:true}).click();
  const scroller=page.locator('.occupancy-table').locator('..');const scroll=await scroller.evaluate(e=>{e.scrollLeft=e.scrollWidth;return {left:e.scrollLeft,width:e.clientWidth,scroll:e.scrollWidth};});assert.ok(scroll.left>0);assert.ok(scroll.scroll>scroll.width);assert.equal((await measure(page)).scroll,360);
  checks.push('360px occupancy table scrolls inside its container at 125%');
  const blocked=await browser.newContext();await prepare(blocked);await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('synthetic unavailable storage');}}));
  const blockedPage=await blocked.newPage();await load(blockedPage,'/login');await level(blockedPage,125);await blocked.close();checks.push('unavailable storage falls back to 100% and controls still work');
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,sizes,saves,alertFonts,dialogFonts,exportsChecked,printChecked,writes,errors,unexpected},null,2));
  console.log('PASS',checks.length,'groups;',sizes.length*2,'responsive cases;',exportsChecked.length,'exports/print variants');
 } catch(error) {
   fs.writeFileSync(path.join(out,zoom?'zoom-failure.txt':'failure.txt'),error.stack);
   if(activePage) {await activePage.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure-debug.json'),JSON.stringify({writes,errors,unexpected,body:await activePage.locator('body').innerText(),invalid:await activePage.locator(':invalid').evaluateAll(es=>es.map(e=>({name:e.name,value:e.value,message:e.validationMessage})))},null,2));}
   throw error;
 }
 finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
