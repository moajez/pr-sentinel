import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy import select

from app.config import get_settings
from app.core import idempotency
from app.core.rate_limit import RateLimitGate
from app.core.security import verify_signature
from app.db import models
from app.db.session import AsyncSessionLocal
from app.schemas.webhook import PullRequestEvent
from app.tasks.review_tasks import review_pull_request

logger = logging.getLogger(__name__)
router = APIRouter()

REVIEW_ACTIONS = {"opened", "synchronize", "reopened", "ready_for_review"}
rate_limit_webhook = RateLimitGate(max_requests=60, window_seconds=60, prefix="webhook")


async def handle_installation_event(body_dict: dict) -> dict:
    """Provision or deprovision GitHub App installations and associated repositories."""
    action = body_dict.get("action")
    inst_data = body_dict.get("installation", {})
    inst_id = inst_data.get("id")
    if not inst_id:
        return {"status": "ignored", "reason": "missing installation id"}

    async with AsyncSessionLocal() as session:
        if action in ("created", "unsuspend"):
            inst = await session.get(models.Installation, inst_id)
            account = inst_data.get("account", {})
            if not inst:
                inst = models.Installation(
                    id=inst_id,
                    account_login=account.get("login", "unknown"),
                    account_type=account.get("type", "Organization"),
                    policy={"enforce_budget": True, "alert_threshold_pct": 80, "routing_enabled": True},
                )
                session.add(inst)
            for repo_data in body_dict.get("repositories", []):
                repo_id = repo_data.get("id")
                repo_name = repo_data.get("full_name")
                if repo_id and repo_name:
                    r = await session.get(models.Repository, repo_id)
                    if not r:
                        session.add(models.Repository(
                            id=repo_id,
                            installation_id=inst_id,
                            full_name=repo_name,
                            settings={"min_severity": "info", "block_severity": "high", "auto_fix_pr": True},
                        ))
            await session.commit()
            return {"status": "provisioned", "installation_id": inst_id}

        elif action in ("deleted", "suspend"):
            inst = await session.get(models.Installation, inst_id)
            if inst:
                # Mark repositories inactive
                repos = (await session.execute(
                    select(models.Repository).where(models.Repository.installation_id == inst_id)
                )).scalars().all()
                for r in repos:
                    r.is_active = False
                await session.commit()
            return {"status": "deprovisioned", "installation_id": inst_id}

    return {"status": "ignored", "action": action}


async def handle_installation_repositories_event(body_dict: dict) -> dict:
    """Sync repositories when added to or removed from an installation."""
    inst_data = body_dict.get("installation", {})
    inst_id = inst_data.get("id")
    if not inst_id:
        return {"status": "ignored", "reason": "missing installation id"}

    async with AsyncSessionLocal() as session:
        for repo_data in body_dict.get("repositories_added", []):
            repo_id = repo_data.get("id")
            repo_name = repo_data.get("full_name")
            if repo_id and repo_name:
                r = await session.get(models.Repository, repo_id)
                if not r:
                    session.add(models.Repository(
                        id=repo_id,
                        installation_id=inst_id,
                        full_name=repo_name,
                        settings={"min_severity": "info", "block_severity": "high", "auto_fix_pr": True},
                    ))
                else:
                    r.is_active = True

        for repo_data in body_dict.get("repositories_removed", []):
            repo_id = repo_data.get("id")
            if repo_id:
                r = await session.get(models.Repository, repo_id)
                if r:
                    r.is_active = False

        await session.commit()
    return {"status": "repositories_synced", "installation_id": inst_id}


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(None),
    x_github_event: str | None = Header(None),
    x_github_delivery: str | None = Header(None),
    _rate_limit: None = Depends(rate_limit_webhook),
):
    body = await request.body()
    settings = get_settings()

    # 1. Constant-time HMAC-SHA256 signature verification
    if not verify_signature(settings.github_webhook_secret, body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 2. Ping check
    if x_github_event == "ping":
        return {"status": "pong"}

    # 3. Installation life-cycle events
    if x_github_event == "installation":
        try:
            body_dict = json.loads(body)
            return await handle_installation_event(body_dict)
        except Exception as e:
            logger.exception("Failed to handle installation event: %s", e)
            return {"status": "error", "detail": str(e)}

    if x_github_event == "installation_repositories":
        try:
            body_dict = json.loads(body)
            return await handle_installation_repositories_event(body_dict)
        except Exception as e:
            logger.exception("Failed to handle installation_repositories event: %s", e)
            return {"status": "error", "detail": str(e)}

    # 4. Pull request review triggers
    if x_github_event != "pull_request":
        return {"status": "ignored", "reason": f"event {x_github_event}"}

    if not x_github_delivery:
        raise HTTPException(status_code=400, detail="Missing X-GitHub-Delivery")

    try:
        event = PullRequestEvent.model_validate_json(body)
    except ValidationError:
        raise HTTPException(status_code=422, detail="Malformed payload")

    if event.action not in REVIEW_ACTIONS or event.pull_request.draft or not event.installation:
        return {"status": "ignored", "reason": f"action {event.action} or draft PR"}

    # 5. Idempotent delivery lock (Redis TTL)
    redis = idempotency.get_redis()
    if not await idempotency.claim_delivery(redis, x_github_delivery, settings.idempotency_ttl_seconds):
        return {"status": "duplicate"}

    try:
        review_pull_request.delay(event.model_dump(mode="json"))
    except Exception:
        # Enqueue failed: free the key so a redelivery can be processed
        await idempotency.release_delivery(redis, x_github_delivery)
        logger.exception("Failed to enqueue review")
        raise HTTPException(status_code=503, detail="Queue unavailable")

    return {"status": "accepted"}
