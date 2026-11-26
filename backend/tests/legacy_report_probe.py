"""Run copies of read-only PHP reports against a fresh, private MariaDB cluster.

Only connection/session/shell includes are replaced in TEMP; report SQL/formulas
remain byte-identical. Never reads an existing database or original connect.php.
"""
import base64
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[2]
LEGACY = ROOT.parent / 'inpatient'
OUT = ROOT / 'docs/screenshots/parity-phase-4'
BIN = Path('C:/xampp/mysql/bin')
PHP = Path('C:/xampp/php/php.exe')


class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.stack=[]
    def handle_starttag(self, tag, attrs):
        if tag=='table':
            table={'rows':[], 'row':None, 'cell':None};self.tables.append(table);self.stack.append(table)
        if not self.stack:return
        t=self.stack[-1]
        if tag=='tr':t['row']=[]
        if tag in ('td','th'):t['cell']=[]
        if tag=='br' and t['cell'] is not None:t['cell'].append(' ')
    def handle_data(self, data):
        if self.stack and self.stack[-1]['cell'] is not None:self.stack[-1]['cell'].append(data)
    def handle_endtag(self, tag):
        if not self.stack:return
        t=self.stack[-1]
        if tag in ('td','th') and t['cell'] is not None:
            if t['row'] is not None:t['row'].append(re.sub(r'\s+',' ',''.join(t['cell'])).strip())
            t['cell']=None
        if tag=='tr' and t['row'] is not None:t['rows'].append(t['row']);t['row']=None
        if tag=='table':self.stack.pop()


def quote(value):
    return 'NULL' if value is None else "'"+str(value).replace('\\','\\\\').replace("'","''")+"'"


