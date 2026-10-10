"""enterprise features: org policy, auth, audit log, routing, compliance, quality evals

Revision ID: 0004
Revises: 0003
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("installations", sa.Column("policy", sa.JSON))
    op.add_column("reviews", sa.Column("model_used", sa.String(100)))
    op.add_column("reviews", sa.Column("routing_reason", sa.String(255)))
    op.add_column("reviews", sa.Column("fix_pr_url", sa.String(500)))
    op.add_column("findings", sa.Column("cwe", sa.String(20)))
    op.add_column("findings", sa.Column("owasp", sa.String(100)))

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("github_login", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "memberships",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("installation_id", sa.BigInteger, sa.ForeignKey("installations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.UniqueConstraint("user_id", "installation_id", name="uq_membership"),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("installation_id", sa.BigInteger),
        sa.Column("actor", sa.String(255), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target", sa.String(255)),
        sa.Column("detail", sa.JSON),
        sa.Column("prev_hash", sa.String(64), nullable=False),
        sa.Column("hash", sa.String(64), nullable=False),
    )
    op.create_table(
        "eval_quality_runs",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("dataset_size", sa.Integer, nullable=False),
        sa.Column("flawed_cases", sa.Integer, nullable=False),
        sa.Column("benign_cases", sa.Integer, nullable=False),
        sa.Column("tp", sa.Integer, nullable=False),
        sa.Column("fp", sa.Integer, nullable=False),
        sa.Column("fn", sa.Integer, nullable=False),
        sa.Column("precision", sa.Numeric(5, 2), nullable=False),
        sa.Column("recall", sa.Numeric(5, 2), nullable=False),
        sa.Column("f1", sa.Numeric(5, 2), nullable=False),
        sa.Column("false_positive_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("avg_latency_ms", sa.Integer, nullable=False),
        sa.Column("total_tokens", sa.Integer, nullable=False),
        sa.Column("cost_usd", sa.Numeric(10, 5), nullable=False),
        sa.Column("prompt_fingerprint", sa.String(16), nullable=False),
        sa.Column("is_mock", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    for t in ("eval_quality_runs", "audit_log", "memberships", "users"):
        op.drop_table(t)
    for t, cols in (("findings", ("owasp", "cwe")), ("reviews", ("fix_pr_url", "routing_reason", "model_used")),
                    ("installations", ("policy",))):
        for c in cols:
            op.drop_column(t, c)

