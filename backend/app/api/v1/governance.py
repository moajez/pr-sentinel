from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, get_principal
from app.db import models
from app.db.session import get_session
from app.services import governance

router = APIRouter(prefix="/governance", tags=["governance"])


class BudgetSummary(BaseModel):
    limit: float | None
    spent: float
    scope: str | None
    pct: float
    exceeded: bool
    alert: bool
    enforce: bool


class SpendByModel(BaseModel):
    model: str
    reviews: int
    cost_usd: float
    avg_latency_ms: float


class SpendByTeam(BaseModel):
    team: str
    cost_usd: float
    reviews: int


class GovernanceOverview(BaseModel):
    budget: BudgetSummary | None
    month_spent_usd: float
    month_forecast_usd: float
    by_model: list[SpendByModel]
    by_team: list[SpendByTeam]


@router.get("/overview", response_model=GovernanceOverview)
async def get_governance_overview(
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    now = governance.datetime.now(governance.timezone.utc)
    since = governance.month_start(now)
    rows = await governance.spend_rows(session, principal.installation_ids, since)

    month_spent = float(sum(float(r[3] or 0) for r in rows))
    fc = governance.forecast(month_spent, now)

    # By model
    model_map: dict[str, dict] = {}
    team_map: dict[str, dict] = {}

    for r in rows:
        repo_name, repo_settings, model, cost, lat = r
        m = model or "unknown"
        c = float(cost or 0)
        l = int(lat or 0)
        t = governance._team(repo_settings) or "unassigned"

        if m not in model_map:
            model_map[m] = {"reviews": 0, "cost": 0.0, "latency_total": 0}
        model_map[m]["reviews"] += 1
        model_map[m]["cost"] += c
        model_map[m]["latency_total"] += l

        if t not in team_map:
            team_map[t] = {"reviews": 0, "cost": 0.0}
        team_map[t]["reviews"] += 1
        team_map[t]["cost"] += c

    by_model = [
        SpendByModel(
            model=m,
            reviews=d["reviews"],
            cost_usd=round(d["cost"], 5),
            avg_latency_ms=round(d["latency_total"] / d["reviews"], 1) if d["reviews"] else 0.0
        )
        for m, d in model_map.items()
    ]

    by_team = [
        SpendByTeam(
            team=t,
            cost_usd=round(d["cost"], 5),
            reviews=d["reviews"]
        )
        for t, d in team_map.items()
    ]

    budget = None
    if principal.installation_ids and len(principal.installation_ids) == 1:
        budget_data = await governance.budget_status(session, principal.installation_ids[0])
        budget = BudgetSummary(**budget_data)

    return GovernanceOverview(
        budget=budget,
        month_spent_usd=round(month_spent, 5),
        month_forecast_usd=fc,
        by_model=by_model,
        by_team=by_team
    )

