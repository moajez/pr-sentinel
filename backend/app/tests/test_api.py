from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import models
from app.db.session import get_session
from app.main import app
from app.schemas.review import CodeFinding
from app.schemas.rules import RepoSettings
from app.services.diff_parser import FileDiff
from app.services.rules import filter_diffs, filter_findings


@pytest.fixture
async def api():
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override():
        async with factory() as s:
            yield s

    app.dependency_overrides[get_session] = override
    async with factory() as s:
        s.add(models.Installation(id=1, account_login="o", account_type="User"))
        s.add(models.Repository(id=10, installation_id=1, full_name="o/r"))
        await s.flush()
        pr = models.PullRequest(repository_id=10, pr_number=3, title="Fix", author="u", head_sha="a", base_sha="b")
        s.add(pr)
        await s.flush()
        rv = models.Review(pull_request_id=pr.id, commit_sha="a", status="completed", code_quality_score=6,
                           total_findings=1, prompt_tokens=100, completion_tokens=50, latency_ms=1200,
                           created_at=datetime.now(timezone.utc))
        s.add(rv)
        await s.flush()
        s.add(models.Finding(review_id=rv.id, file_path="a.py", line_start=2, title="SQLi",
                             description="d", severity="high", category="security"))
        await s.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        c.review_id = str(rv.id)
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def test_list_and_detail(api):
    rows = (await api.get("/api/v1/reviews")).json()
    assert len(rows) == 1 and rows[0]["repo"] == "o/r" and rows[0]["pr_number"] == 3
    detail = (await api.get(f"/api/v1/reviews/{api.review_id}")).json()
    assert detail["findings"][0]["title"] == "SQLi"
    assert (await api.get("/api/v1/reviews/00000000-0000-0000-0000-000000000000")).status_code == 404


async def test_overview(api):
    o = (await api.get("/api/v1/analytics/overview")).json()
    assert o["total_reviews"] == 1 and o["total_findings"] == 1
    assert o["avg_latency_ms"] == 1200 and o["severity_distribution"] == {"high": 1}
    assert len(o["daily"]) == 1


async def test_settings_roundtrip(api):
    default = (await api.get("/api/v1/repos/10/settings")).json()
    assert default["min_severity"] == "info" and default["exclude_paths"] == []
    body = {"min_severity": "medium", "exclude_paths": ["dist/**"],
            "rules": [{"name": "r1", "enabled": True, "severity": "high"}]}
    assert (await api.put("/api/v1/repos/10/settings", json=body)).status_code == 200
    assert (await api.get("/api/v1/repos")).json()[0]["settings"]["min_severity"] == "medium"
    assert (await api.put("/api/v1/repos/999/settings", json=body)).status_code == 404


def test_rule_filters():
    s = RepoSettings(min_severity="medium", exclude_paths=["dist/**", "*.min.js", "vendor/**"])
    diffs = [FileDiff(p, "") for p in ["src/a.py", "dist/x/y.js", "static/app.min.js", "vendor/lib.py"]]
    assert [d.path for d in filter_diffs(diffs, s)] == ["src/a.py"]
    mk = lambda sev: CodeFinding(file_path="a", title="t", description="d", severity=sev, category="bug")
    assert [f.severity.value for f in filter_findings([mk("low"), mk("medium"), mk("critical")], s)] == ["medium", "critical"]

