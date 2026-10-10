import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (JSON, BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text,
                        UniqueConstraint, Uuid, func)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Installation(Base):
    __tablename__ = "installations"
    policy: Mapped[dict | None] = mapped_column(JSON)  # OrgPolicy (org-wide controls)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    account_login: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(),
                                                 onupdate=func.now())


class Repository(Base):
    __tablename__ = "repositories"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    installation_id: Mapped[int] = mapped_column(ForeignKey("installations.id", ondelete="CASCADE"))
    full_name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    branch_protection_enforced: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict | None] = mapped_column(JSON)  # RepoSettings (rule editor)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PullRequest(Base):
    __tablename__ = "pull_requests"
    __table_args__ = (UniqueConstraint("repository_id", "pr_number", name="uq_repo_pr"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"))
    pr_number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(500))
    author: Mapped[str | None] = mapped_column(String(255))
    head_sha: Mapped[str] = mapped_column(String(64))
    base_sha: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(50), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    pull_request_id: Mapped[int] = mapped_column(ForeignKey("pull_requests.id", ondelete="CASCADE"))
    commit_sha: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(50))  # pending|processing|completed|failed|skipped
    summary_markdown: Mapped[str | None] = mapped_column(Text)
    code_quality_score: Mapped[int | None] = mapped_column(Integer)
    total_findings: Mapped[int] = mapped_column(Integer, default=0)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal(0))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    defense_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    check_run_id: Mapped[int | None] = mapped_column(BigInteger)  # GitHub Checks API run
    model_used: Mapped[str | None] = mapped_column(String(100))
    routing_reason: Mapped[str | None] = mapped_column(String(255))
    fix_pr_url: Mapped[str | None] = mapped_column(String(500))
    policy_violations: Mapped[dict | None] = mapped_column(JSON)
    merge_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    exception_detail: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    findings: Mapped[list["Finding"]] = relationship(cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"))
    file_path: Mapped[str] = mapped_column(String(1000))
    line_start: Mapped[int | None] = mapped_column(Integer)
    line_end: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(50))
    code_snippet: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    suggested_fix: Mapped[str | None] = mapped_column(Text)
    fix_verification_status: Mapped[str | None] = mapped_column(String(50))
    cwe: Mapped[str | None] = mapped_column(String(20))
    owasp: Mapped[str | None] = mapped_column(String(100))
    suppression: Mapped[dict | None] = mapped_column(JSON)
    posted_to_github: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvalBenchmarkRun(Base):
    __tablename__ = "eval_benchmark_runs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    model_name: Mapped[str] = mapped_column(String(100))
    defense_mode: Mapped[str] = mapped_column(String(50))
    total_samples: Mapped[int] = mapped_column(Integer)
    attacks_thwarted: Mapped[int] = mapped_column(Integer)
    false_positives: Mapped[int] = mapped_column(Integer)
    attack_success_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    duration_ms: Mapped[int] = mapped_column(Integer)
    benign_samples: Mapped[int] = mapped_column(Integer, default=0)
    detection_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    avg_latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())



class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    github_login: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Membership(Base):
    """A user's role inside one GitHub installation (tenant)."""
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "installation_id", name="uq_membership"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    installation_id: Mapped[int] = mapped_column(ForeignKey("installations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20))  # admin | viewer


class AuditLog(Base):
    """Append-only, hash-chained log of every AI/admin action (tamper-evident)."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    installation_id: Mapped[int | None] = mapped_column(BigInteger)
    actor: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(100))
    target: Mapped[str | None] = mapped_column(String(255))
    detail: Mapped[dict | None] = mapped_column(JSON)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class EvalQualityRun(Base):
    __tablename__ = "eval_quality_runs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    model_name: Mapped[str] = mapped_column(String(100))
    dataset_size: Mapped[int] = mapped_column(Integer)
    flawed_cases: Mapped[int] = mapped_column(Integer)
    benign_cases: Mapped[int] = mapped_column(Integer)
    tp: Mapped[int] = mapped_column(Integer)
    fp: Mapped[int] = mapped_column(Integer)
    fn: Mapped[int] = mapped_column(Integer)
    precision: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    recall: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    f1: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    false_positive_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    avg_latency_ms: Mapped[int] = mapped_column(Integer)
    total_tokens: Mapped[int] = mapped_column(Integer)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 5))
    prompt_fingerprint: Mapped[str] = mapped_column(String(16))
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
