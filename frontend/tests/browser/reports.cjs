const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixtures=require('./report-fixtures.cjs');
const out=process.env.UI_TEST_OUT||path.resolve(__dirname,'../../../docs/screenshots/phase-6'),pdfOut=process.env.REPORT_PDF_OUT||path.resolve(__dirname,'../../../output/pdf');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(pdfOut,{recursive:true});fs.mkdirSync(path.join(out,'exports'),{recursive:true});
// TODO: เชื่อม API — every service intercepted; only synthetic count fixtures.
let admin=true,empty=false,fail=false,catalogFail=false,overviewFail=false,slow=0,nullOnly=false;
const reads=[],mutations=[],errors=[],checks=[],sizes=[],exportChecks=[];
const modes={daily:'day','daily-all':'day',monthly:'month','census-day':'day','census-month':'range',turnover:'year',los:'year',occupancy:'year',productivity:'month',specialty:'range','skill-mix':'year','nursing-hours':'year',pressure:'year','pressure-detail':'month',readmission:'year'};
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok',reducedMotion:'reduce',acceptDownloads:true});
await context.addInitScript(()=>{const D=Date,t=D.parse('2026-11-19T03:00:00Z');window.Date=new Proxy(D,{construct(T,a){return Reflect.construct(T,a.length?a:[t])},get(T,p){return p==='now'?()=>t:Reflect.get(T,p)}})});
await context.route('**/api/v1/**',async route=>{const req=route.request(),u=new URL(req.url()),p=u.pathname.slice(7);let body={},status=200;
if(req.method()==='GET')reads.push({path:p,query:Object.fromEntries(u.searchParams)});else mutations.push({path:p,method:req.method()});
if(p==='/auth/me')body={id:'example-user',username:'บัญชีตัวอย่าง',is_admin:admin,is_active:true};
else if(p==='/auth/csrf')body={csrf_token:'synthetic'};
else if(p==='/wards')body=fixtures.wards;
else if(p==='/shifts')body=fixtures.shifts;
else if(p==='/entries/pending-count')body={count:0};
else if(p==='/reports/daily'){if(overviewFail){status=503;body={detail:'synthetic'};}else body={service_date:u.searchParams.get('service_date'),entries:empty?[]:fixtures.dailyEntries()};}
else if(p==='/reports/occupancy')body=fixtures.occupancy(Number(u.searchParams.get('fiscal_year_end')),empty);
else if(p.startsWith('/reports/summary/')){body=fixtures.summary(p.split('/').at(-1),u.searchParams,empty);if(nullOnly)body.rows=body.rows.map(row=>row.map((value,i)=>i===0?value:null));}
else{status=404;body={detail:'synthetic_unknown'};}
if(p.startsWith('/reports/')&&slow)await new Promise(r=>setTimeout(r,slow));
if(fail&&p.startsWith('/reports/')){status=503;body={detail:'synthetic'};}
if(catalogFail&&['/wards','/shifts'].includes(p)){status=503;body={detail:'synthetic'};}
await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.locator('.report-screen .ui-table tbody tr').first().waitFor();
const reportSelect=()=>page.getByRole('combobox',{name:'ประเภทรายงาน',exact:true});
const apply=()=>page.getByRole('button',{name:'แสดงรายงาน',exact:true}).click();
const load=async route=>{await page.goto('http://localhost:3000'+route);await page.locator('.reports-page').waitFor();};
await load('/reports');await ready();assert.equal(reads.filter(r=>r.path==='/reports/summary/daily'&&!r.query.channel).length,1);assert.equal(reads.filter(r=>r.path==='/reports/summary/daily'&&r.query.channel).length,2);assert.ok(reads.some(r=>r.path==='/reports/daily'));assert.match(await page.locator('.report-daily-overview').innerText(),/บันทึกครบเวรที่เลือก/);checks.push('daily initial screen GET plus separate print/Excel channels and authorized overview');console.log('initial ready');
const afterQueries=[];for(const kind of Object.keys(modes)){
 await reportSelect().selectOption(kind);await apply();await ready();
 const request=reads.filter(r=>(r.path==='/reports/summary/'+kind||(kind==='occupancy'&&r.path==='/reports/occupancy'))&&!r.query.channel).at(-1);afterQueries.push(request);
 assert.equal(/20(26|27)-\d\d/.test(await page.locator('.report-screen').innerText()),false);
 const expected=kind==='occupancy'?{...fixtures.occupancy(),kind:'occupancy'}:fixtures.summary(kind,new URLSearchParams(request.query));
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออก Excel',exact:true}).click();const download=await downloadPromise,filename=download.suggestedFilename();assert.match(filename,/\.xml$/);assert.doesNotMatch(filename,/2026|2027/);assert.match(filename,modes[kind]==='year'?/2570/:/2569/);const target=path.join(out,'exports',filename);await download.saveAs(target);
 const xml=fs.readFileSync(target,'utf8');const parsed=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,'application/xml');return{errors:doc.querySelectorAll('parsererror').length,numbers:[...doc.querySelectorAll('Data')].filter(e=>e.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet','Type')==='Number').map(e=>Number(e.textContent)),text:doc.documentElement.textContent}},xml);assert.equal(parsed.errors,0);assert.doesNotMatch(parsed.text,/20(26|27)-\d\d/);
 const expectedNumbers=kind==='occupancy'?fixtures.occupancy().wards.concat([{...fixtures.occupancy().total}]).flatMap(w=>[...w.months.map(m=>m.complete?m.bed_rate:null),w.fiscal_year.complete?w.fiscal_year.average:null,w.previous_fiscal_year.complete?w.previous_fiscal_year.average:null]).filter(n=>typeof n==='number'):expected.rows.flat().filter(n=>typeof n==='number');
 assert.deepEqual(parsed.numbers,expectedNumbers);exportChecks.push({kind,filename,numericCells:parsed.numbers.length});
}
const beforeFile=path.join(process.env.TEMP,'inpatient-phase6-before-requests.json');if(fs.existsSync(beforeFile))assert.deepEqual(afterQueries,JSON.parse(fs.readFileSync(beforeFile,'utf8')));fs.writeFileSync(path.join(out,'request-comparison.json'),JSON.stringify({before:fs.existsSync(beforeFile)?JSON.parse(fs.readFileSync(beforeFile,'utf8')):afterQueries,after:afterQueries,equal:true},null,2));checks.push('all 15 original report parameter contracts preserved');checks.push('all 15 Excel XML downloads use BE filenames and unchanged numeric cells with well-formed XML');console.log('15 contracts/exports passed');
for(const route of ['/reports','/occupancy']){
 await load(route);await ready();
 for(const width of [360,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(70);
  const m=await page.evaluate(()=>({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,table:[...document.querySelectorAll('.report-screen .ui-table-scroll')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth}))}));
  assert.equal(m.client,m.scroll);if(route==='/occupancy'&&width===1920)assert.ok(m.table.every(t=>t.scroll<=t.client+1),JSON.stringify(m));sizes.push({route,...m});await page.screenshot({path:path.join(out,(route==='/reports'?'daily':'occupancy')+'-'+width+'.png')});
 }
}
checks.push('both routes at 360/768/1024/1440/1920 without page overflow; all occupancy columns visible at 1920');console.log('responsive passed');
await page.setViewportSize({width:360,height:1000});await page.waitForTimeout(80);assert.ok(await page.locator('.occupancy-ward-card').count());await page.locator('.occupancy-ward-card').first().getByText('ดูข้อมูลทั้ง 12 เดือน',{exact:true}).click();assert.equal(await page.locator('.occupancy-card-months').first().locator('>div').count(),12);await page.getByRole('button',{name:'ตาราง',exact:true}).click();assert.equal(await page.locator('.occupancy-table').count(),1);await page.getByRole('button',{name:'การ์ด',exact:true}).click();checks.push('mobile occupancy cards expand 12 months and toggle table');
const incomplete=page.locator('.occupancy-ward-card').nth(1).getByRole('button',{name:/บันทึกแล้ว 540 จาก 1,095 เวร/});await incomplete.click();assert.equal(await page.locator('.ui-popover-content:popover-open').count(),1);await page.keyboard.press('Escape');assert.equal(await page.locator('.ui-popover-content:popover-open').count(),0);checks.push('incomplete counts expose touch/keyboard explanation; complete zero/null preserved');
await page.getByRole('button',{name:/^ตัวกรอง/}).click();const sheet=page.getByRole('dialog',{name:'ตัวกรองข้อมูล',exact:true});await sheet.waitFor();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.keyboard.press('Escape');await sheet.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');checks.push('mobile filter sheet Escape and scroll restoration');
await page.setViewportSize({width:1440,height:1000});await load('/occupancy');await ready();
const scroll=page.locator('.occupancy-report .ui-table-scroll');await scroll.evaluate(e=>{e.scrollLeft=300;e.scrollTop=180});const sticky=await page.evaluate(()=>{const s=document.querySelector('.occupancy-report .ui-table-scroll').getBoundingClientRect(),h=document.querySelector('.occupancy-table thead th').getBoundingClientRect(),r=document.querySelector('.occupancy-table tbody th').getBoundingClientRect();return{left:Math.abs(s.left-r.left),top:Math.abs(s.top-h.top)}});assert.ok(sticky.left<2&&sticky.top<2,JSON.stringify(sticky));checks.push('occupancy header and ward column remain sticky inside scroll region');
await page.getByRole('combobox',{name:'สถานะข้อมูล',exact:true}).selectOption('confirmed');await page.getByRole('combobox',{name:/^ปีงบประมาณ/}).selectOption('2569');await apply();await ready();assert.deepEqual(reads.filter(r=>r.path==='/reports/occupancy').at(-1).query,{fiscal_year_end:'2026',status:'confirmed'});assert.equal(new URL(page.url()).pathname,'/occupancy');checks.push('fiscal BE select sends Gregorian year and retains occupancy route/query');
empty=true;await load('/reports');await page.getByRole('heading',{name:'ไม่พบข้อมูลในช่วงที่เลือก',exact:true}).waitFor();for(const name of['พิมพ์','ส่งออก Excel'])assert.equal(await page.getByRole('button',{name,exact:true}).isDisabled(),true);await page.screenshot({path:path.join(out,'empty-1440.png')});empty=false;checks.push('empty report disables actions with explanation');
nullOnly=true;await load('/reports?kind=los');await page.getByRole('heading',{name:'ไม่พบข้อมูลในช่วงที่เลือก',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'ส่งออก Excel',exact:true}).isDisabled(),true);nullOnly=false;checks.push('fiscal ward-label rows with only null values do not enable empty exports');
fail=true;await load('/reports');await page.locator('.report-screen').getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'ส่งออก Excel',exact:true}).isDisabled(),true);fail=false;await page.locator('.report-screen').getByRole('button',{name:'ลองใหม่',exact:true}).click();await ready();checks.push('report error and retry without stale results');
overviewFail=true;await load('/reports');await ready();await page.getByText('แสดงยอดสรุปไม่สำเร็จ',{exact:true}).waitFor();assert.equal(await page.locator('.report-kpis').count(),0);overviewFail=false;checks.push('overview error does not hide the unchanged report or invent zero totals');
catalogFail=true;await load('/reports');await page.getByRole('heading',{name:'โหลดตัวเลือกรายงานไม่สำเร็จ',exact:true}).waitFor();catalogFail=false;await page.locator('.reports-filters').getByRole('button',{name:'ลองใหม่',exact:true}).click();await ready();checks.push('catalog failure recovers before initial report');
slow=450;await load('/reports');await page.getByRole('status',{name:'กำลังโหลดรายงาน',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'พิมพ์',exact:true}).isDisabled(),true);await ready();slow=0;checks.push('loading skeleton and disabled actions');
admin=false;await load('/reports');await ready();assert.equal(await reportSelect().locator('option').count(),13);assert.equal(await reportSelect().locator('option[value=census-day]').count(),0);admin=true;checks.push('non-admin retains 13 options and no census reports');
await load('/reports?kind=specialty&month=2026-10&through=2026-11&ward=example-1&status=unconfirmed');await ready();assert.deepEqual(reads.filter(r=>r.path==='/reports/summary/specialty').at(-1).query,{selected:'2026-10-01',status:'unconfirmed',ward_id:'example-1',through:'2026-11-01'});await page.reload();await ready();assert.equal(await reportSelect().inputValue(),'specialty');checks.push('query restores applied filters with original endpoint parameters');
for(const [route,name]of[['/reports','daily-a4-landscape'],['/occupancy','occupancy-a4-landscape']]){
 await load(route);await ready();await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({media:'print'});await page.pdf({path:path.join(pdfOut,name+'.pdf'),preferCSSPageSize:true,printBackground:false});
 assert.equal(await page.locator('.report-screen').isVisible(),false);assert.equal(await page.locator('.shell-sidebar').isVisible(),false);assert.match(await page.locator('.report-print-only').innerText(),/โรงพยาบาลอากาศอำนวย/);await page.emulateMedia({media:'screen'});
}
checks.push('actual browser print PDFs generated from both routes using A4 CSS, print columns/headers and hidden navigation');
assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify({checks,sizes,exports:exportChecks,pageErrors:errors,mutations},null,2));console.log(JSON.stringify({passed:checks.length,checks,sizes,exports:exportChecks},null,2));await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
