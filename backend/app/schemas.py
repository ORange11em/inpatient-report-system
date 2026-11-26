from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.security import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validate_password_policy


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AnnouncementInput(StrictModel):
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(min_length=1)
    published: bool = False


class AnnouncementOut(AnnouncementInput):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    version: int
    created_at: datetime
    publisher_username: str | None = None


class LoginRequest(StrictModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=1024)


class UserOut(BaseModel):
    is_admin: bool = False
    id: UUID
    username: str
    full_name: str | None = None
    is_active: bool


class LoginOut(BaseModel):
    user: UserOut


class WardCreate(StrictModel):
    report_group: int = Field(default=1, ge=0, le=2)
    display_order: int = Field(default=0, ge=0, le=2147483647)
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=160)
    short_name: str | None = Field(default=None, max_length=40)
    legacy_code: str | None = Field(default=None, max_length=64)

    @field_validator("code", "name")
    @classmethod
    def reject_blank_text(cls, value):
        if not value.strip():
            raise ValueError("value cannot be blank")
        return value.strip()

    @field_validator("short_name", mode="before")
    @classmethod
    def normalize_optional_short_name(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value


class WardOut(BaseModel):
    can_write: bool = False
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    short_name: str | None = None
    legacy_code: str | None
    is_active: bool


class ShiftCreate(StrictModel):
    code: str = Field(min_length=1, max_length=32)
    display_name: str = Field(min_length=1, max_length=80)
    legacy_shift_id: int | None = Field(default=None, ge=1, le=32767)
    display_order: int = Field(default=0, ge=0, le=32767)

    @field_validator("code", "display_name")
    @classmethod
    def reject_blank_text(cls, value):
        if not value.strip():
            raise ValueError("value cannot be blank")
        return value.strip()

    @field_validator("legacy_shift_id", "display_order", mode="before")
    @classmethod
    def reject_boolean_numbers(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid integer")
        return value


class ShiftPatch(StrictModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    display_order: int | None = Field(default=None, ge=0, le=32767)
    is_active: bool | None = None

    @field_validator("display_name", "display_order")
    @classmethod
    def reject_null_updates(cls, value):
        if value is None:
            raise ValueError("field cannot be null")
        return value

    @field_validator("display_order", mode="before")
    @classmethod
    def reject_boolean_order(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid display order")
        return value


class ShiftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    display_name: str
    legacy_shift_id: int | None
    display_order: int
    is_active: bool


class CapacityCreate(StrictModel):
    effective_from: date
    effective_to: date | None = None
    bed_count: int = Field(gt=0, le=2147483647)

    @field_validator("bed_count", mode="before")
    @classmethod
    def reject_boolean_bed_count(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid bed count")
        return value


class CapacityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ward_id: UUID
    effective_from: date
    effective_to: date | None
    bed_count: int


SPECIALTY_CODES = (
    "obs", "nb", "gyn", "surg", "med", "psych", "skin",
    "ped", "ortho", "eye", "ent", "dent", "neuro_surg",
)


class SpecialtyValue(StrictModel):
    specialty_code: Literal[
        "obs", "nb", "gyn", "surg", "med", "psych", "skin",
        "ped", "ortho", "eye", "ent", "dent", "neuro_surg",
    ]
    category_code: Literal["n", "s"]
    count_value: int = Field(ge=0, le=2147483647)

    @field_validator("count_value", mode="before")
    @classmethod
    def reject_boolean_count(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid count")
        return value


COUNTER_FIELDS = (
    "pt_on", "pt_in", "pt_move", "pt_home", "pt_move_b", "pt_send", "pt_dead", "pt_non_voluntary", "pt_ad",
    "nb_on", "nb_in", "nb_move", "nb_home", "nb_move_b", "nb_send", "nb_dead", "nb_non_voluntary", "nb_ad",
    "patient_type1", "patient_type2", "patient_type3", "patient_type4", "patient_type5",
    "em_hn", "em_rn", "em_tn", "em_pn", "em_aid",
)


class PressureUpdate(StrictModel):
    stage2_4_cases: int = Field(ge=0, le=2147483647)
    at_risk_patient_days: int = Field(ge=0, le=2147483647)

    @field_validator("stage2_4_cases", "at_risk_patient_days", mode="before")
    @classmethod
    def reject_boolean_counts(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid count")
        return value


class ReadmissionUpdate(StrictModel):
    readmit_count: int = Field(ge=0, le=2147483647)
    discharge_count: int = Field(ge=0, le=2147483647)

    @field_validator("readmit_count", "discharge_count", mode="before")
    @classmethod
    def reject_boolean_counts(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid count")
        return value


class EntryIndicators(StrictModel):
    pressure: PressureUpdate | None = None
    readmission: ReadmissionUpdate | None = None
    previous_readmission: ReadmissionUpdate | None = None


class DailyEntryCreate(EntryIndicators):
    ward_id: UUID
    service_date: date
    shift_type_id: int = Field(gt=0)
    amount_bed: int = Field(gt=0, le=2147483647)
    pt_on: int = Field(default=0, ge=0, le=2147483647)
    pt_in: int = Field(default=0, ge=0, le=2147483647)
    pt_move: int = Field(default=0, ge=0, le=2147483647)
    pt_home: int = Field(default=0, ge=0, le=2147483647)
    pt_move_b: int = Field(default=0, ge=0, le=2147483647)
    pt_send: int = Field(default=0, ge=0, le=2147483647)
    pt_dead: int = Field(default=0, ge=0, le=2147483647)
    pt_non_voluntary: int = Field(default=0, ge=0, le=2147483647)
    pt_ad: int = Field(default=0, ge=0, le=2147483647)
    nb_on: int = Field(default=0, ge=0, le=2147483647)
    nb_in: int = Field(default=0, ge=0, le=2147483647)
    nb_move: int = Field(default=0, ge=0, le=2147483647)
    nb_home: int = Field(default=0, ge=0, le=2147483647)
    nb_move_b: int = Field(default=0, ge=0, le=2147483647)
    nb_send: int = Field(default=0, ge=0, le=2147483647)
    nb_dead: int = Field(default=0, ge=0, le=2147483647)
    nb_non_voluntary: int = Field(default=0, ge=0, le=2147483647)
    nb_ad: int = Field(default=0, ge=0, le=2147483647)
    patient_type1: int = Field(default=0, ge=0, le=2147483647)
    patient_type2: int = Field(default=0, ge=0, le=2147483647)
    patient_type3: int = Field(default=0, ge=0, le=2147483647)
    patient_type4: int = Field(default=0, ge=0, le=2147483647)
    patient_type5: int = Field(default=0, ge=0, le=2147483647)
    em_hn: int = Field(default=0, ge=0, le=2147483647)
    em_rn: int = Field(default=0, ge=0, le=2147483647)
    em_tn: int = Field(default=0, ge=0, le=2147483647)
    em_pn: int = Field(default=0, ge=0, le=2147483647)
    em_aid: int = Field(default=0, ge=0, le=2147483647)
    specialties: list[SpecialtyValue] = Field(default_factory=list, max_length=26)

    @field_validator("shift_type_id", "amount_bed", *COUNTER_FIELDS, mode="before")
    @classmethod
    def reject_boolean_numbers(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid integer count")
        return value

    @field_validator("service_date", mode="before")
    @classmethod
    def require_iso_calendar_date(cls, value):
        if isinstance(value, str) and (len(value) != 10 or value[4] != "-" or value[7] != "-"):
            raise ValueError("service_date must use Gregorian YYYY-MM-DD")
        return value


class DailyEntryPatch(EntryIndicators):
    expected_version: int = Field(ge=1)
    amount_bed: int | None = Field(default=None, gt=0, le=2147483647)
    pt_on: int | None = Field(default=None, ge=0, le=2147483647)
    pt_in: int | None = Field(default=None, ge=0, le=2147483647)
    pt_move: int | None = Field(default=None, ge=0, le=2147483647)
    pt_home: int | None = Field(default=None, ge=0, le=2147483647)
    pt_move_b: int | None = Field(default=None, ge=0, le=2147483647)
    pt_send: int | None = Field(default=None, ge=0, le=2147483647)
    pt_dead: int | None = Field(default=None, ge=0, le=2147483647)
    pt_non_voluntary: int | None = Field(default=None, ge=0, le=2147483647)
    pt_ad: int | None = Field(default=None, ge=0, le=2147483647)
    nb_on: int | None = Field(default=None, ge=0, le=2147483647)
    nb_in: int | None = Field(default=None, ge=0, le=2147483647)
    nb_move: int | None = Field(default=None, ge=0, le=2147483647)
    nb_home: int | None = Field(default=None, ge=0, le=2147483647)
    nb_move_b: int | None = Field(default=None, ge=0, le=2147483647)
    nb_send: int | None = Field(default=None, ge=0, le=2147483647)
    nb_dead: int | None = Field(default=None, ge=0, le=2147483647)
    nb_non_voluntary: int | None = Field(default=None, ge=0, le=2147483647)
    nb_ad: int | None = Field(default=None, ge=0, le=2147483647)
    patient_type1: int | None = Field(default=None, ge=0, le=2147483647)
    patient_type2: int | None = Field(default=None, ge=0, le=2147483647)
    patient_type3: int | None = Field(default=None, ge=0, le=2147483647)
    patient_type4: int | None = Field(default=None, ge=0, le=2147483647)
    patient_type5: int | None = Field(default=None, ge=0, le=2147483647)
    em_hn: int | None = Field(default=None, ge=0, le=2147483647)
    em_rn: int | None = Field(default=None, ge=0, le=2147483647)
    em_tn: int | None = Field(default=None, ge=0, le=2147483647)
    em_pn: int | None = Field(default=None, ge=0, le=2147483647)
    em_aid: int | None = Field(default=None, ge=0, le=2147483647)
    specialties: list[SpecialtyValue] | None = Field(default=None, max_length=26)

    @field_validator("expected_version", "amount_bed", *COUNTER_FIELDS, mode="before")
    @classmethod
    def reject_boolean_numbers(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid integer count")
        return value

    @model_validator(mode="before")
    @classmethod
    def reject_null_counters(cls, values):
        if isinstance(values, dict):
            null_fields = [name for name in COUNTER_FIELDS if name in values and values[name] is None]
            if null_fields:
                raise ValueError("counter fields cannot be null")
            if not any(name in values for name in (*COUNTER_FIELDS, "amount_bed", "specialties", "pressure", "readmission")):
                raise ValueError("at least one field must be updated")
        return values


class DailyEntryOut(BaseModel):
    id: UUID
    ward_id: UUID
    service_date: date
    shift_type_id: int
    status: str
    version: int
    amount_bed: int | None
    pt_on: int
    pt_in: int
    pt_move: int
    pt_home: int
    pt_move_b: int
    pt_send: int
    pt_dead: int
    pt_non_voluntary: int
    pt_ad: int
    nb_on: int
    nb_in: int
    nb_move: int
    nb_home: int
    nb_move_b: int
    nb_send: int
    nb_dead: int
    nb_non_voluntary: int
    nb_ad: int
    patient_type1: int
    patient_type2: int
    patient_type3: int
    patient_type4: int
    patient_type5: int
    em_hn: int
    em_rn: int
    em_tn: int
    em_pn: int
    em_aid: int
    specialties: list[SpecialtyValue] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SubmissionEventOut(BaseModel):
    id: UUID
    action_code: Literal["created", "updated", "confirmed", "returned", "legacy_confirmed"]
    from_status: str | None
    to_status: str | None
    actor_username: str | None
    reason: str | None
    occurred_at: datetime | None


class EntryFormOut(BaseModel):
    entry: DailyEntryOut | None
    pt_on: int
    nb_on: int
    amount_bed: int | None
    source_date: date | None
    source_shift_id: int | None
    readmission: ReadmissionUpdate | None
    pressure: PressureUpdate | None


class ConfirmRequest(StrictModel):
    expected_version: int = Field(ge=1)

    @field_validator("expected_version", mode="before")
    @classmethod
    def reject_boolean_version(cls, value):
        if isinstance(value, bool):
            raise ValueError("boolean is not a valid version")
        return value


class ReturnRequest(ConfirmRequest):
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason")
    @classmethod
    def reject_blank_reason(cls, value):
        if not value.strip():
            raise ValueError("reason cannot be blank")
        return value.strip()


class DailyReportOut(BaseModel):
    service_date: date
    entries: list[DailyEntryOut]


class PressureOut(BaseModel):
    ward_id: UUID
    service_date: date
    stage2_4_cases: int
    at_risk_patient_days: int


class ReadmissionOut(BaseModel):
    ward_id: UUID
    reporting_month: date
    readmit_count: int
    discharge_count: int


class AdminWardRole(StrictModel):
    ward_id: UUID
    role_code: Literal["ward_recorder", "report_reader"]


class UserCreate(StrictModel):
    username: str = Field(min_length=3, max_length=80)
    full_name: str | None = Field(default=None, max_length=160)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    global_role: Literal["system_admin", "auditor"] | None = None
    ward_roles: list[AdminWardRole] = Field(default_factory=list, max_length=100)

    @field_validator("username")
    @classmethod
    def normalize_username_spacing(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("username must contain at least 3 non-space characters")
        return value

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_optional_full_name(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("password")
    @classmethod
    def check_password_policy(cls, value: str) -> str:
        return validate_password_policy(value)


class AdminUserOut(BaseModel):
    id: UUID
    username: str
    full_name: str | None = None
    is_active: bool
    created_at: datetime
    global_role: Literal["system_admin", "auditor"] | None = None
    ward_roles: list[AdminWardRole] = Field(default_factory=list)


class UserRolesUpdate(StrictModel):
    full_name: str | None = Field(default=None, max_length=160)
    global_role: Literal["system_admin", "auditor"] | None = None
    ward_roles: list[AdminWardRole] | None = Field(default=None, max_length=100)
    is_active: bool | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_optional_full_name(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @model_validator(mode="before")
    @classmethod
    def require_any_change(cls, values):
        if isinstance(values, dict) and not any(
            key in values for key in ("full_name", "global_role", "ward_roles", "is_active")
        ):
            raise ValueError("at least one field must be updated")
        return values


class AdminPasswordResetRequest(StrictModel):
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def check_password_policy(cls, value: str) -> str:
        return validate_password_policy(value)


class ChangePasswordRequest(StrictModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def check_password_policy(cls, value: str) -> str:
        return validate_password_policy(value)


class CapacityRangeQuery(BaseModel):
    from_date: date | None = None
    to_date: date | None = None


class OccupancyMonthOut(BaseModel):
    month: str
    num_day: int
    num_record: int
    num_all_record: int
    complete: bool
    on_pt: int
    in_pt: int
    move_pt: int
    home_pt: int
    move_b_pt: int
    send_pt: int
    dead_pt: int
    non_voluntary_pt: int
    ad_pt: int
    result_pt: int
    patient_day: int
    avg_sleep: float
    amount_bed: int | None
    bed_rate: float | None


class OccupancyYearSummaryOut(BaseModel):
    num_month: int
    sum_record: int
    sum_all_record: int
    complete: bool
    average: float | None


class OccupancyWardOut(BaseModel):
    ward_id: UUID
    code: str
    name: str
    months: list[OccupancyMonthOut]
    fiscal_year: OccupancyYearSummaryOut
    previous_fiscal_year: OccupancyYearSummaryOut


class OccupancyTotalOut(BaseModel):
    months: list[OccupancyMonthOut]
    fiscal_year: OccupancyYearSummaryOut
    previous_fiscal_year: OccupancyYearSummaryOut


class OccupancyReportOut(BaseModel):
    fiscal_year_end: int
    fiscal_year_start: int
    formula_id: str
    formula_note: str
    status_filter: str
    night_shift: ShiftOut | None
    months: list[str]
    wards: list[OccupancyWardOut]
    total: OccupancyTotalOut
