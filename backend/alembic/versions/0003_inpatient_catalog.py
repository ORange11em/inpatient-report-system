"""Install the inpatient ward catalog on fresh installations and map the three shifts."""
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "0003_inpatient_catalog"
down_revision = "0002_legacy_import_tracking"
branch_labels = None
depends_on = None

SHIFTS = ((1, "night", "ดึก"), (2, "morning", "เช้า"), (3, "afternoon", "บ่าย"))
WARDS = (
    ("10", "อายุรกรรมชาย"), ("11", "อายุรกรรมหญิง"), ("12", "ICU ผู้ใหญ่"),
    ("13", "ICU เด็ก"), ("14", "ศัลยกรรมหญิง"), ("15", "ศัลยกรรมชาย"),
    ("16", "ห้องคลอด(ตึก58 ปี)"), ("17", "สูติ-นรีเวช( ตึก58 ปี)"), ("18", "เด็ก  1"),
    ("19", "เด็ก  2 ( ทารกป่วย1ว.-1ด. )"), ("20", "ตาหูคอจมูก(ตึก58 ปี)"),
    ("21", "ศัลยกรรมกระดูก"), ("22", "สังเกตุอาการณ์"), ("23", "พิเศษ 3( ตึก67ปี)"),
    ("24", "พิเศษ1ชั้น4(ตึก62ปี)"), ("25", "พิเศษ2ชั้น5(ตึก62ปี)"), ("26", "ตึกพิเศษสงฆ์"),
    ("27", "STROKE  UNIT"), ("28", "ICU ศัลย์"),
)


def upgrade():
    db = op.get_bind()
    for legacy_id, code, name in SHIFTS:
        params = dict(n=legacy_id, code=code, name=name)
        mapped = db.scalar(sa.text("SELECT id FROM shift_types WHERE legacy_shift_id=:n"), params)
        if mapped is None:
            candidates = db.execute(sa.text(
                "SELECT id FROM shift_types WHERE legacy_shift_id IS NULL AND (code=:code OR display_name=:name)"
            ), params).scalars().all()
            if len(candidates) > 1:
                raise ValueError(f"Ambiguous existing shift mapping for {name}")
            if candidates:
                mapped = candidates[0]
        if mapped is None:
            db.execute(sa.text(
                "INSERT INTO shift_types (code, display_name, legacy_shift_id, display_order) "
                "VALUES (:code, :name, :n, :n)"
            ), params)
        else:
            db.execute(sa.text(
                "UPDATE shift_types SET display_name=:name, display_order=:n, legacy_shift_id=:n WHERE id=:id"
            ), {**params, "id": mapped})
    if not db.scalar(sa.text("SELECT COUNT(*) FROM wards")):
        db.execute(sa.text("INSERT INTO wards (id, code, name, legacy_code) VALUES (:id, :code, :name, :code)"),
                   [dict(id=uuid4(), code=code, name=name) for code, name in WARDS])


def downgrade():
    # Reference rows may have been used or may predate this migration.
    pass

