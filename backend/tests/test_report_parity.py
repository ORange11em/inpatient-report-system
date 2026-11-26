import unittest
from datetime import date
from types import SimpleNamespace as NS
from app.reports import census_report, php_round
from app.schemas import COUNTER_FIELDS


class ReportParityTests(unittest.TestCase):
    def setUp(self):
        self.shifts={71:NS(legacy_shift_id=1,display_name='ดึก'),72:NS(legacy_shift_id=2,display_name='เช้า'),73:NS(legacy_shift_id=3,display_name='บ่าย')}
        self.wards={'a':NS(name='หอสมมติ A',report_group=1,legacy_code='10')}

    def entry(self,sid,**changes):
        fields=dict.fromkeys(COUNTER_FIELDS,0);fields.update(changes)
        return NS(ward_id='a',service_date=date(2027,3,1),shift_type_id=sid,amount_bed=25,status='unconfirmed',**fields)

    def test_rounding_matches_php_number_format_half_up(self):
        self.assertEqual(php_round(2.675),2.68);self.assertEqual(php_round(1.005),1.01)

    def test_nb_screen_print_and_month_typographical_expressions_are_channel_specific(self):
        entries=[self.entry(71,nb_on=10),self.entry(72,nb_on=10,nb_in=5,nb_send=2,nb_dead=1),self.entry(73,nb_on=12)]
        for kind in ('daily','monthly'):
            start=date(2027,3,1);end=start if kind=='daily' else date(2027,3,31)
            for channel,paid,remaining in [('screen',3,12),('print',0,15),('excel',0,15)]:
                result=census_report(kind,entries,self.shifts,self.wards,start,end,channel)
                row=next(r for r in result['rows'] if r[2]=='รวมวัน')
                self.assertEqual(row[result['columns'].index('รวมจำหน่าย NB')],paid)
                self.assertEqual(row[result['columns'].index('คงเหลือ NB')],remaining)
                if kind=='monthly':
                    row=result['rows'][-1]
                    self.assertEqual(row[result['columns'].index('รับใหม่ NB')],5 if channel=='screen' else 0)
                    self.assertEqual(row[result['columns'].index('คงเหลือ NB')],12 if channel=='screen' else 7)
                    self.assertEqual(row[result['columns'].index('ส่งต่อ NB')],0)
                    self.assertEqual(row[result['columns'].index('ตาย NB')],0)

    def test_census_nb_transfer_out_typo_does_not_change_daily_entry_counts(self):
        entries=[self.entry(71,nb_on=4),self.entry(73,nb_on=4,nb_move_b=1)]
        result=census_report('census-day',entries,self.shifts,self.wards,date(2027,3,1),date(2027,3,1))
        row=result['rows'][0]
        self.assertEqual(row[result['columns'].index('ย้ายตึก NB')],1)
        self.assertEqual(row[result['columns'].index('รวมจำหน่าย NB')],0)
        self.assertEqual(row[result['columns'].index('คงเหลือ NB')],4)
        self.assertEqual(entries[-1].nb_move_b,1)

    def test_month_census_print_nb_average_and_group2_opening_follow_their_source_rows(self):
        entries=[self.entry(71,pt_on=10,nb_on=4),self.entry(73,pt_on=10,nb_on=4)]
        for channel,expected in [('screen',.13),('print',0),('excel',0)]:
            result=census_report('census-month',entries,self.shifts,self.wards,date(2027,3,1),date(2027,3,31),channel)
            self.assertEqual(result['rows'][0][result['columns'].index('เฉลี่ยนอน NB')],expected)
            self.assertEqual(result['rows'][-1][result['columns'].index('ยกมา PT')],0)
            self.assertEqual(result['rows'][-2][result['columns'].index('ยกมา PT')],10)


if __name__=='__main__':unittest.main()
