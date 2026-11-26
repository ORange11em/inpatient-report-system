"""Ward report groups and sort order from inpatient/db/db_inpatient.sql."""
from alembic import op
import sqlalchemy as sa

revision = "0005_ward_report_groups"
down_revision = "0004_announcements"
branch_labels = None
depends_on = None


def upgrade():
    db = op.get_bind()
    columns = {column["name"] for column in sa.inspect(db).get_columns("wards")}
    if "report_group" not in columns:
        op.add_column("wards", sa.Column("report_group", sa.SmallInteger(), nullable=False, server_default="1"))
    if "display_order" not in columns:
        op.add_column("wards", sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"))
    order = ("15","14","21","10","11","18","19","17","20","24","25","23","13","12","16","22","26","27","28")
    db.execute(sa.text("UPDATE wards SET report_group=:grp, display_order=:pos WHERE legacy_code=:code"),
               [dict(code=code, grp=0 if code == "22" else 1, pos=i) for i, code in enumerate(order, 1)])


def downgrade():
    op.drop_column("wards", "display_order")
    op.drop_column("wards", "report_group")
