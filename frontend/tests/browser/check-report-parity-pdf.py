"""Verify and render actual browser PDFs with bundled PDF libraries and Poppler."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import subprocess
import unicodedata

from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'docs/screenshots/parity-phase-4'


def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKD',text or '') if not unicodedata.combining(c) and not c.isspace() and c!='\x00')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pdftoppm',required=True);args=parser.parse_args()
    cases=json.loads((OUT/'browser-results.json').read_text(encoding='utf-8'))['checks'];results=[];firsts=[]
    dest=OUT/'print';dest.mkdir(exist_ok=True)
    for case in cases:
        file=ROOT/case['pdf'];reader=PdfReader(file);pages=[];row_count=0
        with pdfplumber.open(file) as layout:
            for i,(page,geometry) in enumerate(zip(reader.pages,layout.pages)):
                width,height=float(page.mediabox.width),float(page.mediabox.height);text=page.extract_text() or '';norm=normalized(text)
                assert abs(width-841.89)<2 and abs(height-595.28)<2,(case['key'],width,height)
                for required in ('โรงพยาบาลอากาศอำนวย','ผู้พิมพ์','หอผู้ป่วย'):assert normalized(required) in norm,(case['key'],i,required)
                assert normalized('ข้ามไปเนื้อหาหลัก') not in norm
                assert not re.search(r'20(?:26|27|28)-\d{2}',text),(case['key'],'ISO date printed')
                assert geometry.chars and all(-1<=c['x0']<=c['x1']<=width+1 and -1<=c['top']<=c['bottom']<=height+1 for c in geometry.chars),(case['key'],i,'out of page')
                rows=0
                for table in geometry.extract_tables():
                    for row in table:
                        first=normalized(row[0]) if row else ''
                        if first.startswith(normalized('หอสมมติ')) or first.startswith(normalized('รวม')):rows+=1
                assert rows>0,(case['key'],i,'blank or header-only page');row_count+=rows
                pages.append(dict(page=i+1,A4_landscape=True,repeated_header=True,text_within_page=True,data_rows=rows))
        expected=case['screenRows']*case['printPanels'];assert row_count==expected,(case['key'],'missing/repeated body rows',row_count,expected)
        prefix=dest/case['key'];r=subprocess.run([args.pdftoppm,'-r','110','-png',str(file),str(prefix)],capture_output=True)
        assert r.returncode==0,(case['key'],'Poppler render failed')
        images=sorted(dest.glob(case['key']+'-*.png'));images=[p for p in images if re.search(r'-\d+\.png$',p.name)]
        assert len(images)==len(reader.pages),(case['key'],'render count')
        contact=Image.new('RGB',(800,320*((len(images)+1)//2)),'white');draw=ImageDraw.Draw(contact)
        for index,p in enumerate(images):
            with Image.open(p) as im:
                im.thumbnail((400,295));x,y=(index%2)*400,(index//2)*320;contact.paste(im,(x,y+20));draw.text((x+8,y+4),case['key']+' '+str(index+1),fill='black')
        contact.save(dest/(case['key']+'-contact.jpg'),quality=90);firsts.append(images[0])
        results.append(dict(key=case['key'],pdf=case['pdf'],pages=pages,data_rows=row_count,expected_data_rows=expected,rendered_all_pages=True))
        print('PASS PDF',case['key'],len(reader.pages),'pages,',row_count,'rows',flush=True)
    montage=Image.new('RGB',(1600,320*((len(firsts)+3)//4)),'white');draw=ImageDraw.Draw(montage)
    for index,p in enumerate(firsts):
        with Image.open(p) as im:
            im.thumbnail((400,295));x,y=(index%4)*400,(index//4)*320;montage.paste(im,(x,y+20));draw.text((x+8,y+4),cases[index]['key'],fill='black')
    montage.save(dest/'all-reports.jpg',quality=90)
    (OUT/'pdf-results.json').write_text(json.dumps(dict(passed=True,reports=results,total_pages=sum(len(r['pages']) for r in results)),ensure_ascii=False,indent=2),encoding='utf-8')


if __name__=='__main__':main()
