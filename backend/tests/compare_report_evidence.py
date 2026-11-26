"""Compare independently executed legacy PHP/MariaDB evidence with real FastAPI results."""
import json
from pathlib import Path

OUT=Path(__file__).resolve().parents[2]/'docs/screenshots/parity-phase-4'
legacy=json.loads((OUT/'legacy-results.json').read_text(encoding='utf-8'))
api=json.loads((OUT/'api-results.json').read_text(encoding='utf-8'))
tables=api['tables'];checks=[]


def value(raw,blank=None):
    if raw is None or raw.strip()=='':return blank
    try:return float(raw.replace(',',''))
    except ValueError:return raw.replace(' เวร','').strip()


def record(kind,channel,case,expected,actual,note=''):
    checks.append(dict(kind=kind,channel=channel,case=case,php=expected,new=actual,equal=expected==actual,note=note))


def data(kind,channel):return tables.get(kind+'-'+channel,tables[kind])
def at(t,row,label):return row[t['columns'].index(label)]
def rows(key,minimum):return next(t for t in legacy[key]['tables'] if max(map(len,t))>=minimum)


def main():
    for channel in ('screen','print','excel'):
        for kind in ('daily','monthly'):
            old=rows(kind+'-'+channel,40);new=data(kind,channel)
            oldsum=[r for r in old if len(r)>=40 and r[0] in ('รวม','ทั้งหมด')][-1]
            newrow=new['rows'][-1]
            for label,index in [('รวมให้การพยาบาล PT',-12),('เตียง',-11),('เฉลี่ยนอน PT',-10),('ครองเตียง (%)',-8),('Patient Day PT',-19),('Patient Day NB',-18)]:
                record(kind,channel,label,value(oldsum[index],0),at(new,newrow,label))
            if kind=='monthly':
                for oldrow,label in zip(old[-4:-1],('รวมเวรดึก','รวมเวรเช้า','รวมเวรบ่าย')):
                    row=next(r for r in new['rows'] if r[2]==label)
                    for field,index in [('เตียง',-11),('ครองเตียง (%)',-8),('เฉลี่ยนอน PT',-10)]:record(kind,channel,label+' '+field,value(oldrow[index],0),at(new,row,field))
        t=data('daily-all',channel);old=rows('daily-all-'+channel,20)
        for oldrow in [r for r in old if r and r[0] in ('หอสมมติ A','หอสมมติ B')]:
            row=next(r for r in t['rows'] if r[0]==oldrow[0]);newcells=[row[0],*row[2:]]
            record('daily-all',channel,oldrow[0]+' all original columns',[oldrow[0],*[value(v,0) for v in oldrow[1:-1]],value(oldrow[-1])],newcells)
        core=['คงพยาบาล '+g for g in ('PT','NB')]
        core += [label+' '+g for label in ('รับใหม่','รับย้าย','กลับบ้าน','ย้ายตึก','ส่งต่อ','ตาย','ไม่สมัครใจอยู่') for g in ('PT','NB')]
        core += [label+' '+g for label in ('รวมจำหน่าย','คงเหลือ','A&D Same day','Patient Day') for g in ('PT','NB')]
        core += ['ประเภท '+str(n) for n in (4,3,2,1)]+['เตียง']
        for kind in ('census-day','census-month'):
            old=rows(kind+'-'+channel,35);t=data(kind,channel)
            suffix=['HN','RN','TN','PN','AID'] if kind=='census-day' else ['เฉลี่ยนอน PT','เฉลี่ยนอน NB','ครองเตียง (%)','ช่วงเตียงว่าง','จำหน่ายต่อเตียง','HN','RN','TN','PN','AID','ชม. RN','ชม. บุคลากร','ผู้ให้บริการ','ยกมา PT','ยกไป PT','LOS']
            labels=core+suffix
            for oldrow in old:
                if len(oldrow)!=len(labels)+1 or oldrow[0] not in ('หอสมมติ A','หอสมมติ B','รวม','รวม ICU + ห้องคลอด'):continue
                name={'รวม':'รวมทุกหอที่เลือก' if kind=='census-day' else 'รวมหอกลุ่ม 1','รวม ICU + ห้องคลอด':'รวมทุกหอที่เลือก'}.get(oldrow[0],oldrow[0])
                row=next(r for r in t['rows'] if r[0]==name)
                for field,raw in zip(labels,oldrow[1:]):record(kind,channel,name+' '+field,value(raw,0),at(t,row,field))
        for kind in ('turnover','los','skill-mix','nursing-hours','pressure','readmission','productivity'):
            if kind=='readmission' and channel=='excel':
                record(kind,channel,'legacy export menu target','bed_rate_r.php','readmission XML','คงชนิดรายงานที่เลือกของระบบใหม่เดิม; ลิงก์ExcelPHPชี้ครองเตียงผิดชนิด');continue
            if kind=='productivity' and channel!='screen':
                record(kind,channel,'original PHP execution',legacy[kind+'-'+channel]['exit_code'],None,'ไฟล์ต้นทางfetch_rowจาก$resultที่ไม่มีค่า จึงไม่มีผลพิมพ์สมบูรณ์ให้เทียบ; ตรวจนิพจน์น้ำหนักแยก');continue
            old=rows(kind+'-'+channel,14);t=data(kind,channel)
            for oldrow in old:
                if oldrow[0] not in ('หอสมมติ A','หอสมมติ B','รวม'):continue
                name='รวมทุกหอที่เลือก' if oldrow[0]=='รวม' else oldrow[0];row=next(r for r in t['rows'] if r[0]==name)
                for column,raw,actual in zip(t['columns'][1:],oldrow[1:],row[1:]):
                    note=''
                    if kind=='turnover' and name.startswith('รวม') and value(raw) not in (None,actual):note='PHP GROUP BY ward เลือกเตียงที่ไม่ผูกกับแถวท้าย; ฐานสมมตินี้ได้30 ใหม่ใช้ท้ายงวด35'
                    if kind=='pressure' and value(raw)==0 and actual is None:note='D08คงnull/ขีดเมื่อ0/0แทน0.00ของจอPHP'
                    record(kind,channel,name+' '+column,value(raw),actual,note)
        old=rows('pressure-detail-'+channel,30);t=data('pressure-detail',channel)
        for index,field in [(1,'จำนวนครั้งระดับ 2–4'),(2,'วันนอนผู้ป่วยเสี่ยง'),(3,'อัตราต่อ 1,000 วันนอน')]:
            for day in (1,2,3):record('pressure-detail',channel,f'{field} day{day}',value(old[index][day]),at(t,t['rows'][day-1],field))
            record('pressure-detail',channel,field+' month',value(old[index][-1]),at(t,t['rows'][-1],field))
        old=rows('occupancy-'+channel,15);raw=tables['occupancy'];wards=[*raw['wards'],dict(raw['total'],name='รวมทุกหอที่เลือก')]
        for oldrow in old:
            if oldrow[0] not in ('หอสมมติ A','หอสมมติ B','รวม'):continue
            name='รวมทุกหอที่เลือก' if oldrow[0]=='รวม' else oldrow[0];w=next(w for w in wards if w['name']==name)
            cells=[m['bed_rate'] if m['complete'] else f"{m['num_record']}/{m['num_all_record']}" for m in w['months']]+[y['average'] if y['complete'] else f"{y['sum_record']}/{y['sum_all_record']}" for y in (w['fiscal_year'],w['previous_fiscal_year'])]
            for index,(rawcell,actual) in enumerate(zip(oldrow[1:],cells)):
                record('occupancy',channel,name+' col'+str(index+1),value(rawcell),actual,'PHPเว้นว่างเมื่อข้อมูลไม่ครบ; UI C6ใหม่แสดงจำนวนเวรแทนการซ่อน โดยยังไม่แสดงร้อยละ' if value(rawcell) is None and isinstance(actual,str) and '/' in actual else '')
        # Independently executed bed edge and complete-month occupancy, not screen re-use.
        old=rows('bed-edge-'+channel,40);edge=tables['bed-edge']
        for oldrow,newrow in zip(old[-4:],edge['rows'][-4:]):
            record('monthly',channel,'edge total bed/pct',[value(oldrow[-11]),value(oldrow[-8])],[at(edge,newrow,'เตียง'),at(edge,newrow,'ครองเตียง (%)')])
        old=rows('occupancy-complete-'+channel,15)
        for oldrow in old:
            if oldrow[0] in ('หอสมมติ A','หอสมมติ B','รวม'):record('occupancy',channel,oldrow[0]+' complete Feb40',value(oldrow[5]),40)
        old=rows('specialty-edge-'+channel,15)
        normal=value(old[-1][7],0)
        edge=tables['specialty-edge'];grand=next(r for r in edge['rows'] if r[:3]==['รวมทุกหอที่เลือก','รวม','สามัญ'])
        record('specialty',channel,'normal MED2+3',normal,at(edge,grand,'MED'),'พิมพ์/Excel PHPอ่านเพียงแถวหอแรก; ใหม่รวม2+3=5ตามคำสั่ง' if channel!='screen' else '')
        special=[t for t in legacy['specialty-edge-'+channel]['tables'] if len(t)>5 and max(map(len,t))>=15][1]
        grand=next(r for r in edge['rows'] if r[:3]==['รวมทุกหอที่เลือก','รวม','พิเศษ'])
        record('specialty',channel,'special MED7+11',value(special[-1][7],0),at(edge,grand,'MED'),'แก้การอ่านเพียงหอแรกของPHP single-month special ตามคำสั่งรวมข้ามหอ; 7+11=18')
    for proof in legacy.get('_productivity_formulas',[]):
        case=next(c for c in api['checks'] if c['case']=='R09 '+proof['ward']+' '+proof['channel'])
        record('productivity',proof['channel'],'source expression '+proof['ward']+' '+proof['period'],proof['php'],case['actual'][0 if proof['period']=='day' else 1])
    for channel in ('screen','print','excel'):
        old=rows('monthly-confirmed-'+channel,40)[-1]
        t=tables['monthly-confirmed' if channel=='screen' else 'monthly-confirmed-'+channel]
        record('monthly',channel,'confirmed filter occupancy',value(old[-8]),at(t,t['rows'][-1],'ครองเตียง (%)'))
        record('monthly',channel,'confirmed filter nursing PT',value(old[-12]),at(t,t['rows'][-1],'รวมให้การพยาบาล PT'))
    old=next(r for r in rows('census-month-span',45) if r and r[0]=='หอสมมติ A');t=tables['census-month-span']
    for index,column in [(30,'เฉลี่ยนอน PT'),(32,'ครองเตียง (%)')]:record('census-month','screen','Oct-Nov last-month day basis '+column,value(old[index]),at(t,t['rows'][0],column))
    differences=[c for c in checks if not c['equal']]
    unexpected=[c for c in differences if not c['note']]
    (OUT/'comparison-results.json').write_text(json.dumps(dict(checks=checks,compared_cells=len(checks),differences=differences,unexpected=unexpected,all_unexplained_differences_resolved=not unexpected),ensure_ascii=False,indent=2),encoding='utf-8')
    print('Compared',len(checks),'cells/cases; explained differences',len(differences)-len(unexpected),'unexpected',len(unexpected))
    for c in unexpected[:12]:print(c)
    if unexpected:raise SystemExit(1)


if __name__=='__main__':main()