class LegacyProbe:
    def __init__(self):
        self.work=Path(tempfile.mkdtemp(prefix='inpatient-phase4-maria-'))
        self.port=free_port();self.password=secrets.token_urlsafe(24);self.server=None
        self.flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    def __enter__(self):
        self.log=(self.work/'server.log').open('w',encoding='utf-8')
        installed=subprocess.run([str(BIN/'mysql_install_db.exe'),'--datadir='+str(self.work/'data'),'--password='+self.password,'--port='+str(self.port),'--silent'],stdout=self.log,stderr=self.log,creationflags=self.flags)
        if installed.returncode:raise RuntimeError('Private MariaDB initialization failed; see private log')
        ini=self.work/'server.ini';ini.write_text('[mysqld]\nbasedir=C:/xampp/mysql\ndatadir='+str(self.work/'data').replace('\\','/')+'\nport='+str(self.port)+'\nbind-address=127.0.0.1\nskip-name-resolve\n',encoding='utf-8')
        self.server=subprocess.Popen([str(BIN/'mysqld.exe'),'--defaults-file='+str(ini)],stdout=self.log,stderr=self.log,creationflags=self.flags)
        client=self.work/'client.ini';client.write_text(f'[client]\nuser=root\npassword={self.password}\nhost=127.0.0.1\nport={self.port}\n',encoding='utf-8');self.client=client
        for _ in range(100):
            p=self.sql('SELECT 1;',check=False)
            if p.returncode==0:break
            time.sleep(.1)
        else:raise RuntimeError('Private MariaDB did not become ready')
        ddl='\n'.join(re.findall(r'CREATE TABLE.*?;', (LEGACY/'db/db_inpatient.sql').read_text(encoding='utf-8-sig'),re.S))
        self.sql('CREATE DATABASE parity_phase4 CHARACTER SET utf8;USE parity_phase4;'+ddl)
        copy=self.work/'php';copy.mkdir();(copy/'report').mkdir()
        # Copy only source PHP. No credentials, uploads, exports or real records.
        for folder in ('','report'):
            for p in (LEGACY/folder).glob('*.php'):
                if p.name not in {'connect.php','sess_uin.php','header.php','footer.php','menu.php','account_data.php'}:
                    shutil.copyfile(p,copy/folder/p.name)
        for name in ('sess_uin.php','header.php','footer.php','menu.php','account_data.php'):(copy/name).write_text('<?php ?>',encoding='utf-8')
        connection={'host':'127.0.0.1','port':self.port,'password':self.password,'database':'parity_phase4'}
        self.context=self.work/'connection.json';self.context.write_text(json.dumps(connection),encoding='utf-8')
        (copy/'connect.php').write_text("<?php $qa=json_decode(file_get_contents(getenv('PARITY_CONNECTION')),true);mysqli_report(MYSQLI_REPORT_OFF);$conn=new mysqli($qa['host'],'root',$qa['password'],$qa['database'],$qa['port']);$conn->set_charset('utf8');$conn->query(\"SET sql_mode=''\"); ?>",encoding='utf-8')
        self.wrapper=self.work/'run.php';self.wrapper.write_text("<?php error_reporting(0);foreach(['sub_paid_nb','send_nb_all','dead_nb_all','in_nb','in_nb2_m'] as $bare){define($bare,0);}register_shutdown_function(function(){ $e=error_get_last();if($e&&in_array($e['type'],[E_ERROR,E_PARSE,E_COMPILE_ERROR]))fwrite(STDERR,json_encode($e));});if(!function_exists('split')){function split($pattern,$text){return preg_split('~'.$pattern.'~',$text);}}if(!function_exists('mysql_fetch_row')){function mysql_fetch_row($result){return $result->fetch_row();}}date_default_timezone_set('Asia/Bangkok');$request=json_decode(file_get_contents($argv[1]),true);$_POST=$request['post'];$_GET=$request['get'];$_SESSION=['sess_ward'=>$request['ward'],'sess_uinid'=>'synthetic_admin','sess_uinname'=>'ผู้ดูแลสมมติ'];$_COOKIE=['cook_id'=>1];chdir($request['dir']);include $request['file'];",encoding='utf-8')
        self.copy=copy;OUT.mkdir(parents=True,exist_ok=True)
        return self
    def sql(self,text,check=True):
        r=subprocess.run([str(BIN/'mysql.exe'),'--defaults-file='+str(self.client),'--default-character-set=utf8','--batch','--skip-column-names'],input=text.encode(),capture_output=True,creationflags=self.flags)
        if check and r.returncode:raise RuntimeError('Synthetic MariaDB SQL failed: '+r.stderr.decode(errors='replace')[:300])
        return r
    def insert(self,table,values):
        self.sql('USE parity_phase4;INSERT INTO `'+table+'` ('+','.join('`'+k+'`' for k in values)+') VALUES('+','.join(map(quote,values.values()))+');')
    def run(self,name,file,post=None,get=None,ward='00'):
        rel=Path(file);source=self.copy/rel
        assert source.read_bytes()==(LEGACY/rel).read_bytes(), 'Report source changed'
        request=self.work/'request.json';request.write_text(json.dumps(dict(post=post or {},get=get or {},ward=ward,dir=str(source.parent),file=source.name)),encoding='utf-8')
        r=subprocess.run([str(PHP),'-d','display_errors=stderr',str(self.wrapper),str(request)],env={**os.environ,'PARITY_CONNECTION':str(self.context)},capture_output=True,creationflags=self.flags)
        html=r.stdout.decode('utf-8',errors='replace');(OUT/(name+'.html')).write_text(html,encoding='utf-8')
        parser=Tables();parser.feed(html)
        return dict(file=file,exit_code=r.returncode,error=r.stderr.decode('utf-8',errors='replace')[-2000:],tables=[t['rows'] for t in parser.tables if t['rows']])
    def __exit__(self,*args):
        if self.server:
            subprocess.run([str(BIN/'mysqladmin.exe'),'--defaults-file='+str(self.client),'shutdown'],stdout=self.log,stderr=self.log,creationflags=self.flags)
            try:self.server.wait(timeout=15)
            except subprocess.TimeoutExpired:self.server.terminate();self.server.wait(timeout=10)
        self.log.close()


def free_port():
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));return sock.getsockname()[1]


