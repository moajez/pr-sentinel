from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, get_principal
from app.db import models
from app.db.session import get_session
from app.services.audit import verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditItemOut(BaseModel):
    id: int
    created_at: datetime
    installation_id: int | None
    actor: str
    action: str
    target: str | None
    detail: dict | None
    prev_hash: str
    hash: str


class VerifyChainResult(BaseModel):
    ok: bool
    checked: int
    broken_at: int | None
    first_id: int | None = None
    last_id: int | None = None
    verified_at: datetime | None = None
    duration_ms: float = 0.0
    head_hash: str | None = None
    verification_errors: int = 0


@router.get("", response_model=list[AuditItemOut])
async def list_audit_logs(
    limit: int = Query(50, le=200),
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    q = select(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(limit)
    if principal.installation_ids is not None:
        q = q.where(models.AuditLog.installation_id.in_(principal.installation_ids))
    rows = (await session.execute(q)).scalars().all()
    return [
        AuditItemOut(
            id=r.id,
            created_at=r.created_at,
            installation_id=r.installation_id,
            actor=r.actor,
            action=r.action,
            target=r.target,
            detail=r.detail,
            prev_hash=r.prev_hash,
            hash=r.hash
        )
        for r in rows
    ]


class CheckpointRequest(BaseModel):
    mode: str = "demo"  # "demo" | "live"


class CheckpointResult(BaseModel):
    ok: bool
    status: str  # "demo_created" | "externally_anchored" | "failed" | "not_configured"
    checkpoint_id: str
    provider: str
    head_hash: str
    covered_range: str
    created_at: datetime
    verified: bool
    is_demo: bool
    message: str


@router.get("/verify", response_model=VerifyChainResult)
async def verify_audit_chain(
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    result = await verify_chain(session)
    return VerifyChainResult(**result)


@router.post("/checkpoint", response_model=CheckpointResult)
async def create_checkpoint(
    req: CheckpointRequest,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal),
):
    import hashlib
    from datetime import timezone
    from app.services.audit import record

    verify_res = await verify_chain(session)
    if not verify_res["ok"]:
        return CheckpointResult(
            ok=False,
            status="failed",
            checkpoint_id="none",
            provider="None",
            head_hash="none",
            covered_range="none",
            created_at=datetime.now(timezone.utc),
            verified=False,
            is_demo=req.mode == "demo",
            message=f"Internal chain verification failed at block #{verify_res.get('broken_at')}. Cannot create checkpoint.",
        )

    last = (await session.execute(select(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(1))).scalar_one_or_none()
    if not last:
        return CheckpointResult(
            ok=False,
            status="failed",
            checkpoint_id="none",
            provider="None",
            head_hash="none",
            covered_range="none",
            created_at=datetime.now(timezone.utc),
            verified=False,
            is_demo=req.mode == "demo",
            message="No audit entries found to checkpoint.",
        )

    now = datetime.now(timezone.utc)
    if req.mode == "live":
        return CheckpointResult(
            ok=False,
            status="not_configured",
            checkpoint_id="none",
            provider="Sigstore Rekor Public Transparency Log (RFC 6962)",
            head_hash=last.hash,
            covered_range=f"Events {verify_res.get('first_id')}–{verify_res.get('last_id')}",
            created_at=now,
            verified=False,
            is_demo=False,
            message="Live external transparency provider not configured (REKOR_URL is unset). Use Demo Checkpoint mode.",
        )

    chk_id = f"demo-chk-0x{hashlib.sha256(f'{last.id}-{last.hash}'.encode()).hexdigest()[:12]}"
    await record(
        session,
        actor=principal.login or "security-admin",
        action="checkpoint_created",
        target=f"event_#{last.id}",
        detail={
            "checkpoint_id": chk_id,
            "mode": "demo_simulated",
            "provider": "Simulated In-Memory Notary (Demo Mode)",
            "head_hash": last.hash,
            "covered_range": f"Events {verify_res.get('first_id')}–{verify_res.get('last_id')}",
            "verified": True,
        },
    )
    await session.commit()

    return CheckpointResult(
        ok=True,
        status="demo_created",
        checkpoint_id=chk_id,
        provider="Simulated In-Memory Notary (Demo Mode)",
        head_hash=last.hash,
        covered_range=f"Events {verify_res.get('first_id')}–{verify_res.get('last_id')}",
        created_at=now,
        verified=True,
        is_demo=True,
        message=f"Local simulated checkpoint {chk_id} created for chain head #{last.id}.",
    )

