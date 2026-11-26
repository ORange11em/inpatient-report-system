"""Phase 4 real HTTP acceptance on a new PostgreSQL cluster; no caller DATABASE_URL."""
import asyncio
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
from urllib.parse import urlencode
from urllib.request import urlopen

import run_daily_workflow as shared
from app import reports
from app.schemas import COUNTER_FIELDS, SPECIALTY_CODES

BACKEND=Path(__file__).resolve().parents[1]
OUT=BACKEND.parent/'docs/screenshots/parity-phase-4'
checks=[]


def check(name,actual,expected):
    if actual!=expected:raise AssertionError(f'{name}: {actual!r} != {expected!r}')
    checks.append(dict(case=name,expected=expected,actual=actual))


def cell(t,row,column):return row[t['columns'].index(column)]


def exercise(origin,credentials):
    admin=shared.Client(origin).login(credentials['admin'])
    wards={w['legacy_code']:w for w in admin.call('GET','/wards')};shifts={s['legacy_shift_id']:s['id'] for s in admin.call('GET','/shifts')}
    A,B=wards['10']['id'],wards['11']['id']
    for name,ids in [('reader',[A]),('multi',[A,B])]:
        admin.call('POST','/admin/users',dict(**credentials[name],ward_roles=[dict(ward_id=w,role_code='report_reader') for w in ids]),201)
    clients={name:shared.Client(origin).login(c) for name,c in credentials.items()}
    raw,profiles,specialties=shared.fixtures()
    monthly={('10','10'):(1,20),('11','10'):(0,10),('10','11'):(2,40),('11','11'):(1,10)}
    pressure={'A1031E':(0,5),'A1101E':(1,10),'A1102E':(2,50),'B1101E':(0,0)}
    for r in raw:
        p=dict.fromkeys(COUNTER_FIELDS,0)
        for key,value in r.items():
            if key.endswith(('_pt','_nb')):
                suffix,g=key.rsplit('_',1);p[g+'_'+suffix]=int(value)
        p.update(zip(('patient_type'+str(n) for n in (5,4,3,2,1)),profiles[r['profile']]))
        p.update(ward_id=wards[r['ward']]['id'],service_date=r['idate'],shift_type_id=shifts[int(r['wage_type_id'])],amount_bed=int(r['amount_bed']),em_hn=1,em_rn=2,em_tn=1,em_pn=1,em_aid=1)
        p['readmission']=dict(zip(('readmit_count','discharge_count'),monthly[r['ward'],r['idate'][5:7]]))
        if r['wage_type_id']=='3':p['specialties']=[dict(specialty_code=c,category_code=g,count_value=specialties[r['id']].get(c+'_'+g,0)) for c in SPECIALTY_CODES for g in ('n','s')]
        if r['id'] in pressure:p['pressure']=dict(zip(('stage2_4_cases','at_risk_patient_days'),pressure[r['id']]))
        e=admin.call('POST','/entries',p,201)
        if r['i_status']=='1':admin.call('POST','/entries/'+e['id']+'/confirm',dict(expected_version=e['version']))
    tables={}
    def report(kind,client=admin,**kwargs):
        status=kwargs.pop('status','all')
        params=dict(selected='2027-09-30' if kind in reports.FISCAL else '2026-11-01',status=status,**kwargs)
        if kind in {'daily','monthly','pressure-detail'} and 'ward_id' not in kwargs:params['ward_id']=A
        if kind=='daily-all':params.setdefault('shift_type_id',shifts[1])
        return client.call('GET','/reports/summary/'+kind+'?'+urlencode(params))
    for kind in reports.ReportKind.__args__:
        tables[kind]=report(kind)
        check(kind+' rectangular',all(len(row)==len(tables[kind]['columns']) for row in tables[kind]['rows']),True)
        if kind not in {'daily','monthly','census-month','productivity'}:
            for channel in ('print','excel'):check(kind+' same values '+channel,report(kind,channel=channel),tables[kind])
        else:
            for channel in ('print','excel'):tables[kind+'-'+channel]=report(kind,channel=channel)
    t=tables['daily'];rows=t['rows'];check('R01 morning nursing13',cell(t,rows[0],'รวมให้การพยาบาล PT'),13);check('R01 total nursing14',cell(t,rows[-1],'รวมให้การพยาบาล PT'),14)
    check('R01 A day patient days11',cell(t,rows[-1],'Patient Day PT'),11);check('R01 occupancy44',cell(t,rows[-1],'ครองเตียง (%)'),44.0)
    check('R01 print NB day subtotal source0',cell(tables['daily-print'],tables['daily-print']['rows'][-1],'รวมจำหน่าย NB'),0)
    check('R01 print NB patient days4',cell(tables['daily-print'],tables['daily-print']['rows'][-1],'Patient Day NB'),4)
    t=tables['monthly'];night=next(r for r in t['rows'] if r[2]=='รวมเวรดึก');morning=next(r for r in t['rows'] if r[2]=='รวมเวรเช้า');evening=next(r for r in t['rows'] if r[2]=='รวมเวรบ่าย')
    for label,row,pct in [('night',night,46),('morning',morning,22),('evening',evening,40)]:check('R03 '+label+' final beds25',cell(t,row,'เตียง'),25);check('R03 '+label+' occupancy',cell(t,row,'ครองเตียง (%)'),pct)
    check('R03 month nursing25',cell(t,t['rows'][-1],'รวมให้การพยาบาล PT'),25);check('R03 month occupancy42',cell(t,t['rows'][-1],'ครองเตียง (%)'),42)
    for channel in ('print','excel'):check('R03 nursing25 '+channel,cell(tables['monthly-'+channel],tables['monthly-'+channel]['rows'][-1],'รวมให้การพยาบาล PT'),25)
    t=tables['specialty'];n=next(r for r in t['rows'] if r[:3]==['รวมทุกหอที่เลือก','2026-11-01','สามัญ']);s=next(r for r in t['rows'] if r[:3]==['รวมทุกหอที่เลือก','2026-11-01','พิเศษ'])
    check('R10 MED two plus three equals5',cell(t,n,'MED'),5);check('R10 special MED separate0',cell(t,s,'MED'),0)
    n=next(r for r in t['rows'] if r[:3]==['รวมทุกหอที่เลือก','รวม','สามัญ']);check('R10 month MED6 not12',cell(t,n,'MED'),6)
    scoped=report('specialty',clients['reader']);check('R10 assigned ward month MED3',max(cell(scoped,r,'MED') for r in scoped['rows']),3)
    t=tables['pressure-detail'];check('R14 full November plus summary',len(t['rows']),31);check('R14 missing day nulls',t['rows'][2][2:],[None,None,None,'ยังไม่บันทึก']);check('R14 total3/60/50',t['rows'][-1][2:5],[3,60,50])
    z=report('pressure-detail',ward_id=B);check('R14 recorded zero remains0/0',z['rows'][0][2:],[0,0,None,'บันทึกแล้ว']);check('R14 absent differs from zero',z['rows'][1][2:],[None,None,None,'ยังไม่บันทึก'])
    for name,total in [('reader',12),('multi',18),('admin',18)]:
        t=report('daily-all',clients[name]);check(name+' R02 total',cell(t,t['rows'][-1],'คงเหลือ PT'),total)
        clients[name].call('GET','/reports/summary/census-day?selected=2026-11-01',expected=200 if name=='admin' else 403)
    clients['reader'].call('GET','/reports/summary/specialty?selected=2026-11-01&ward_id='+B,expected=403)
    # 10 PT in each shift with 20/20/25 beds, separate month from P1.
    for n,bed in [(1,20),(2,20),(3,25)]:
        p=dict(ward_id=A,service_date='2028-01-01',shift_type_id=shifts[n],amount_bed=bed,pt_on=10,pt_in=1,pt_home=1)
        if n==3:p['specialties']=[dict(specialty_code='med',category_code=g,count_value=v) for g,v in [('n',2),('s',7)]]
        admin.call('POST','/entries',p,201)
    admin.call('POST','/entries',dict(ward_id=B,service_date='2028-01-01',shift_type_id=shifts[3],amount_bed=10,pt_on=10,pt_in=1,pt_home=1,specialties=[dict(specialty_code='med',category_code=g,count_value=v) for g,v in [('n',3),('s',11)]]),201)
    edge=admin.call('GET','/reports/summary/monthly?'+urlencode(dict(selected='2028-01-01',ward_id=A)))
    check('bed20/20/25 shift rows',[[cell(edge,r,'เตียง'),cell(edge,r,'ครองเตียง (%)')] for r in edge['rows'][:3]],[[20,50],[20,50],[25,40]])
    check('bed final25 all shift totals40',[[cell(edge,r,'เตียง'),cell(edge,r,'ครองเตียง (%)')] for r in edge['rows'][-4:]],[[25,40]]*4)
    es=admin.call('GET','/reports/summary/specialty?selected=2028-01-01')
    check('two categories no double count',[(r[2],cell(es,r,'MED')) for r in es['rows'] if r[:2]==['รวมทุกหอที่เลือก','รวม']],[('สามัญ',5),('พิเศษ',18)])
    for kind,column,expected in [('turnover','11/2569',.2),('los','11/2569',1.4),('skill-mix','11/2569',60),('nursing-hours','11/2569',8.33),('pressure','11/2569',50),('readmission','11/2569',5)]:
        t=tables[kind];row=next(r for r in t['rows'] if r[0]=='หอสมมติ A');check(kind+' A November',cell(t,row,column),expected)
    # Pure formula edges use all three shifts; explicitly cover 10/12/13/28 channel differences.
    e=SimpleNamespace(ward_id='x',service_date=__import__('datetime').date(2026,11,1),shift_type_id=shifts[1],amount_bed=20,**{k:0 for k in COUNTER_FIELDS});e.patient_type5=e.patient_type4=9;e.em_hn=3;e.em_rn=6;e.em_tn=e.em_pn=e.em_aid=3
    shiftmap={s['id']:SimpleNamespace(**s) for s in admin.call('GET','/shifts')}
    for code,screen,printed,month in [('10',46.43,35.71,35.71),('12',46.43,57.14,57.14),('13',46.43,57.14,57.14),('28',46.43,35.71,57.14)]:
        w={'x':SimpleNamespace(id='x',name='หอสมมติ '+code,legacy_code=code)}
        for channel,day,monthly in [('screen',screen,month),('print',printed,printed),('excel',printed,printed)]:
            t=reports.productivity_report([e],shiftmap,w,e.service_date,channel);check('R09 '+code+' '+channel,[t['rows'][0][1],t['rows'][0][-1]],[day,monthly])
    for channel in ('print','excel'):tables['productivity-'+channel]=report('productivity',channel=channel)
    occupancy=admin.call('GET','/reports/occupancy?fiscal_year_end=2027&status=all');check('R08 A Nov completeness',[occupancy['wards'][0]['months'][1][k] for k in ('num_record','num_all_record','complete','bed_rate')],[5,90,False,2.8]);tables['occupancy']=occupancy
    for ward in (A,B):
        for day in range(1,30):
            for sid in shifts.values():admin.call('POST','/entries',dict(ward_id=ward,service_date=f'2028-02-{day:02d}',shift_type_id=sid,amount_bed=25,pt_on=10),201)
    complete=admin.call('GET','/reports/occupancy?fiscal_year_end=2028&status=all');feb=complete['wards'][0]['months'][4]
    check('R08 leap February complete87/87 and40', [feb[k] for k in ('num_record','num_all_record','complete','bed_rate')],[87,87,True,40])
    check('R08 total complete174/174 and40',[complete['total']['months'][4][k] for k in ('num_record','num_all_record','complete','bed_rate')],[174,174,True,40]);tables['occupancy-complete']=complete
    filtered=report('daily',status='confirmed')
    check('R01 confirmed daily rows only',all(r[-1]!='รอยืนยัน' for r in filtered['rows'] if r[2] in ('ดึก','เช้า','บ่าย')),True);tables['daily-confirmed']=filtered
    filtered=report('monthly',status='confirmed')
    check('R03 PHP confirmed filter retains pending shifts on selected dates',any(r[-1]=='รอยืนยัน' for r in filtered['rows'] if r[2] in ('ดึก','เช้า','บ่าย')),True)
    check('R03 confirmed filter legacy occupancy44 and nursing14',[cell(filtered,filtered['rows'][-1],'ครองเตียง (%)'),cell(filtered,filtered['rows'][-1],'รวมให้การพยาบาล PT')],[44,14]);tables['monthly-confirmed']=filtered
    for channel in ('print','excel'):
        variant=report('monthly',status='confirmed',channel=channel);tables['monthly-confirmed-'+channel]=variant
        check('R03 confirmed '+channel+' legacy occupancy44 and nursing14',[cell(variant,variant['rows'][-1],'ครองเตียง (%)'),cell(variant,variant['rows'][-1],'รวมให้การพยาบาล PT')],[44,14])
    span=admin.call('GET','/reports/summary/census-month?'+urlencode(dict(selected='2026-10-01',through='2026-11-01',ward_id=A)))
    check('R05 range last-month denominator30',cell(span,span['rows'][0],'เฉลี่ยนอน PT'),1.03);tables['census-month-span']=span
    empty=admin.call('GET','/reports/summary/pressure-detail?'+urlencode(dict(selected='2028-02-01',ward_id=A)))
    check('R14 empty leap calendar29+summary',len(empty['rows']),30);check('R14 empty month summary is not fabricated zero',empty['rows'][-1][2:5],[None,None,None]);tables['pressure-detail-empty']=empty
    admin.call('GET','/reports/summary/daily?selected=2026-11-01&channel=invalid',expected=422)
    tables['bed-edge']=edge;tables['specialty-edge']=es
    (OUT/'api-results.json').write_text(json.dumps(dict(passed=True,checks=checks,http_assertions=len(shared.checks),tables=tables),ensure_ascii=False,indent=2),encoding='utf-8')
    return dict(wards=wards,shifts=shifts)


