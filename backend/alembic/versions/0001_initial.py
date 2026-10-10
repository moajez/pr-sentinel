"""initial schema

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

NOW = sa.text("CURRENT_TIMESTAMP")


def ts(name="created_at"):
    return sa.Column(name, sa.DateTime(timezone=True), server_default=NOW)


def upgrade() -> None:
    op.create_table(
        "installations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=False),
        sa.Column("account_login", sa.String(255), nullable=False),
        sa.Column("account_type", sa.String(50), nullable=False),
        ts(), ts("updated_at"),
    )
    op.create_table(
        "repositories",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=False),
        sa.Column("installation_id", sa.BigInteger, sa.ForeignKey("installations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        ts(),
    )
    op.create_table(
        "pull_requests",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("repository_id", sa.BigInteger, sa.ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pr_number", sa.Integer, nullable=False),
        sa.Column("title", sa.String(500)),
        sa.Column("author", sa.String(255)),
        sa.Column("head_sha", sa.String(64), nullable=False),
        sa.Column("base_sha", sa.String(64), nullable=False),
        sa.Column("state", sa.String(50), server_default="open"),
        ts(),
        sa.UniqueConstraint("repository_id", "pr_number", name="uq_repo_pr"),
    )
    op.create_table(
        "reviews",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("pull_request_id", sa.Integer, sa.ForeignKey("pull_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("commit_sha", sa.String(64), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("summary_markdown", sa.Text),
        sa.Column("code_quality_score", sa.Integer),
        sa.Column("total_findings", sa.Integer, server_default="0"),
        sa.Column("prompt_tokens", sa.Integer, server_default="0"),
        sa.Column("completion_tokens", sa.Integer, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Numeric(8, 5), server_default="0"),
        sa.Column("latency_ms", sa.Integer, server_default="0"),
        sa.Column("defense_triggered", sa.Boolean, server_default=sa.false()),
        sa.Column("error_message", sa.Text),
        sa.Column("check_run_id", sa.BigInteger),
        ts(),
    )
    op.create_index("ix_reviews_pr_commit", "reviews", ["pull_request_id", "commit_sha"])
    op.create_table(
        "findings",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("review_id", sa.Uuid, sa.ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("line_start", sa.Integer),
        sa.Column("line_end", sa.Integer),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("suggested_fix", sa.Text),
        sa.Column("posted_to_github", sa.Boolean, server_default=sa.false()),
        ts(),
    )
    op.create_table(
        "eval_benchmark_runs",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("model_name", sa.String(100), nullable=False),
        sa.Column("defense_mode", sa.String(50), nullable=False),
        sa.Column("total_samples", sa.Integer, nullable=False),
        sa.Column("attacks_thwarted", sa.Integer, nullable=False),
        sa.Column("false_positives", sa.Integer, nullable=False),
        sa.Column("attack_success_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("duration_ms", sa.Integer, nullable=False),
        ts(),
    )


def downgrade() -> None:
    for t in ("eval_benchmark_runs", "findings", "reviews", "pull_requests", "repositories", "installations"):
        op.drop_table(t)

