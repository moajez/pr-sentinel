"""Budget tracking, spend breakdowns and alerts."""
import calendar
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import models
from app.schemas.rules import OrgPolicy, RepoSettings

logger = logging.getLogger(__name__)


def month_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def load_policy(session: AsyncSession, installation_id: int) -> OrgPolicy:
    inst = await session.get(models.Installation, installation_id)
    return OrgPolicy.model_validate((inst.policy if inst else None) or {})


async def spend_rows(session: AsyncSession, installation_ids: list[int] | None, since: datetime):
    """(repo_full_name, repo_settings, model, cost, latency) per completed review since `since`."""
    q = (select(models.Repository.full_name, models.Repository.settings, models.Review.model_used,
                models.Review.estimated_cost_usd, models.Review.latency_ms)
         .select_from(models.Review)
         .join(models.PullRequest, models.Review.pull_request_id == models.PullRequest.id)
         .join(models.Repository, models.PullRequest.repository_id == models.Repository.id)
         .where(models.Review.created_at >= since))
    if installation_ids is not None:
        q = q.where(models.Repository.installation_id.in_(installation_ids))
    return (await session.execute(q)).all()


def _team(settings: dict | None) -> str | None:
    return RepoSettings.model_validate(settings or {}).team


async def budget_status(session: AsyncSession, installation_id: int, team: str | None = None) -> dict:
    policy = await load_policy(session, installation_id)
    rows = await spend_rows(session, [installation_id], month_start())
    spent = float(sum(float(r[3] or 0) for r in rows))
    team_spent = float(sum(float(r[3] or 0) for r in rows if team and _team(r[1]) == team))
    limits = [(l, s, n) for l, s, n in (
        (policy.monthly_budget_usd, spent, "org"),
        (policy.team_budgets.get(team) if team else None, team_spent, f"team {team}")) if l is not None]
    worst = max(((s / l if l else 1.0), n, l, s) for l, s, n in limits) if limits else None
    pct = round(100 * worst[0], 1) if worst else 0.0
    exceeded = bool(worst and worst[0] >= 1.0)
    return {"limit": worst[2] if worst else None, "spent": round(worst[3], 5) if worst else round(spent, 5),
            "scope": worst[1] if worst else None, "pct": pct, "exceeded": exceeded,
            "alert": bool(worst and pct >= policy.alert_threshold_pct), "enforce": policy.enforce_budget}


def forecast(spent: float, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    days = calendar.monthrange(now.year, now.month)[1]
    elapsed = max(now.day - 1 + now.hour / 24, 1)
    return round(spent / elapsed * days, 5)


async def send_alert(text: str) -> None:
    url = get_settings().slack_webhook_url
    if not url:
        logger.warning("Budget alert (no Slack webhook configured): %s", text)
        return
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(url, json={"text": text})
    except httpx.HTTPError:
        logger.exception("Slack alert failed")


async def alert_if_crossed(before: dict, after: dict, repo: str) -> None:
    """Notify once when a review pushes spend over the alert threshold or the limit."""
    if after["limit"] is None:
        return
    if after["exceeded"] and not before["exceeded"]:
        await send_alert(f":no_entry: PR Sentinel budget exhausted ({after['scope']}): "
                         f"${after['spent']:.2f} of ${after['limit']:.2f}. Reviews pause (repo {repo}).")
    elif after["alert"] and not before["alert"]:
        await send_alert(f":warning: PR Sentinel budget at {after['pct']}% ({after['scope']}): "
                         f"${after['spent']:.2f} of ${after['limit']:.2f}.")

