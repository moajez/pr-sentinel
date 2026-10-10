import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.models import Base, Finding, Review
from app.schemas.review import CodeFinding, PRReviewResult
from app.schemas.webhook import PullRequestEvent
from app.tasks import review_tasks

PATCH = "@@ -0,0 +1,2 @@\n+key = 'AKIAIOSFODNN7EXAMPLE'\n+x = 1"


class FakeClient:
    def __init__(self):
        self.checks = []
        self.closed = False

    async def create_check_run(self, owner, repo, sha):
        return {"id": 77}

    async def get_pull_request_files(self, owner, repo, n):
        return [{"filename": "a.py", "patch": PATCH, "status": "added"}]

    async def complete_check_run(self, owner, repo, cid, conclusion, title, summary):
        self.checks.append((cid, conclusion))

    async def aclose(self):
        self.closed = True


EVENT = PullRequestEvent.model_validate({
    "action": "opened",
    "pull_request": {"number": 1, "title": "t", "user": {"login": "u"}, "head": {"sha": "a"}, "base": {"sha": "b"}},
    "repository": {"id": 1, "name": "r", "full_name": "o/r", "owner": {"login": "o"}},
    "installation": {"id": 9},
})


@pytest.fixture
async def factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


async def test_review_persisted_and_secrets_redacted(factory, monkeypatch):
    seen = {}

    async def fake_review(title, diffs, settings, **kw):
        seen["patch"] = diffs[0].patch
        f = CodeFinding(file_path="a.py", line_number=2, title="bad", description="d",
                        severity="high", category="security")
        return PRReviewResult(summary="s", quality_score=4, findings=[f]), 1000, 200

    async def fake_post(*a, **k):
        seen["posted"] = True

    monkeypatch.setattr(review_tasks, "review_diffs", fake_review)
    monkeypatch.setattr(review_tasks, "post_review", fake_post)
    client = FakeClient()
    await review_tasks.run_review(EVENT, session_factory=factory, client=client)

    assert "AKIAIOSFODNN7EXAMPLE" not in seen["patch"]
    assert client.checks == [(77, "failure")] and client.closed
    async with factory() as s:
        review = (await s.execute(select(Review))).scalar_one()
        assert review.status == "completed" and review.total_findings == 1
        assert review.prompt_tokens == 1000 and float(review.estimated_cost_usd) > 0
        assert len((await s.execute(select(Finding))).scalars().all()) == 1


async def test_failure_then_retry_reuses_review(factory, monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("llm down")

    monkeypatch.setattr(review_tasks, "review_diffs", boom)
    with pytest.raises(RuntimeError):
        await review_tasks.run_review(EVENT, session_factory=factory, client=FakeClient())
    await review_tasks.mark_failed(EVENT, "llm down", session_factory=factory, client=FakeClient())

    async with factory() as s:
        reviews = (await s.execute(select(Review))).scalars().all()
        assert len(reviews) == 1 and reviews[0].status == "failed"
        assert reviews[0].check_run_id == 77

