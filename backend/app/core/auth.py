"""GitHub OAuth login, signed session cookie, and tenant-scoped principals.

With AUTH_ENABLED=false (default) every request acts as a local all-access admin, so dev/demo needs no OAuth app.
"""
from dataclasses import dataclass, field

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import models
from app.db.session import get_session

COOKIE = "sentinel_session"


@dataclass
class Principal:
    login: str
    roles: dict[int, str] = field(default_factory=dict)  # installation_id -> admin | security_reviewer | developer | auditor
    all_access: bool = False

    @property
    def installation_ids(self) -> list[int] | None:
        """None means unrestricted (e.g. system superadmin or dev mode)."""
        return None if self.all_access else list(self.roles)

    def can_view(self, installation_id: int) -> bool:
        """Strict tenant isolation check."""
        return self.all_access or installation_id in self.roles

    def get_role(self, installation_id: int) -> str | None:
        if self.all_access:
            return "admin"
        return self.roles.get(installation_id)

    def is_admin(self, installation_id: int) -> bool:
        return self.all_access or self.roles.get(installation_id) == "admin"

    def has_role(self, installation_id: int, allowed: tuple[str, ...]) -> bool:
        if self.all_access:
            return True
        role = self.roles.get(installation_id)
        return role in allowed if role else False


def make_token(login: str) -> str:
    return jwt.encode({"sub": login}, get_settings().session_secret, algorithm="HS256")


def read_token(token: str) -> str | None:
    try:
        return jwt.decode(token, get_settings().session_secret, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        return None


async def get_principal(request: Request, session: AsyncSession = Depends(get_session)) -> Principal:
    if not get_settings().auth_enabled:
        return Principal("dev", all_access=True)
    login = read_token(request.cookies.get(COOKIE, ""))
    if not login:
        raise HTTPException(401, "Not authenticated")
    rows = (await session.execute(
        select(models.Membership.installation_id, models.Membership.role)
        .join(models.User, models.Membership.user_id == models.User.id)
        .where(models.User.github_login == login))).all()
    return Principal(login, {i: r for i, r in rows})


def require_tenant_access(principal: Principal, installation_id: int) -> None:
    """Enforce strict tenant data isolation (never leak other tenants' existence)."""
    if not principal.can_view(installation_id):
        raise HTTPException(404, "Repository or installation not found")


def require_admin_of(principal: Principal, installation_id: int) -> None:
    require_tenant_access(principal, installation_id)
    if not principal.is_admin(installation_id):
        raise HTTPException(403, "Administrator role required for this organization")


def require_role_of(principal: Principal, installation_id: int, allowed_roles: tuple[str, ...]) -> None:
    require_tenant_access(principal, installation_id)
    if not principal.has_role(installation_id, allowed_roles):
        raise HTTPException(403, f"Action requires one of the following roles: {', '.join(allowed_roles)}")