def seed(probe):
    # TODO: เชื่อม API — all values are synthetic P1 v1, not legacy patient data.
    import run_daily_workflow as fixture_source
    raw,profiles,specialties=fixture_source.fixtures()
    for code,name in [('10','หอสมมติ A'),('11','หอสมมติ B')]:probe.insert('ward',dict(ward=code,name=name,shortname=name,ward_group=1,ordering=int(code)))
    for n,label,short in [(1,'ดึก','ด'),(2,'เช้า','ช'),(3,'บ่าย','บ')]:probe.insert('wage_type',dict(wage_type_id=n,wage_type_name=label,wage_type_names=short))
    for m in range(1,13):probe.insert('tb_month',dict(month_id=f'{m:02d}',month_fname=f'เดือนสมมติ{m}',month_sname=f'{m:02d}',ordering=(m+2)%12))
    for row in raw:
        values={k:0 for k in [g+'_'+suffix for suffix in ('pt','nb') for g in ('on','in','move','home','move_b','send','dead','non_voluntary','ad')]}
        values.update({k:int(v) for k,v in row.items() if k.endswith(('_pt','_nb'))})
        values.update(zip(('patient_type'+str(n) for n in (5,4,3,2,1)),profiles[row['profile']]))
        values.update(ward=row['ward'],idate=row['idate'],wage_type_id=int(row['wage_type_id']),i_status=int(row['i_status']),amount_bed=int(row['amount_bed']),em_hn=1,em_rn=2,em_tn=1,em_pn=1,em_aid=1)
        probe.insert('data_all',values)
        if row['wage_type_id']=='3':
            codes=('obs','nb','gyn','surg','med','psych','skin','ped','ortho','eye','ent','dent','neuro_surg')
            probe.insert('data_split_patient',dict(ward=row['ward'],idate=row['idate'],**{c+'_'+g:specialties[row['id']].get(c+'_'+g,0) for c in codes for g in ('n','s')}))
    for code,day,cases,risk in [('10','2026-10-31',0,5),('10','2026-11-01',1,10),('10','2026-11-02',2,50),('11','2026-11-01',0,0)]:probe.insert('pressure',dict(ward=code,idate=day,do_pressure=cases,risk_pressure=risk))
    for code,month,a,b in [('10','2026-10',1,20),('11','2026-10',0,10),('10','2026-11',2,40),('11','2026-11',1,10)]:probe.insert('readmit',dict(ward=code,month1=month,idate=month+'-01',readmit_amount=a,discharge_amount=b))


def productivity_formulas():
    proof=[]
    for channel,file in [('screen','productivity.php'),('print','report/productivity_r.php'),('excel','report/productivity_r.php')]:
        source=(LEGACY/file).read_text(encoding='utf-8-sig')
        for period,prefix,field in [('day','num','wpatient'),('month','sum','sum_wpatient')]:
            snippet=re.search(r'(\$'+prefix+r'_patient_day5\s*=.*?\$'+prefix+r'_patient_day\s*=[^;]+;)',source,re.S)[1]
            assert not any(token in snippet for token in ('$conn','include','require','eval(','exec('))
            for code in ('10','12','13','28'):
                setup="$num_wage_day=3;$rw=['ward'=>'"+code+"'];"+''.join('$'+field+str(n)+'='+('9' if n in (4,5) else '0')+';' for n in (5,4,3,2,1))
                program='<?php '+setup+snippet+'\necho number_format(($'+prefix+'_patient_day*100)/126,2,".","");'
                result=subprocess.run([str(PHP)],input=program.encode(),capture_output=True,check=True)
                proof.append(dict(channel=channel,period=period,ward=code,file=file,php=float(result.stdout)))
    return proof


