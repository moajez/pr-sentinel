"""finding suppression for false positives

Revision ID: 0007
Revises: 0006
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("findings", sa.Column("suppression", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("findings", "suppression")

