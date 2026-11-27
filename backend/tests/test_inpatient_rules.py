from datetime import date
from types import SimpleNamespace as Row
from unittest import TestCase
import asyncio

from fastapi import HTTPException
from pydantic import ValidationError

from app import api, reports
from app.schemas import (
    AdminPasswordResetRequest,
    AdminUserOut,
    COUNTER_FIELDS,
    ChangePasswordRequest,
    DailyEntryCreate,
    LoginRequest,
    UserCreate,
    UserOut,
    UserRolesUpdate,
    WardCreate,
    WardOut,
)
from app.security import hash_password, validate_password_policy, verify_password
from app.cli.import_legacy import LegacyEntryInput
from uuid import uuid4


class InpatientRules(TestCase):
    def setUp(self):
        self.ward = Row(id=uuid4(), name="Ward A", legacy_code="10")
        self.wards = {self.ward.id: self.ward}
        self.shifts = {i+10: Row(id=i+10, legacy_shift_id=i, display_name=str(i)) for i in (1,2,3)}
        self.day = date(2026, 11, 1)

    def entry(self, shift, **counts):
        values = dict.fromkeys(COUNTER_FIELDS, 0)
        values.update(counts)
        return Row(id=uuid4(), ward_id=self.ward.id, service_date=self.day, status="unconfirmed",
                   shift_type_id=shift+10, amount_bed=30, **values)

    def test_all_discharge_routes_and_same_day(self):
        for group in ("pt","nb"):
            counts = {group+"_"+k: 1 for k in reports.PAID}
            counts.update({group+"_on":10, group+"_in":2, group+"_move":1, group+"_ad":4})
            row = self.entry(3, **counts)
            self.assertEqual(reports.closing_count(row, group), 8)
            c = reports.summarize([row], self.shifts, opening="all")
            self.assertEqual(c[group+"_days"], 12)

    def test_shift_daily_and_monthly_opening_rules(self):
        rows = [self.entry(1,pt_on=10,pt_in=3,pt_home=1,pt_ad=2), self.entry(2,pt_on=12,pt_move=1),
                self.entry(3,pt_on=13,pt_move_b=1,pt_ad=1)]
        result = reports.census_report("monthly", rows, self.shifts, self.wards, self.day, reports.month_end(self.day))
        values = [dict(zip(result["columns"], row)) for row in result["rows"]]
        self.assertEqual(values[0]["ครองเตียง (%)"], 40)
        self.assertEqual(values[3]["Patient Day PT"], 15)
        self.assertEqual(values[-1]["ครองเตียง (%)"], 50)  # one recorded day in the monthly activity report
        self.assertEqual(values[-1]["คงพยาบาล PT"], 10)
        self.assertEqual(reports.fiscal_value("los",rows,self.shifts), 15/14)
        self.assertEqual(reports.fiscal_value("turnover",rows,self.shifts), 2/30)

    def test_staff_mix_nursing_hours_and_productivity_weights(self):
        rows = [self.entry(1,pt_on=14,patient_type5=3,em_hn=1,em_rn=2,em_tn=1,em_pn=1,em_aid=1)]
        self.assertEqual(reports.fiscal_value("nursing-hours",rows,self.shifts), 2.5)
        self.assertEqual(reports.fiscal_value("skill-mix",rows,self.shifts), 60)
        for code, expected in (("10", 7.5), ("28", 7.5), ("12", 12), ("13", 12)):
            self.ward.legacy_code = code
            for channel in ("screen", "print", "excel"):
                result = reports.productivity_report(rows, self.shifts, self.wards, self.day, channel)["rows"][0]
                self.assertAlmostEqual(result[1], round(expected * 100 / 42, 2))
                self.assertAlmostEqual(result[-1], round(expected * 100 / 42, 2))

    def test_indicator_rates_are_weighted_across_months(self):
        def pressure(month, cases, risk):
            return Row(ward_id=self.ward.id, service_date=date(2026,month,1), stage2_4_cases=cases, at_risk_patient_days=risk)
        rows = [pressure(10,1,10), pressure(11,2,50)]
        result = reports.fiscal_report("pressure",rows,self.shifts,self.wards,2027)
        self.assertEqual(result["rows"][0][1:3], [100,40])
        self.assertEqual(result["rows"][-1][-1], 50)
        self.assertIsNone(reports.fiscal_value("pressure",[pressure(10,0,0)],self.shifts))
        self.assertEqual(reports.fiscal_value("readmission",[Row(readmit_count=2,discharge_count=20)],self.shifts),10)

    def test_beds_required_on_new_forms_nullable_on_historical_imports(self):
        fields = dict(ward_id=self.ward.id, service_date=self.day, shift_type_id=11)
        with self.assertRaises(ValidationError):
            DailyEntryCreate(**fields)
        self.assertIsNone(LegacyEntryInput(**fields).amount_bed)

    def test_password_policy_requires_length_uppercase_and_special(self):
        self.assertEqual(validate_password_policy("Nurse@01"), "Nurse@01")
        self.assertEqual(UserCreate(username="nurse1", password="Ward!2026").password, "Ward!2026")
        self.assertEqual(AdminPasswordResetRequest(new_password="Reset#99").new_password, "Reset#99")
        self.assertEqual(
            ChangePasswordRequest(current_password="old", new_password="Change$1").new_password,
            "Change$1",
        )
        # Login keeps accepting legacy passwords so existing accounts are not locked out.
        self.assertEqual(LoginRequest(username="nurse1", password="old").password, "old")

        for bad in (
            "Ab!1234",          # 7 characters (< 8)
            "nurse@2026",       # missing uppercase
            "Nurse2026",        # missing special character
            "Nurse   1",        # space does not count as special character
            "Nurseกั123",       # Thai combining mark does not count as special character
            "A!" + "a" * 255,   # exceeds 256 characters
        ):
            with self.subTest(password=bad):
                with self.assertRaises(ValueError):
                    validate_password_policy(bad)
                with self.assertRaises(ValidationError):
                    UserCreate(username="nurse1", password=bad)
                with self.assertRaises(ValidationError):
                    AdminPasswordResetRequest(new_password=bad)
                with self.assertRaises(ValidationError):
                    ChangePasswordRequest(current_password="old", new_password=bad)

    def test_password_change_and_admin_self_lockout_guards(self):
        class FakeDB:
            def __init__(self, users):
                self.users = users
                self.executed = []
                self.committed = False

            async def get(self, model, pk):
                return self.users.get(pk)

            async def execute(self, stmt):
                self.executed.append(stmt)

            async def commit(self):
                self.committed = True

        user = Row(id=uuid4(), username="nurse1", password_hash=hash_password("OldPass@1"), is_active=True)
        session = Row(id=uuid4(), user_id=user.id)
        db = FakeDB({user.id: user})

        # Wrong current password rejected
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(
                api.change_password(
                    ChangePasswordRequest(current_password="wrong", new_password="NewPass@1"),
                    db,
                    (user, session),
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "invalid_current_password")

        # Correct current password updates hash and revokes other sessions
        resp = asyncio.run(
            api.change_password(
                ChangePasswordRequest(current_password="OldPass@1", new_password="NewPass@1"),
                db,
                (user, session),
            )
        )
        self.assertEqual(resp.status_code, 204)
        self.assertTrue(verify_password("NewPass@1", user.password_hash))
        self.assertTrue(db.committed)
        self.assertEqual(len(db.executed), 1)

        # Admin cannot deactivate self or remove own system_admin role
        admin = Row(id=uuid4(), username="admin1", password_hash=hash_password("Admin@123"), is_active=True)
        admin_db = FakeDB({admin.id: admin, user.id: user})
        for payload in (
            UserRolesUpdate(is_active=False),
            UserRolesUpdate(global_role=None),
            UserRolesUpdate(global_role="auditor"),
        ):
            with self.subTest(payload=payload):
                with self.assertRaises(HTTPException) as ctx:
                    asyncio.run(api.update_user(admin.id, payload, admin_db, admin))
                self.assertEqual(ctx.exception.status_code, 400)
                self.assertEqual(ctx.exception.detail, "cannot_modify_own_admin_access")

        # Admin reset password updates target hash and revokes target sessions
        reset_resp = asyncio.run(
            api.reset_user_password(
                user.id,
                AdminPasswordResetRequest(new_password="Reset@2026"),
                admin_db,
                (admin, Row(id=uuid4())),
                admin,
            )
        )
        self.assertEqual(reset_resp.status_code, 204)
        self.assertTrue(verify_password("Reset@2026", user.password_hash))
        self.assertTrue(admin_db.committed)

    def test_optional_user_full_name_and_ward_short_name_schemas(self):
        created = UserCreate(username="nurse1", full_name="  พยาบาลวิชาชีพ สมมติ  ", password="Ward!2026")
        self.assertEqual(created.full_name, "พยาบาลวิชาชีพ สมมติ")
        blank_name = UserCreate(username="nurse2", full_name="   ", password="Ward!2026")
        self.assertIsNone(blank_name.full_name)

        patch_name = UserRolesUpdate(full_name="  หัวหน้าหอผู้ป่วย สมมติ ")
        self.assertEqual(patch_name.full_name, "หัวหน้าหอผู้ป่วย สมมติ")
        clear_name = UserRolesUpdate(full_name="")
        self.assertIsNone(clear_name.full_name)

        user_out = UserOut(id=uuid4(), username="nurse1", full_name="พยาบาลวิชาชีพ สมมติ", is_active=True)
        self.assertEqual(user_out.full_name, "พยาบาลวิชาชีพ สมมติ")

        ward_with_short = WardCreate(code="10", name="อายุรกรรมชาย", short_name="  อช ", legacy_code="10")
        self.assertEqual(ward_with_short.short_name, "อช")
        ward_without_short = WardCreate(code="22", name="สังเกตุอาการณ์", short_name="   ", legacy_code="22")
        self.assertIsNone(ward_without_short.short_name)
        ward_out = WardOut(id=uuid4(), code="10", name="อายุรกรรมชาย", short_name="อช", legacy_code="10", is_active=True)
        self.assertEqual(ward_out.short_name, "อช")


