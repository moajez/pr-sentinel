"""eval benchmark extra columns

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    t = "eval_benchmark_runs"
    op.add_column(t, sa.Column("benign_samples", sa.Integer, server_default="0"))
    op.add_column(t, sa.Column("detection_accuracy", sa.Numeric(5, 2)))
    op.add_column(t, sa.Column("avg_latency_ms", sa.Integer, server_default="0"))
    op.add_column(t, sa.Column("total_tokens", sa.Integer, server_default="0"))
    op.add_column(t, sa.Column("is_mock", sa.Boolean, server_default=sa.false()))


def downgrade() -> None:
    for c in ("is_mock", "total_tokens", "avg_latency_ms", "detection_accuracy", "benign_samples"):
        op.drop_column("eval_benchmark_runs", c)

