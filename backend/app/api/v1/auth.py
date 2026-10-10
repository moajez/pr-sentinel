import secrets
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import COOKIE, Principal, get_principal, make_token
from app.db import models
from app.db.session import get_session
from app.services import audit

router = APIRouter(prefix="/auth", tags=["auth"])


class UserOut(BaseModel):
    login: str
    roles: dict[int, str]
    all_access: bool


class DevLoginRequest(BaseModel):
    login: str = "dev-admin"
    roles: dict[int, str] = {}
    all_access: bool = True


@router.get("/me", response_model=UserOut)
async def get_current_user(principal: Principal = Depends(get_principal)):
    return UserOut(login=principal.login, roles=principal.roles, all_access=principal.all_access)


@router.post("/dev-login")
async def dev_login(req: DevLoginRequest, response: Response, session: AsyncSession = Depends(get_session)):
    """Convenience endpoint to simulate login in development/demo mode."""
    token = make_token(req.login)
    response.set_cookie(
        key=COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    # Ensure user row exists in db
    user = (await session.execute(select(models.User).where(models.User.github_login == req.login))).scalar_one_or_none()
    if not user:
        user = models.User(github_login=req.login)
        session.add(user)
        await session.flush()
    await audit.record(session, req.login, "user_login", None, req.login, {"all_access": req.all_access})
    await session.commit()
    return {"status": "ok", "login": req.login}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"status": "ok"}

