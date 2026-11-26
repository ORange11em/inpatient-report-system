"""Ward news published on the inpatient home page."""
import sqlalchemy as sa
from alembic import op

revision = "0004_announcements"
down_revision = "0003_inpatient_catalog"
branch_labels = None
depends_on = None


def upgrade():
    if not sa.inspect(op.get_bind()).has_table("announcements"):
        op.create_table("announcements",
            sa.Column("id", sa.UUID(), primary_key=True),
            sa.Column("title", sa.String(240), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("published", sa.Boolean(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade():
    op.drop_table("announcements")
