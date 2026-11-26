"""Preserve legacy confirmation provenance and row-level import exceptions.

Revision ID: 0007_legacy_history_and_issues
Revises: 0006_announcement_publisher
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_legacy_history_and_issues"
down_revision = "0006_announcement_publisher"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "legacy_confirmation_records" not in tables:
        op.create_table(
        "legacy_confirmation_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_row_hash", sa.String(64), nullable=False),
        sa.Column("migration_batch_id", sa.UUID(), nullable=False),
        sa.Column("entry_id", sa.UUID(), nullable=True),
        sa.Column("ward_id", sa.UUID(), nullable=True),
        sa.Column("service_date", sa.Date(), nullable=True),
        sa.Column("legacy_shift_id", sa.SmallInteger(), nullable=True),
        sa.Column("legacy_account_ref", sa.String(80), nullable=True),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["migration_batch_id"], ["migration_batches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entry_id"], ["daily_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["ward_id"], ["wards.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_row_hash", name="uq_legacy_confirmation_source_hash"),
        )
        op.create_index("ix_legacy_confirmation_entry", "legacy_confirmation_records", ["entry_id"])
    if "legacy_import_issues" not in tables:
        op.create_table(
        "legacy_import_issues",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("migration_batch_id", sa.UUID(), nullable=False),
        sa.Column("source_table", sa.String(80), nullable=False),
        sa.Column("source_row_hash", sa.String(64), nullable=False),
        sa.Column("reason_code", sa.String(80), nullable=False),
        sa.ForeignKeyConstraint(["migration_batch_id"], ["migration_batches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_table", "source_row_hash", "reason_code", name="uq_legacy_import_issue_source_reason"),
        )
        op.create_index("ix_legacy_import_issue_batch_table", "legacy_import_issues", ["migration_batch_id", "source_table"])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "legacy_import_issues" in tables:
        op.drop_index("ix_legacy_import_issue_batch_table", table_name="legacy_import_issues")
        op.drop_table("legacy_import_issues")
    if "legacy_confirmation_records" in tables:
        op.drop_index("ix_legacy_confirmation_entry", table_name="legacy_confirmation_records")
        op.drop_table("legacy_confirmation_records")
