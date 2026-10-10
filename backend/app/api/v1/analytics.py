from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, get_principal
from app.db import models
from app.db.session import get_session

router = APIRouter(prefix="/analytics", tags=["analytics"])


class DayPoint(BaseModel):
    date: str
    reviews: int
    cost_usd: float
    tokens: int


class Overview(BaseModel):
    total_reviews: int
    completed_reviews: int
    failed_reviews: int
    total_findings: int
    avg_latency_ms: float
    avg_quality_score: float | None
    prompt_tokens: int
    completion_tokens: int
    total_cost_usd: float
    defense_triggered: int
    severity_distribution: dict[str, int]
    daily: list[DayPoint]


@router.get("/overview", response_model=Overview)
async def overview(session: AsyncSession = Depends(get_session), principal: Principal = Depends(get_principal)):
    R = models.Review
    ids = principal.installation_ids
    scope = true() if ids is None else R.pull_request_id.in_(
        select(models.PullRequest.id).join(models.Repository, models.PullRequest.repository_id == models.Repository.id)
        .where(models.Repository.installation_id.in_(ids)))
    done = R.status == "completed"
    totals = (await session.execute(select(
        func.count(R.id),
        func.count(R.id).filter(done),
        func.count(R.id).filter(R.status == "failed"),
        func.coalesce(func.sum(R.total_findings), 0),
        func.avg(R.latency_ms).filter(done),
        func.avg(R.code_quality_score).filter(done),
        func.coalesce(func.sum(R.prompt_tokens), 0),
        func.coalesce(func.sum(R.completion_tokens), 0),
        func.coalesce(func.sum(R.estimated_cost_usd), 0),
        func.count(R.id).filter(R.defense_triggered.is_(True)),
    ).where(scope))).one()

    sev = (await session.execute(
        select(models.Finding.severity, func.count()).where(models.Finding.review_id.in_(select(R.id).where(scope)))
        .group_by(models.Finding.severity))).all()
    day = func.date(R.created_at)
    daily = (await session.execute(
        select(day, func.count(R.id), func.coalesce(func.sum(R.estimated_cost_usd), 0),
               func.coalesce(func.sum(R.prompt_tokens + R.completion_tokens), 0))
        .where(scope).group_by(day).order_by(day).limit(90))).all()

    return Overview(
        total_reviews=totals[0], completed_reviews=totals[1], failed_reviews=totals[2],
        total_findings=int(totals[3]), avg_latency_ms=float(totals[4] or 0),
        avg_quality_score=float(totals[5]) if totals[5] is not None else None,
        prompt_tokens=int(totals[6]), completion_tokens=int(totals[7]),
        total_cost_usd=float(totals[8]), defense_triggered=totals[9],
        severity_distribution={s: c for s, c in sev},
        daily=[DayPoint(date=str(d), reviews=n, cost_usd=float(c), tokens=int(t)) for d, n, c, t in daily],
    )

