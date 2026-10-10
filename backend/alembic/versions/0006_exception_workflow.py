"""exception workflow and repository controls

Revision ID: 0006
Revises: 0005
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add exception_detail JSON column to reviews for emergency unblock audit workflow
    op.add_column("reviews", sa.Column("exception_detail", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("reviews", "exception_detail")

