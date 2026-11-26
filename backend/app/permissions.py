from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthSession, User, UserGlobalRole, UserWardRole
from app.security import token_hash


async def current_user(
    session_token: str | None,
    db: AsyncSession,
) -> tuple[User, AuthSession]:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required")
    query = (
        select(User, AuthSession)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == token_hash(session_token))
    )
    row = (await db.execute(query)).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required")
    user, auth_session = row
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    if not user.is_active or auth_session.revoked_at is not None or auth_session.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required")
    return user, auth_session


async def is_system_admin(db: AsyncSession, user_id: UUID) -> bool:
    return await db.scalar(
        select(UserGlobalRole.user_id).where(
            UserGlobalRole.user_id == user_id,
            UserGlobalRole.role_code == "system_admin",
        )
    ) is not None


async def can_read_ward(db: AsyncSession, user_id: UUID, ward_id: UUID) -> bool:
    if await is_system_admin(db, user_id):
        return True
    return await db.scalar(
        select(UserWardRole.user_id).where(
            UserWardRole.user_id == user_id,
            UserWardRole.ward_id == ward_id,
            UserWardRole.role_code.in_(("ward_recorder", "report_reader")),
        )
    ) is not None


async def can_write_ward(db: AsyncSession, user_id: UUID, ward_id: UUID) -> bool:
    if await is_system_admin(db, user_id):
        return True
    return await db.scalar(
        select(UserWardRole.user_id).where(
            UserWardRole.user_id == user_id,
            UserWardRole.ward_id == ward_id,
            UserWardRole.role_code == "ward_recorder",
        )
    ) is not None


async def ensure_ward_read(db: AsyncSession, user_id: UUID, ward_id: UUID) -> None:
    if not await can_read_ward(db, user_id, ward_id):
        raise HTTPException(status_code=403, detail="ward_access_denied")


async def ensure_ward_write(db: AsyncSession, user_id: UUID, ward_id: UUID) -> None:
    if not await can_write_ward(db, user_id, ward_id):
        raise HTTPException(status_code=403, detail="ward_write_denied")
