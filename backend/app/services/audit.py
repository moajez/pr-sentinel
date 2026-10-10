"""Tamper-evident audit log: each row's hash covers the previous row's hash (a hash chain)."""
import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog

GENESIS = "0" * 64


def _digest(prev: str, ts: str, installation_id, actor: str, action: str, target, detail) -> str:
    body = json.dumps([ts, installation_id, actor, action, target, detail], sort_keys=True, default=str)
    return hashlib.sha256((prev + body).encode()).hexdigest()


def _ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")


async def record(session: AsyncSession, actor: str, action: str, installation_id: int | None = None,
                 target: str | None = None, detail: dict | None = None) -> AuditLog:
    """Append an event. Caller commits (so the event shares the transaction with the action)."""
    last = (await session.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(1))).scalar_one_or_none()
    prev = last.hash if last else GENESIS
    now = datetime.now(timezone.utc)
    row = AuditLog(created_at=now, installation_id=installation_id, actor=actor, action=action, target=target,
                   detail=detail, prev_hash=prev,
                   hash=_digest(prev, _ts(now), installation_id, actor, action, target, detail))
    session.add(row)
    await session.flush()
    return row


async def verify_chain(session: AsyncSession) -> dict:
    """Recompute every hash; returns {ok, checked, broken_at, first_id, last_id, verified_at, duration_ms, head_hash, verification_errors}."""
    import time
    t0 = time.perf_counter()
    rows = (await session.execute(select(AuditLog).order_by(AuditLog.id))).scalars().all()
    prev = GENESIS
    now = datetime.now(timezone.utc)
    first_id = rows[0].id if rows else None
    last_id = rows[-1].id if rows else None
    head_hash = rows[-1].hash if rows else None
    for r in rows:
        expected = _digest(prev, _ts(r.created_at), r.installation_id, r.actor, r.action, r.target, r.detail)
        if r.prev_hash != prev or r.hash != expected:
            duration_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "ok": False,
                "checked": len(rows),
                "broken_at": r.id,
                "first_id": first_id,
                "last_id": last_id,
                "verified_at": now,
                "duration_ms": duration_ms,
                "head_hash": head_hash,
                "verification_errors": 1,
            }
        prev = r.hash
    duration_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "ok": True,
        "checked": len(rows),
        "broken_at": None,
        "first_id": first_id,
        "last_id": last_id,
        "verified_at": now,
        "duration_ms": duration_ms,
        "head_hash": head_hash,
        "verification_errors": 0,
    }

