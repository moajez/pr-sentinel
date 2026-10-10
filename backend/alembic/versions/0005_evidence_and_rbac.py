"""evidence-backed findings, verification status, and merge gate policies

Revision ID: 0005
Revises: 0004
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Finding evidence and confidence
    op.add_column("findings", sa.Column("code_snippet", sa.Text(), nullable=True))
    op.add_column("findings", sa.Column("evidence", sa.Text(), nullable=True))
    op.add_column("findings", sa.Column("confidence", sa.Numeric(3, 2), nullable=True))
    op.add_column("findings", sa.Column("fix_verification_status", sa.String(50), nullable=True))

    # Review merge gate & branch protection
    op.add_column("reviews", sa.Column("policy_violations", sa.JSON(), nullable=True))
    op.add_column("reviews", sa.Column("merge_blocked", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("repositories", sa.Column("branch_protection_enforced", sa.Boolean(), server_default=sa.text("true"), nullable=False))


def downgrade() -> None:
    op.drop_column("repositories", "branch_protection_enforced")
    op.drop_column("reviews", "merge_blocked")
    op.drop_column("reviews", "policy_violations")
    op.drop_column("findings", "fix_verification_status")
    op.drop_column("findings", "confidence")
    op.drop_column("findings", "evidence")
    op.drop_column("findings", "code_snippet")

