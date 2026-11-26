"""Add nullable users.full_name and wards.short_name with legacy ward shortname defaults.

Revision ID: 0008_user_and_ward_names
Revises: 0007_legacy_history_and_issues
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_user_and_ward_names"
down_revision = "0007_legacy_history_and_issues"
branch_labels = None
depends_on = None

# Reference shortnames from inpatient/db/db_inpatient.sql (`ward.shortname`).
# Ward 22 has NULL shortname in the legacy schema and remains NULL.
WARD_SHORT_NAMES: tuple[tuple[str, str | None], ...] = (
    ("10", "อช"),
    ("11", "อญ"),
    ("12", "ICU ใหญ่"),
    ("13", "ICU เด็ก"),
    ("14", "ศญ"),
    ("15", "ศช"),
    ("16", "ห้องคลอด"),
    ("17", "สูตินรีเวช"),
    ("18", "เด็ก1"),
    ("19", "เด็ก2"),
    ("20", "EENT"),
    ("21", "ศก"),
    ("22", None),
    ("23", "พศ.3"),
    ("24", "พศ.1"),
    ("25", "พศ.2"),
    ("26", "พศ.สงฆ์"),
    ("27", "Stroke Unit"),
    ("28", "ICU ศัลย์"),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "full_name" not in user_columns:
        op.add_column("users", sa.Column("full_name", sa.String(160), nullable=True))

    ward_columns = {col["name"] for col in inspector.get_columns("wards")}
    if "short_name" not in ward_columns:
        op.add_column("wards", sa.Column("short_name", sa.String(40), nullable=True))

    bind.execute(
        sa.text(
            "UPDATE wards SET short_name = :short_name "
            "WHERE legacy_code = :legacy_code AND short_name IS NULL"
        ),
        [
            {"legacy_code": legacy_code, "short_name": short_name}
            for legacy_code, short_name in WARD_SHORT_NAMES
            if short_name is not None
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    ward_columns = {col["name"] for col in inspector.get_columns("wards")}
    if "short_name" in ward_columns:
        op.drop_column("wards", "short_name")

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "full_name" in user_columns:
        op.drop_column("users", "full_name")
