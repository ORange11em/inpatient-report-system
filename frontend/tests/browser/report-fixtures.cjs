// TODO: เชื่อม API — fictitious wards, accounts and counts; no patient records.
const wards=Array.from({length:34},(_,i)=>({id:'example-'+i,name:'  หอผู้ป่วยตัวอย่าง    '+String(i+1).padStart(2,'0')+' ชื่อยาวสำหรับตรวจตาราง',code:'E'+i,can_write:true}));
const shifts=[{id:73,legacy_shift_id:3,display_order:3,display_name:'บ่าย',is_active:true},{id:11,legacy_shift_id:1,display_order:1,display_name:'ดึก',is_active:true},{id:22,legacy_shift_id:2,display_order:2,display_name:'เช้า',is_active:true}];
const flow=['คงพยาบาล','รับใหม่','รับย้าย','กลับบ้าน','ย้ายตึก','ส่งต่อ','ตาย','ไม่สมัครใจอยู่','A&D Same day'].flatMap(s=>[s+' PT',s+' NB']);
const staff=['HN','RN','TN','PN','AID'];
const censusColumns=['หอผู้ป่วย','วันที่ / ช่วง','เวร',...flow,'รวมจำหน่าย PT','รวมจำหน่าย NB','คงเหลือ PT','คงเหลือ NB','Patient Day PT','Patient Day NB',...['5','4','3','2','1'].map(n=>'ประเภท '+n),...staff,'เตียง','เฉลี่ยนอน PT','เฉลี่ยนอน NB','ครองเตียง (%)','จำหน่ายต่อเตียง','ช่วงเตียงว่าง','สถานะ'];
const monthNames=year=>Array.from({length:12},(_,i)=>(i<3?year-1:year)+'-'+String((i+9)%12+1).padStart(2,'0'));
const annual=(complete,average,recorded=1095)=>({complete,average,sum_record:recorded,sum_all_record:1095,num_month:complete?12:0});
function occupancy(year=2027,empty=false){
 const months=monthNames(year);
 const list=empty?[]:wards.map((w,i)=>({...w,ward_id:w.id,months:months.map((month,m)=>({month,num_day:31,num_record:i===1?45:93,num_all_record:93,complete:i!==1,bed_rate:i===2?null:i===3?0:83.12+m,amount_bed:30})),fiscal_year:annual(i!==1,i===2?null:i===3?0:90,i===1?540:1095),previous_fiscal_year:annual(i!==1,i===2?null:85,i===1?420:1095)}));
 return {fiscal_year_end:year,fiscal_year_start:year-1,formula_id:'legacy_monthly_temporary_v1',formula_note:'สูตรชั่วคราวสำหรับทดสอบ',status_filter:'all',months,wards:list,night_shift:shifts[1],total:{months:months.map(month=>({month,num_record:93,num_all_record:93,complete:true,bed_rate:77.77})),fiscal_year:annual(true,77.77),previous_fiscal_year:annual(true,70.01)}};
}
function summary(kind,params,empty=false){
 const selected=params.get('selected')||'2026-11-19',range=selected+' – '+(params.get('through')||selected),year=Number(selected.slice(0,4));
 let columns,rows;
 if(['daily','monthly','census-day','census-month'].includes(kind)){
  columns=[...censusColumns,...(kind.startsWith('census-')?['ยกมา PT','ยกไป PT','ชม. RN','ชม. บุคลากร','ผู้ให้บริการ','LOS']:[])];
  rows=wards.flatMap((w,i)=>['บ่าย','รวมวัน'].map((shift,n)=>columns.map((c,j)=>j===0?w.name:j===1?kind==='census-month'?range:selected:j===2?shift:c==='สถานะ'?n?'':'รอยืนยัน':j===4?0:j===5?null:c==='ครองเตียง (%)'?83.12:20+i+j)));
 }else if(kind==='daily-all'){columns=['หอผู้ป่วย','เวร','คงพยาบาล PT','คงพยาบาล NB','รวมรับ PT','รวมรับ NB','รวมจำหน่าย PT','รวมจำหน่าย NB','รวมให้การพยาบาล PT',...['5','4','3','2','1'].map(n=>'ประเภท '+n),'คงเหลือ PT','คงเหลือ NB',...staff];rows=wards.map((w,i)=>columns.map((c,j)=>j===0?w.name:j===1?'บ่าย':j===3?0:20+i+j));}
 else if(kind==='specialty'){columns=['หอผู้ป่วย','ช่วงข้อมูล','ห้อง','คงเหลือ PT','คงเหลือ NB','MED','SUR','รวมสาขา'];rows=wards.map((w,i)=>[w.name,selected,'สามัญ',20,0,10,10,20]);}
 else if(kind==='pressure-detail'){columns=['หอผู้ป่วย','วันที่','จำนวนครั้งระดับ 2–4','วันนอนผู้ป่วยเสี่ยง','อัตราต่อ 1,000 วันนอน'];rows=wards.map(w=>[w.name,selected,0,93,0]);}
 else if(kind==='productivity'){columns=['หอผู้ป่วย',...Array.from({length:30},(_,i)=>String(i+1)),'รวมเดือน (%)'];rows=wards.map(w=>[w.name,...Array.from({length:30},(_,i)=>i%3?83.12:null),89.12]);}
 else{columns=['หอผู้ป่วย',...monthNames(year).map(m=>m.slice(5)+'/'+(Number(m.slice(0,4))+543)),kind==='los'?'เฉลี่ยปี':'รวมปี',...(kind==='turnover'?['รวมปีก่อน','เฉลี่ยต่อเดือนปีก่อน']:[])];rows=[...wards.map((w,i)=>columns.map((c,j)=>j===0?w.name:j===1?0:j===2?null:83.12+i)),columns.map((c,j)=>j===0?'รวมทุกหอที่เลือก':999.12)];}
 if(params.get('ward_id'))rows=rows.filter(r=>r[0]===wards.find(w=>w.id===params.get('ward_id'))?.name);
 return {columns,rows:empty?[]:rows};
}
function dailyEntries(){
 const zero=Object.fromEntries(['pt','nb'].flatMap(g=>['on','in','move','home','move_b','send','dead','non_voluntary','ad'].map(k=>[g+'_'+k,0])));
 return wards.slice(0,-1).flatMap((w,i)=>shifts.filter((s,j)=>i!==1||j===0).map(s=>({...zero,id:w.id+'-'+s.id,ward_id:w.id,service_date:'2026-11-19',shift_type_id:s.id,status:s.id===73?'unconfirmed':'confirmed',version:1,pt_on:10,pt_in:2,pt_home:1,amount_bed:30,specialties:[],created_at:'2026-11-19T01:00:00Z',updated_at:'2026-11-19T03:00:00Z'})));
}
module.exports={wards,shifts,occupancy,summary,dailyEntries};
