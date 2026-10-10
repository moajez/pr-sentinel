from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, get_principal, require_admin_of
from app.db import models
from app.db.session import get_session
from app.schemas.rules import OrgPolicy
from app.services import audit

router = APIRouter(prefix="/orgs", tags=["orgs"])


class MemberOut(BaseModel):
    id: int
    user_id: int
    github_login: str
    installation_id: int
    role: str


class OrgOut(BaseModel):
    id: int
    account_login: str
    account_type: str
    policy: OrgPolicy


@router.get("/members", response_model=list[MemberOut])
async def list_members(
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    q = select(models.Membership, models.User.github_login).join(models.User, models.Membership.user_id == models.User.id)
    if principal.installation_ids is not None:
        q = q.where(models.Membership.installation_id.in_(principal.installation_ids))
    rows = (await session.execute(q)).all()
    return [
        MemberOut(
            id=m.id,
            user_id=m.user_id,
            github_login=login,
            installation_id=m.installation_id,
            role=m.role
        )
        for m, login in rows
    ]


@router.get("", response_model=list[OrgOut])
async def list_orgs(
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    q = select(models.Installation).order_by(models.Installation.account_login)
    if principal.installation_ids is not None:
        q = q.where(models.Installation.id.in_(principal.installation_ids))
    insts = (await session.execute(q)).scalars().all()
    return [
        OrgOut(
            id=i.id,
            account_login=i.account_login,
            account_type=i.account_type,
            policy=OrgPolicy.model_validate(i.policy or {})
        )
        for i in insts
    ]


@router.get("/{org_id}/policy", response_model=OrgPolicy)
async def get_org_policy(
    org_id: int,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    if not principal.can_view(org_id):
        raise HTTPException(404, "Org not found")
    inst = await session.get(models.Installation, org_id)
    if not inst:
        raise HTTPException(404, "Org not found")
    return OrgPolicy.model_validate(inst.policy or {})


@router.put("/{org_id}/policy", response_model=OrgPolicy)
async def update_org_policy(
    org_id: int,
    body: OrgPolicy,
    session: AsyncSession = Depends(get_session),
    principal: Principal = Depends(get_principal)
):
    require_admin_of(principal, org_id)
    inst = await session.get(models.Installation, org_id)
    if not inst:
        raise HTTPException(404, "Org not found")
    inst.policy = body.model_dump(mode="json")
    await audit.record(session, principal.login, "org_policy_updated", org_id, inst.account_login, inst.policy)
    await session.commit()
    return body

