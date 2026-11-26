"""Track legacy import outcomes and batch ownership for source key mappings.

Revision ID: 0002_legacy_import_tracking
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_legacy_import_tracking"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    batch_columns = {column["name"] for column in inspector.get_columns("migration_batches")}
    mapping_columns = {column["name"] for column in inspector.get_columns("legacy_key_map")}
    if "rows_skipped" not in batch_columns:
        op.add_column("migration_batches", sa.Column("rows_skipped", sa.Integer(), server_default="0", nullable=False))
    if "rows_failed" not in batch_columns:
        op.add_column("migration_batches", sa.Column("rows_failed", sa.Integer(), server_default="0", nullable=False))
    if "migration_batch_id" not in mapping_columns:
        op.add_column("legacy_key_map", sa.Column("migration_batch_id", sa.UUID(), nullable=True))
    foreign_keys = inspector.get_foreign_keys("legacy_key_map")
    has_batch_fk = any(
        key.get("constrained_columns") == ["migration_batch_id"]
        and key.get("referred_table") == "migration_batches"
        for key in foreign_keys
    )
    if not has_batch_fk:
        op.create_foreign_key(
            "fk_legacy_key_map_migration_batch",
            "legacy_key_map",
            "migration_batches",
            ["migration_batch_id"],
            ["id"],
            ondelete="SET NULL",
        )
    indexes = inspector.get_indexes("legacy_key_map")
    if not any(index.get("name") == "ix_legacy_key_map_migration_batch_id" for index in indexes):
        op.create_index("ix_legacy_key_map_migration_batch_id", "legacy_key_map", ["migration_batch_id"])


def downgrade() -> None:
    op.drop_index("ix_legacy_key_map_migration_batch_id", table_name="legacy_key_map")
    op.drop_constraint("fk_legacy_key_map_migration_batch", "legacy_key_map", type_="foreignkey")
    op.drop_column("legacy_key_map", "migration_batch_id")
    op.drop_column("migration_batches", "rows_failed")
    op.drop_column("migration_batches", "rows_skipped")
