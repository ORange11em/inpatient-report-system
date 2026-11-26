"""Record the actual news writer, matching legacy user_update semantics."""
import sqlalchemy as sa
from alembic import op

revision = "0006_announcement_publisher"
down_revision = "0005_ward_report_groups"
branch_labels = None
depends_on = None


def upgrade():
    # Migration 0001 creates current Base.metadata on fresh installations.
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("announcements")}
    if "updated_by" not in columns:
        op.add_column("announcements", sa.Column("updated_by", sa.UUID(), nullable=True))
    if "publisher_username" not in columns:
        op.add_column("announcements", sa.Column("publisher_username", sa.String(80), nullable=True))
    if not any(fk["constrained_columns"] == ["updated_by"] for fk in inspector.get_foreign_keys("announcements")):
        op.create_foreign_key("fk_announcement_updated_by", "announcements", "users", ["updated_by"], ["id"], ondelete="SET NULL")
    # Existing rows have no reliable writer evidence. Never backfill the migration actor.


def downgrade():
    for fk in sa.inspect(op.get_bind()).get_foreign_keys("announcements"):
        if fk["constrained_columns"] == ["updated_by"]:
            op.drop_constraint(fk["name"], "announcements", type_="foreignkey")
    op.drop_column("announcements", "publisher_username")
    op.drop_column("announcements", "updated_by")
