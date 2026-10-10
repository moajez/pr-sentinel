import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.db import models
from app.db.session import AsyncSessionLocal
from app.main import app


@pytest.mark.asyncio
async def test_repo_controls_and_emergency_unblock_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test test-connection endpoint
        res = await client.post("/api/v1/repos/9001/test-connection")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "connected"
        assert data["repository"] == "acme/payments-api"
        assert data["github_app"]["authenticated"] is True
        assert data["webhook"]["signature_algorithm"] == "HMAC-SHA256"

        # 2. Test pause reviews endpoint
        pause_res = await client.post("/api/v1/repos/9001/pause", json={"paused": True})
        assert pause_res.status_code == 200
        assert pause_res.json()["paused"] is True

        # Resume reviews
        resume_res = await client.post("/api/v1/repos/9001/pause", json={"paused": False})
        assert resume_res.status_code == 200
        assert resume_res.json()["paused"] is False

        # 3. Test settings update (PostgreSQL persistence)
        settings_res = await client.put(
            "/api/v1/repos/9001/settings",
            json={
                "min_severity": "info",
                "exclude_paths": ["dist/**"],
                "rules": [],
                "block_severity": "high",
                "min_quality_score": 8,
                "block_on_unresolved_cwe": ["CWE-89"],
                "team": "Payments Infrastructure",
                "auto_fix_pr": True,
                "enforcement_mode": "enforce",
                "auto_fix_behavior": "draft_pr",
                "require_check": True,
                "fail_open": False,
                "paused": False,
            },
        )
        assert settings_res.status_code == 200
        assert settings_res.json()["min_quality_score"] == 8

        # 4. Find and prepare a review to test emergency unblock flow
        reviews_res = await client.get("/api/v1/reviews?repo=acme/payments-api")
        assert reviews_res.status_code == 200
        revs = reviews_res.json()
        assert len(revs) > 0, "Expected at least one review in seeded database"
        
        target_rev = revs[0]
        rev_id = target_rev["id"]
        
        # Ensure test starts with merge_blocked = True and clean exception_detail
        from app.db.session import AsyncSessionLocal
        from app.db import models
        import uuid
        async with AsyncSessionLocal() as sess:
            db_rev = await sess.get(models.Review, uuid.UUID(rev_id))
            if db_rev:
                db_rev.merge_blocked = True
                db_rev.exception_detail = None
                await sess.commit()

        # 5. Request emergency exception
        req_res = await client.post(
            f"/api/v1/reviews/{rev_id}/request-exception",
            json={
                "reason": "Emergency payment processor outage mitigation",
                "duration_hours": 24,
                "policy_scope": "all_blocking_findings",
            },
        )
        assert req_res.status_code == 200
        assert req_res.json()["exception"]["status"] == "requested"

        # 6. Approve emergency exception (Authorized Admin)
        appr_res = await client.post(
            f"/api/v1/reviews/{rev_id}/approve-exception",
            json={"notes": "Security reviewer approved under emergency incident SEC-101"},
        )
        assert appr_res.status_code == 200
        assert appr_res.json()["exception"]["status"] == "approved"

        # Verify review is unblocked and exception recorded
        rev_check = await client.get(f"/api/v1/reviews/{rev_id}")
        assert rev_check.status_code == 200
        rev_detail = rev_check.json()
        assert rev_detail["merge_blocked"] is False
        assert rev_detail["exception_detail"]["status"] == "approved"

        # 7. Safe retry
        retry_res = await client.post(f"/api/v1/reviews/{rev_id}/retry")
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] == "retried"

        # 8. Test Review Comparison Endpoint
        compare_res = await client.get(f"/api/v1/reviews/{rev_id}/compare")
        assert compare_res.status_code == 200
        comp_data = compare_res.json()
        assert "diff_summary" in comp_data
        assert "current_review" in comp_data

        # 9. Test Finding Suppression Endpoint
        if rev_detail.get("findings"):
            finding_id = rev_detail["findings"][0]["id"]
            supp_res = await client.post(
                f"/api/v1/reviews/findings/{finding_id}/suppress",
                json={"reason": "false_positive", "notes": "Sanitized in upstream gateway"},
            )
            assert supp_res.status_code == 200
            assert supp_res.json()["status"] == "suppressed"