def main():
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--pg-bin',required=True);args=parser.parse_args();pg=Path(args.pg_bin)
    work=Path(tempfile.mkdtemp(prefix='inpatient-phase4-pg-'));password=secrets.token_urlsafe(32);pwfile=work/'pw';pwfile.write_text(password)
    port,api_port=shared.free_port(),shared.free_port();url=f'postgresql://parity4:{password}@127.0.0.1:{port}/parity_phase4'
    env={**os.environ,'APP_ENV':'test','DATABASE_URL':url,'DATABASE_SSL_REQUIRED':'false','PGPASSWORD':password,'PYTHONIOENCODING':'utf-8'}
    credentials={name:dict(username='phase4_'+name,password='T9!'+secrets.token_urlsafe(24)) for name in ['admin','reader','multi']}
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0;server=None;started=False;OUT.mkdir(parents=True,exist_ok=True)
    with (work/'server.log').open('w',encoding='utf-8') as log:
        def run(cmd):
            r=subprocess.run(list(map(str,cmd)),cwd=BACKEND,env=env,stdout=log,stderr=log,creationflags=flags)
            if r.returncode:raise RuntimeError('Private PostgreSQL setup failed; see private log')
        try:
            run([pg/'initdb.exe','-D',work/'data','-U','parity4','--pwfile',pwfile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C'])
            run([pg/'pg_ctl.exe','-D',work/'data','-l',work/'postgres.log','-o',f'-h 127.0.0.1 -p {port}','-w','start']);started=True
            run([pg/'createdb.exe','-h','127.0.0.1','-p',port,'-U','parity4','parity_phase4']);run([sys.executable,'-m','alembic','upgrade','head']);asyncio.run(shared.seed(url,credentials['admin']))
            server=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(api_port)],cwd=BACKEND,env=env,stdout=log,stderr=log,creationflags=flags)
            origin=f'http://127.0.0.1:{api_port}'
            for _ in range(100):
                try:
                    with urlopen(origin+'/healthz',timeout=1) as r:
                        if r.status==200:break
                except OSError:time.sleep(.1)
            config=dict(origin=origin,credentials=credentials,**exercise(origin,credentials));private=work/'browser-config.json';private.write_text(json.dumps(config),encoding='utf-8')
            (Path(tempfile.gettempdir())/'inpatient-phase4-pointer.json').write_text(json.dumps(dict(config=str(private),stop=str(work/'STOP'))))
            print('PASS',len(checks),'report value assertions;',len(shared.checks),'HTTP assertions. Private browser service ready.',flush=True)
            until=time.monotonic()+60*60
            while not (work/'STOP').exists() and time.monotonic()<until:time.sleep(.5)
        finally:
            if server:server.terminate();server.wait(timeout=15)
            if started:run([pg/'pg_ctl.exe','-D',work/'data','-m','fast','-w','stop'])
            print('Stopped private phase 4 API/PostgreSQL',flush=True)


if __name__=='__main__':main()
