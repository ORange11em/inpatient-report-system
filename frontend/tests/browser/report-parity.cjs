const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'docs/screenshots/parity-phase-4'),pdf=path.join(root,'output/pdf/parity-phase-4');
fs.mkdirSync(pdf,{recursive:true});fs.mkdirSync(path.join(out,'exports'),{recursive:true});
const pointer=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'inpatient-phase4-pointer.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(pointer.config,'utf8')),gold=JSON.parse(fs.readFileSync(path.join(out,'api-results.json'),'utf8')).tables;
assert.equal(new URL(config.origin).hostname,'127.0.0.1');
// TODO: เชื่อม API — only the private, newly created synthetic PostgreSQL/FastAPI service.
const base=process.env.UI_BASE_URL||'http://localhost:3000',A=config.wards['10'].id,B=config.wards['11'].id;
const checks=[],sizes=[],errors=[],mutations=[],permissions=[],reads=[];
const permissionsOnly=process.argv.includes('--permissions-only');
let page;
(async()=>{
 const view=await import(pathToFileURL(path.join(root,'frontend/lib/report-view.mjs')).href);
 const thai=await import(pathToFileURL(path.join(root,'frontend/lib/thai-date.mjs')).href);
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 async function login(name){
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok',reducedMotion:'reduce',acceptDownloads:true});
  await context.route('**/api/v1/**',async route=>{
   const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'&&!u.pathname.includes('/auth/'))mutations.push({method:req.method(),path:u.pathname});
   if(u.pathname.includes('/reports/'))reads.push({actor:name,path:u.pathname,query:Object.fromEntries(u.searchParams)});
   try {
    const response=await route.fetch({url:config.origin+u.pathname+u.search,maxRetries:req.method()==='GET'?2:0});await route.fulfill({response});
   } catch(e) {
    if(!/closed|disposed|canceled/i.test(e.message)){errors.push('forwarding '+u.pathname+' failed');await route.abort();}
   }
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/login');await p.getByLabel('ชื่อบัญชี',{exact:true}).fill(config.credentials[name].username);await p.getByLabel('รหัสผ่าน',{exact:true}).fill(config.credentials[name].password);await p.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await p.waitForURL(base+'/entries');return p;
 }
 async function ready(p){await p.getByRole('button',{name:'ส่งออก Excel',exact:true}).waitFor();await p.waitForFunction(()=>!document.querySelector('.report-actions button:last-child')?.disabled);await p.evaluate(()=>document.fonts.ready);await p.locator('.report-screen .ui-table tbody tr').first().waitFor({state:'attached'});}
 async function level(n){await page.getByRole('button',{name:'ขนาดปกติ',exact:true}).click();if(n===125)for(let i=0;i<2;i++)await page.getByRole('button',{name:'เพิ่มขนาดตัวอักษร',exact:true}).click();}
 function occupancyModel(raw,print=false){
  const t=view.occupancyTable(raw),wards=[...raw.wards,raw.total];
  return {...t,columns:[...t.columns,'ส่วนต่าง (จุดร้อยละ)'],rows:t.rows.map((r,i)=>{const d=view.occupancyDelta(wards[i].fiscal_year,wards[i].previous_fiscal_year);return [...r,d==null?null:(d>0?'▲ ':d<0?'▼ ':'= ')+thai.formatThaiNumber(Math.abs(d),{digits:1})];})};
 }
 function displayRows(t,kind,screen=false){return t.rows.map(r=>r.map((v,i)=>screen&&kind==='occupancy'&&typeof v==='number'?thai.formatThaiNumber(v,{digits:2})+'%':view.displayedReportCell(v,t.columns[i],kind)));}
 async function verify(item){
  const {key,kind,route}=item;
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+route);await ready(page);await level(100);
  const raw=gold[key],screen=kind==='occupancy'?occupancyModel(raw):raw;
  const actual=await page.locator('.report-screen .ui-table').evaluate(t=>[...t.querySelectorAll('tbody tr,tfoot tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.innerText.trim())));
  assert.deepEqual(actual,displayRows(screen,kind,true),key+' screen cells');
  const printed=kind==='occupancy'?occupancyModel(raw,true):gold[key+'-print']||raw;
  const groups=view.printColumnGroups({...printed,kind});
  const panels=await page.locator('.report-print-panel').evaluateAll(es=>es.map(e=>({head:[...e.querySelectorAll('thead tr:last-child th')].map(c=>c.innerText.trim()),rows:[...e.querySelectorAll('tbody tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.innerText.trim()))})));
  assert.equal(panels.length,groups.length,key+' print panels');
  for(let i=0;i<groups.length;i++){
   assert.deepEqual(panels[i].head,groups[i].map(n=>view.reportColumnLabel(printed.columns[n])),key+' print header');
   assert.deepEqual(panels[i].rows,printed.rows.map(r=>groups[i].map(n=>view.displayedReportCell(r[n],printed.columns[n],kind))),key+' print cells');
  }
  const wait=page.waitForEvent('download');await page.getByRole('button',{name:'ส่งออก Excel',exact:true}).click();const file=await wait;assert.match(file.suggestedFilename(),/\.xml$/);assert.doesNotMatch(file.suggestedFilename(),/2026|2027|2028/);
  const target=path.join(out,'exports',key+'.xml');await file.saveAs(target);const xml=fs.readFileSync(target,'utf8');
  const exported=await page.evaluate(text=>{const d=new DOMParser().parseFromString(text,'application/xml');return {errors:d.querySelectorAll('parsererror').length,rows:[...d.querySelectorAll('Row')].map(r=>[...r.querySelectorAll('Data')].map(e=>({type:e.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet','Type'),value:e.textContent})))}} ,xml);
  assert.equal(exported.errors,0,key+' XML syntax');const ex=kind==='occupancy'?view.occupancyTable(raw):gold[key+'-excel']||raw;
  assert.deepEqual(exported.rows[2].map(c=>c.value),ex.columns.map(view.reportColumnLabel),key+' XML header');
  assert.deepEqual(exported.rows.slice(3),ex.rows.map(r=>r.map((v,i)=>{const actual=view.reportCellValue(v,ex.columns[i]);return {type:typeof actual==='number'?'Number':'String',value:actual==null?'':String(actual)};})),key+' XML all cells and types');
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.report-screen').isVisible(),false);await page.pdf({path:path.join(pdf,key+'.pdf'),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
  if(item.matrix)for(const width of [360,768,1024,1440])for(const n of [100,125]){
   await page.setViewportSize({width,height:1000});await level(n);
   if(width===360){const button=page.getByRole('button',{name:'ตาราง',exact:true});await button.waitFor();await button.click();}
   const m=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,table:[...document.querySelectorAll('.report-screen .ui-table-scroll')].map(e=>{e.scrollLeft=e.scrollWidth;return {client:e.clientWidth,scroll:e.scrollWidth,left:e.scrollLeft};})}));
   assert.equal(m.client,m.scroll,key+' page overflow '+width+'/'+n);if(width===360)assert.ok(m.table.every(t=>t.scroll<=t.client||t.left>0),key+' table can scroll');sizes.push({key,width,level:n,...m});
   if(width===360&&n===125)await page.screenshot({path:path.join(out,key+'-360-125.png')});
  }
  checks.push({key,kind,screenRows:screen.rows.length,screenColumns:screen.columns.length,printPanels:groups.length,xmlRows:ex.rows.length,xmlNumericCells:ex.rows.flat().filter(v=>typeof v==='number').length,allScreenPrintAndXMLCellsMatched:true,pdf:'output/pdf/parity-phase-4/'+key+'.pdf'});console.log('PASS report',key);
 }
 try{
  if(!permissionsOnly){
  page=await login('admin');
  for(const kind of Object.keys(view.reportCatalog)){
   const mode=view.reportCatalog[kind][1],q=new URLSearchParams({kind,date:'2026-11-01',month:'2026-11',through:'2026-11',year:'2570',status:'all'});
   if(['daily','monthly','pressure-detail'].includes(kind))q.set('ward',A);if(kind==='daily-all')q.set('shift',config.shifts[1]);
   await verify({key:kind,kind,route:'/reports?'+q,matrix:true});
  }
  await verify({key:'monthly-confirmed',kind:'monthly',route:'/reports?kind=monthly&month=2026-11&ward='+A+'&status=confirmed'});
  await verify({key:'bed-edge',kind:'monthly',route:'/reports?kind=monthly&month=2028-01&ward='+A});
  await verify({key:'specialty-edge',kind:'specialty',route:'/reports?kind=specialty&month=2028-01&through=2028-01'});
  await verify({key:'pressure-detail-empty',kind:'pressure-detail',route:'/reports?kind=pressure-detail&month=2028-02&ward='+A});
  await verify({key:'occupancy-complete',kind:'occupancy',route:'/occupancy?year=2571'});
  }
  for(const name of ['reader','multi']){
   const p=await login(name);page=p;await p.goto(base+'/reports?kind=daily-all&date=2026-11-01&shift='+config.shifts[1]);await ready(p);
   assert.equal(await p.getByRole('combobox',{name:'ประเภทรายงาน',exact:true}).locator('option').count(),13);
   const totals=await p.locator('.report-screen .ui-table tfoot tr').innerText();assert.match(totals,new RegExp('\\b'+(name==='reader'?12:18)+'\\b'));
   const forbidden=await p.evaluate(async B=>{const r=await fetch('/api/v1/reports/summary/specialty?selected=2026-11-01&ward_id='+B);return r.status;},B);assert.equal(forbidden,name==='reader'?403:200);
   const wait=p.waitForEvent('download');await p.getByRole('button',{name:'ส่งออก Excel',exact:true}).click();const download=await wait,target=path.join(out,'exports','scope-'+name+'.xml');await download.saveAs(target);
   const cells=await p.evaluate(text=>{const d=new DOMParser().parseFromString(text,'application/xml');return [...d.querySelectorAll('Row')].map(r=>[...r.querySelectorAll('Data')].map(c=>c.textContent));},fs.readFileSync(target,'utf8'));
   const column=cells[2].indexOf('คงเหลือ PT'),records=cells.slice(3);assert.equal(Number(records.at(-1)[column]),name==='reader'?12:18);const names=records.map(r=>r[0]).sort();assert.deepEqual(names,(name==='reader'?['หอสมมติ A','รวมทุกหอที่เลือก']:['หอสมมติ A','หอสมมติ B','รวมทุกหอที่เลือก']).sort());
   const printed=await p.locator('.report-print-only').innerText();assert.equal(printed.includes('หอสมมติ B'),name==='multi');permissions.push({actor:name,totalPT:name==='reader'?12:18,censusOptions:0,directWardB:forbidden,xmlNames:names,printScopeChecked:true});await p.context().close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);fs.writeFileSync(path.join(out,permissionsOnly?'browser-permissions.json':'browser-results.json'),JSON.stringify({passed:true,checks,sizes,permissions,errors,mutations,reads},null,2));console.log('PASS',checks.length,'report/channel cases;',sizes.length,'responsive cases;',permissions.length,'permission/export scopes');
 }catch(e){if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'browser-failure.png')});fs.writeFileSync(path.join(out,'browser-failure.txt'),e.stack+'\n'+await page.locator('body').innerText());}throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
