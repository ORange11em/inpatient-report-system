"""Initial schema for aggregate inpatient reporting.

Revision ID: 0001_initial
Revises:
"""
from alembic import op

from app.models import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This initial revision creates an empty schema from the metadata fixed for this release.
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