def main():
    results={}
    cases=[('daily','report_day.php','report/report_day_r.php'),('daily-all','report_day_all.php','report/report_day_all_r.php'),('monthly','report_month.php','report/report_month_r.php'),('census-day','on_pt_day.php','report/on_pt_day_r.php'),('census-month','on_pt.php','report/on_pt_r.php'),('turnover','bed_turn_overrate.php','report/bed_turn_overrate_r.php'),('los','los.php','report/los_r.php'),('occupancy','bed_rate.php','report/bed_rate_r.php'),('productivity','productivity.php','report/productivity_r.php'),('specialty','report_split_patient.php','report/split_patient_r.php'),('skill-mix','power_rate.php','report/power_rate_r.php'),('nursing-hours','hour_per_sleep.php','report/hour_per_sleep_r.php'),('pressure','pressure_rate.php','report/pressure_rate_r.php'),('pressure-detail','report/pressure_detail.php','report/pressure_detail.php'),('readmission','readmit_rate.php','report/readmit_rate_r.php')]
    with LegacyProbe() as probe:
        seed(probe)
        for kind,screen,printed in cases:
            params=dict(ward='10',idate='01/11/2569',dmy='01/11/2569',wage_type='1',wage_type_id='1',wage='1',month1='11',month2='11',month3='11',year1='2569',year2='2569',year3='2569',i_status='all',type_search='m',button='แสดงข้อมูล')
            if kind in {'turnover','los','occupancy','skill-mix','nursing-hours','pressure','readmission','pressure-detail'}:params.update(year1='2570')
            for channel,file in [('screen',screen),('print',printed),('excel','report/bed_rate_r.php' if kind=='readmission' else printed)]:
                request={**params,'ac':'e' if channel=='excel' else 'p'}
                results[kind+'-'+channel]=probe.run(kind+'-'+channel,file,post=request,get=request)
                print(kind,channel,results[kind+'-'+channel]['exit_code'],flush=True)
        span=dict(params,year1='2569',year2='2569',year3='2569',month1='10',month2='10',month3='11',type_search='r')
        results['census-month-span']=probe.run('census-month-span','on_pt.php',post=span,get=span)
        for channel,file in [('screen','report_month.php'),('print','report/report_month_r.php'),('excel','report/report_month_r.php')]:
            filtered=dict(params,year1='2569',i_status='1',ac='e' if channel=='excel' else 'p');results['monthly-confirmed-'+channel]=probe.run('monthly-confirmed-'+channel,file,post=filtered,get=filtered)
        # Isolated edge month: 10 PT and 20/20/25 beds, plus category-specific 2+3 counts.
        base={k:0 for k in ['on_pt','on_nb','in_pt','in_nb','move_pt','move_nb','home_pt','home_nb','move_b_pt','move_b_nb','send_pt','send_nb','dead_pt','dead_nb','non_voluntary_pt','non_voluntary_nb','ad_pt','ad_nb','patient_type5','patient_type4','patient_type3','patient_type2','patient_type1','em_hn','em_rn','em_tn','em_pn','em_aid']}
        for sid,bed in [(1,20),(2,20),(3,25)]:probe.insert('data_all',dict(base,ward='10',idate='2028-01-01',wage_type_id=sid,amount_bed=bed,on_pt=10,i_status=0))
        for code in ('10','11'):
            if code=='11':probe.insert('data_all',dict(base,ward=code,idate='2028-01-01',wage_type_id=3,amount_bed=10,on_pt=10,i_status=0))
            probe.insert('data_split_patient',dict(ward=code,idate='2028-01-01',med_n=2 if code=='10' else 3,med_s=7 if code=='10' else 11))
        for channel,file in [('screen','report_month.php'),('print','report/report_month_r.php'),('excel','report/report_month_r.php')]:
            edge=dict(params,year1='2571',month1='01',i_status='all');results['bed-edge-zero-'+channel]=probe.run('bed-edge-zero-'+channel,file,post=edge,get=edge)
        probe.sql("USE parity_phase4;UPDATE data_all SET in_pt=1,home_pt=1 WHERE idate='2028-01-01';")
        for channel,file in [('screen','report_month.php'),('print','report/report_month_r.php'),('excel','report/report_month_r.php')]:
            edge=dict(params,year1='2571',month1='01',i_status='all');results['bed-edge-'+channel]=probe.run('bed-edge-'+channel,file,post=edge,get=edge)
        for channel,file in [('screen','report_split_patient.php'),('print','report/split_patient_r.php'),('excel','report/split_patient_r.php')]:
            edge=dict(params,ward='0',month1='01',month2='01',year1='2571',year2='2571',i_status='all');results['specialty-edge-'+channel]=probe.run('specialty-edge-'+channel,file,post=edge,get=edge)
        # Complete leap February with constant beds makes even the SQL GROUP BY bed choice unambiguous.
        columns=['ward','idate','wage_type_id','amount_bed','on_pt','i_status',*list(k for k in base if k!='on_pt')]
        values=[[code,f'2028-02-{day:02d}',sid,25,10,0,*([0]*(len(columns)-6))] for code in ('10','11') for day in range(1,30) for sid in (1,2,3)]
        probe.sql('USE parity_phase4;INSERT INTO data_all('+','.join(columns)+') VALUES'+','.join('('+','.join(map(quote,row))+')' for row in values)+';')
        for channel,file in [('screen','bed_rate.php'),('print','report/bed_rate_r.php'),('excel','report/bed_rate_r.php')]:
            edge=dict(params,year1='2571',i_status='all');results['occupancy-complete-'+channel]=probe.run('occupancy-complete-'+channel,file,post=edge,get=edge)
        results['_runtime']=dict(compatibility=['split -> preg_split','mysql_fetch_row -> mysqli fetch_row','PHP5 numeric conversion of undefined bareword constants -> 0'],report_source_changed=False,private_database=True,real_legacy_records=False)
        results['_productivity_formulas']=productivity_formulas()
    (OUT/'legacy-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Legacy reports stopped private MariaDB; copied source unchanged. Results:',len(results))


if __name__=='__main__':main()
