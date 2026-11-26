import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


DAILY_COUNT_FIELDS = (
    "pt_on", "pt_in", "pt_move", "pt_home", "pt_move_b", "pt_send", "pt_dead", "pt_non_voluntary", "pt_ad",
    "nb_on", "nb_in", "nb_move", "nb_home", "nb_move_b", "nb_send", "nb_dead", "nb_non_voluntary", "nb_ad",
    "patient_type1", "patient_type2", "patient_type3", "patient_type4", "patient_type5",
    "em_hn", "em_rn", "em_tn", "em_pn", "em_aid",
)


class Base(DeclarativeBase):
    pass


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(240))
    body: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", name="fk_announcement_updated_by", ondelete="SET NULL"))
    publisher_username: Mapped[str | None] = mapped_column(String(80))


class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(40))
    legacy_code: Mapped[str | None] = mapped_column(String(64), unique=True)
    report_group: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="1")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")


class ShiftType(Base):
    __tablename__ = "shift_types"
    __table_args__ = (
        CheckConstraint("legacy_shift_id IS NULL OR legacy_shift_id > 0", name="ck_shift_legacy_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    legacy_shift_id: Mapped[int | None] = mapped_column(SmallInteger, unique=True)
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(username) BETWEEN 3 AND 80", name="ck_user_username_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(80), nullable=False)
    username_normalized: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    full_name: Mapped[str | None] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class UserGlobalRole(Base):
    __tablename__ = "user_global_roles"
    __table_args__ = (
        CheckConstraint("role_code IN ('system_admin', 'auditor')", name="ck_global_role_code"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_code: Mapped[str] = mapped_column(String(32), primary_key=True)


class UserWardRole(Base):
    __tablename__ = "user_ward_roles"
    __table_args__ = (
        CheckConstraint("role_code IN ('ward_recorder', 'report_reader')", name="ck_ward_role_code"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    ward_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wards.id", ondelete="CASCADE"), primary_key=True)
    role_code: Mapped[str] = mapped_column(String(32), primary_key=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    csrf_token_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WardCapacityHistory(Base):
    __tablename__ = "ward_capacity_history"
    __table_args__ = (
        CheckConstraint("bed_count > 0", name="ck_capacity_positive"),
        CheckConstraint("effective_to IS NULL OR effective_to >= effective_from", name="ck_capacity_date_order"),
    )

    ward_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wards.id", ondelete="CASCADE"), primary_key=True)
    effective_from: Mapped[date] = mapped_column(Date, primary_key=True)
    effective_to: Mapped[date | None] = mapped_column(Date)
    bed_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DailyEntry(Base):
    __tablename__ = "daily_entries"
    __table_args__ = (
        UniqueConstraint("ward_id", "service_date", "shift_type_id", name="uq_daily_entry_ward_date_shift"),
        CheckConstraint("status IN ('unconfirmed', 'confirmed')", name="ck_daily_entry_status"),
        CheckConstraint("version >= 1", name="ck_daily_entry_version"),
        CheckConstraint("amount_bed IS NULL OR amount_bed > 0", name="ck_daily_entry_bed_positive"),
        CheckConstraint(" AND ".join(f"{field} >= 0" for field in DAILY_COUNT_FIELDS), name="ck_daily_entry_counts_nonnegative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ward_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wards.id"), nullable=False)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("shift_types.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="unconfirmed", server_default="unconfirmed")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    amount_bed: Mapped[int | None] = mapped_column(Integer)

    pt_on: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_move: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_home: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_move_b: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_send: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_dead: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_non_voluntary: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    pt_ad: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    nb_on: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_in: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_move: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_home: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_move_b: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_send: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_dead: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_non_voluntary: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    nb_ad: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    patient_type1: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    patient_type2: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    patient_type3: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    patient_type4: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    patient_type5: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    em_hn: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    em_rn: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    em_tn: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    em_pn: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    em_aid: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SpecialtyCount(Base):
    __tablename__ = "specialty_counts"
    __table_args__ = (
        CheckConstraint("specialty_code IN ('obs','nb','gyn','surg','med','psych','skin','ped','ortho','eye','ent','dent','neuro_surg')", name="ck_specialty_code"),
        CheckConstraint("category_code IN ('n','s')", name="ck_specialty_category"),
        CheckConstraint("count_value >= 0", name="ck_specialty_count_nonnegative"),
    )

    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_entries.id", ondelete="CASCADE"), primary_key=True)
    specialty_code: Mapped[str] = mapped_column(String(24), primary_key=True)
    category_code: Mapped[str] = mapped_column(String(1), primary_key=True)
    count_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class PressureDaily(Base):
    __tablename__ = "pressure_daily"
    __table_args__ = (
        CheckConstraint("stage2_4_cases >= 0", name="ck_pressure_cases_nonnegative"),
        CheckConstraint("at_risk_patient_days >= 0", name="ck_pressure_risk_nonnegative"),
    )

    ward_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wards.id", ondelete="CASCADE"), primary_key=True)
    service_date: Mapped[date] = mapped_column(Date, primary_key=True)
    stage2_4_cases: Mapped[int] = mapped_column(Integer, nullable=False)
    at_risk_patient_days: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ReadmissionMonthly(Base):
    __tablename__ = "readmission_monthly"
    __table_args__ = (
        CheckConstraint("EXTRACT(DAY FROM reporting_month) = 1", name="ck_readmission_first_of_month"),
        CheckConstraint("readmit_count >= 0", name="ck_readmission_count_nonnegative"),
        CheckConstraint("discharge_count >= 0", name="ck_discharge_count_nonnegative"),
    )

    ward_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wards.id", ondelete="CASCADE"), primary_key=True)
    reporting_month: Mapped[date] = mapped_column(Date, primary_key=True)
    readmit_count: Mapped[int] = mapped_column(Integer, nullable=False)
    discharge_count: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SubmissionEvent(Base):
    __tablename__ = "submission_events"
    __table_args__ = (
        CheckConstraint("action_code IN ('created', 'updated', 'confirmed', 'returned')", name="ck_submission_action"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action_code: Mapped[str] = mapped_column(String(16), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(16))
    to_status: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class LegacyKeyMap(Base):
    __tablename__ = "legacy_key_map"
    __table_args__ = (
        UniqueConstraint("source_system", "source_table", "source_key_hash", name="uq_legacy_key_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_system: Mapped[str] = mapped_column(String(80), nullable=False)
    source_table: Mapped[str] = mapped_column(String(80), nullable=False)
    source_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    target_table: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    migration_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("migration_batches.id", ondelete="SET NULL", name="fk_legacy_key_map_migration_batch"),
    )


class MigrationBatch(Base):
    __tablename__ = "migration_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_system: Mapped[str] = mapped_column(String(80), nullable=False)
    source_checksum: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(String(24), nullable=False)
    rows_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rows_imported: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rows_rejected: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rows_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    rows_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    table_results: Mapped[dict | None] = mapped_column(JSON)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class LegacyConfirmationRecord(Base):
    """Original data_confirm history; missing account or timestamp stays missing."""
    __tablename__ = "legacy_confirmation_records"
    __table_args__ = (
        UniqueConstraint("source_row_hash", name="uq_legacy_confirmation_source_hash"),
        Index("ix_legacy_confirmation_entry", "entry_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_row_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    migration_batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("migration_batches.id", ondelete="CASCADE"), nullable=False)
    entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_entries.id", ondelete="SET NULL"))
    ward_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("wards.id", ondelete="SET NULL"))
    service_date: Mapped[date | None] = mapped_column(Date)
    legacy_shift_id: Mapped[int | None] = mapped_column(SmallInteger)
    legacy_account_ref: Mapped[str | None] = mapped_column(String(80))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LegacyImportIssue(Base):
    """Safe, per-row migration exception without copying raw patient data."""
    __tablename__ = "legacy_import_issues"
    __table_args__ = (
        Index("ix_legacy_import_issue_batch_table", "migration_batch_id", "source_table"),
        UniqueConstraint("source_table", "source_row_hash", "reason_code", name="uq_legacy_import_issue_source_reason"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    migration_batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("migration_batches.id", ondelete="CASCADE"), nullable=False)
    source_table: Mapped[str] = mapped_column(String(80), nullable=False)
    source_row_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(80), nullable=False)


Index("ix_daily_entries_service_date", DailyEntry.service_date)
