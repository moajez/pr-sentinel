import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models
from app.db.session import get_session

router = APIRouter(prefix="/evals", tags=["evals"])

MODE_ORDER = ["baseline", "sanitized_delimiter", "full_hardened"]


class EvalRunOut(BaseModel):
    id: uuid.UUID
    model_name: str
    defense_mode: str
    total_samples: int
    benign_samples: int
    attacks_thwarted: int
    false_positives: int
    attack_success_rate: float
    false_positive_rate: float
    detection_accuracy: float | None
    avg_latency_ms: int
    total_tokens: int
    duration_ms: int
    is_mock: bool
    created_at: datetime


class EvalQualityOut(BaseModel):
    id: uuid.UUID
    model_name: str
    dataset_size: int
    flawed_cases: int
    benign_cases: int
    tp: int
    fp: int
    fn: int
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    avg_latency_ms: int
    total_tokens: int
    cost_usd: float
    prompt_fingerprint: str
    is_mock: bool
    created_at: datetime


def _out(r: models.EvalBenchmarkRun) -> EvalRunOut:
    benign = r.benign_samples or 0
    return EvalRunOut(
        id=r.id, model_name=r.model_name, defense_mode=r.defense_mode, total_samples=r.total_samples,
        benign_samples=benign, attacks_thwarted=r.attacks_thwarted, false_positives=r.false_positives,
        attack_success_rate=float(r.attack_success_rate),
        false_positive_rate=round(100 * r.false_positives / benign, 2) if benign else 0.0,
        detection_accuracy=float(r.detection_accuracy) if r.detection_accuracy is not None else None,
        avg_latency_ms=r.avg_latency_ms or 0, total_tokens=r.total_tokens or 0, duration_ms=r.duration_ms,
        is_mock=bool(r.is_mock), created_at=r.created_at)


@router.get("/runs", response_model=list[EvalRunOut])
async def list_runs(limit: int = Query(50, le=200), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(models.EvalBenchmarkRun).order_by(models.EvalBenchmarkRun.created_at.desc()).limit(limit))).scalars()
    return [_out(r) for r in rows]


@router.get("/latest", response_model=list[EvalRunOut])
async def latest_per_mode(session: AsyncSession = Depends(get_session)):
    """Most recent run for each defense mode, in baseline -> hardened order."""
    rows = (await session.execute(
        select(models.EvalBenchmarkRun).order_by(models.EvalBenchmarkRun.created_at.desc()).limit(200))).scalars()
    latest: dict[str, models.EvalBenchmarkRun] = {}
    for r in rows:
        latest.setdefault(r.defense_mode, r)
    return [_out(latest[m]) for m in MODE_ORDER if m in latest]


@router.get("/quality", response_model=list[EvalQualityOut])
async def list_quality_runs(limit: int = Query(20, le=100), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(models.EvalQualityRun).order_by(models.EvalQualityRun.created_at.desc()).limit(limit))).scalars()
    return [
        EvalQualityOut(
            id=r.id,
            model_name=r.model_name,
            dataset_size=r.dataset_size,
            flawed_cases=r.flawed_cases,
            benign_cases=r.benign_cases,
            tp=r.tp,
            fp=r.fp,
            fn=r.fn,
            precision=float(r.precision),
            recall=float(r.recall),
            f1=float(r.f1),
            false_positive_rate=float(r.false_positive_rate),
            avg_latency_ms=r.avg_latency_ms,
            total_tokens=r.total_tokens,
            cost_usd=float(r.cost_usd),
            prompt_fingerprint=r.prompt_fingerprint,
            is_mock=bool(r.is_mock),
            created_at=r.created_at
        )
        for r in rows
    ]
