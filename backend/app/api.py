from datetime import date, datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import occupancy, reports
from app.reports import closing_count
from app.config import get_settings
from app.db import get_db_session
from app.models import (
    Announcement,
    AuthSession,
    DailyEntry,
    LegacyConfirmationRecord,
    PressureDaily,
    ReadmissionMonthly,
    ShiftType,
    SpecialtyCount,
    SubmissionEvent,
    User,
    UserGlobalRole,
    UserWardRole,
    Ward,
    WardCapacityHistory,
)
from app.permissions import (
    ensure_ward_read,
    ensure_ward_write,
    is_system_admin,
)
from app.schemas import (
    AdminPasswordResetRequest,
    AdminUserOut,
    AdminWardRole,
    AnnouncementInput,
    AnnouncementOut,
    COUNTER_FIELDS,
    CapacityCreate,
    CapacityOut,
    ChangePasswordRequest,
    ConfirmRequest,
    DailyEntryCreate,
    EntryFormOut,
    DailyEntryOut,
    DailyEntryPatch,
    DailyReportOut,
    LoginOut,
    LoginRequest,
    OccupancyMonthOut,
    OccupancyReportOut,
    OccupancyTotalOut,
    OccupancyWardOut,
    OccupancyYearSummaryOut,
    PressureOut,
    PressureUpdate,
    ReadmissionOut,
    ReadmissionUpdate,
    ReturnRequest,
    ShiftCreate,
    ShiftOut,
    ShiftPatch,
    SpecialtyValue,
    SubmissionEventOut,
    UserCreate,
    UserOut,
    UserRolesUpdate,
    WardCreate,
    WardOut,
)
from app.security import (
    constant_time_match,
    hash_password,
    session_csrf_token,
    new_session_token,
    normalize_username,
    token_hash,
    verify_password,
)

router = APIRouter()
settings = get_settings()
SESSION_COOKIE = "inpatient_session"


async def get_current(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> tuple[User, AuthSession]:
    return await _get_current(request, db)


async def _get_current(request: Request, db: AsyncSession) -> tuple[User, AuthSession]:
    from app.permissions import current_user
    return await current_user(request.cookies.get(SESSION_COOKIE), db)


async def require_csrf(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
) -> None:
    _, auth_session = current
    token = request.headers.get("X-CSRF-Token", "")
    if not constant_time_match(token, auth_session.csrf_token_hash):
        raise HTTPException(status_code=403, detail="csrf_validation_failed")


async def require_admin(
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    user, _ = current
    if not await is_system_admin(db, user.id):
        raise HTTPException(status_code=403, detail="system_admin_required")
    return user


async def lock_active_ward_for_write(db: AsyncSession, user_id: UUID, ward_id: UUID) -> Ward:
    await ensure_ward_write(db, user_id, ward_id)
    ward = await db.scalar(select(Ward).where(Ward.id == ward_id).with_for_update())
    if not ward or not ward.is_active:
        raise HTTPException(status_code=422, detail="ward_not_found_or_inactive")
    return ward


async def serialize_entry(db: AsyncSession, entry: DailyEntry) -> DailyEntryOut:
    specialty_rows = (
        await db.execute(select(SpecialtyCount).where(SpecialtyCount.entry_id == entry.id))
    ).scalars().all()
    values = {name: getattr(entry, name) for name in COUNTER_FIELDS}
    return DailyEntryOut(
        id=entry.id,
        ward_id=entry.ward_id,
        service_date=entry.service_date,
        shift_type_id=entry.shift_type_id,
        status=entry.status,
        version=entry.version,
        amount_bed=entry.amount_bed,
        **values,
        specialties=[
            SpecialtyValue(
                specialty_code=item.specialty_code,
                category_code=item.category_code,
                count_value=item.count_value,
            )
            for item in specialty_rows
        ],
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


async def save_specialties(db: AsyncSession, entry_id: UUID, items: list[SpecialtyValue]) -> None:
    await db.execute(
        SpecialtyCount.__table__.delete().where(SpecialtyCount.entry_id == entry_id)
    )
    seen: set[tuple[str, str]] = set()
    for item in items:
        key = (item.specialty_code, item.category_code)
        if key in seen:
            raise HTTPException(status_code=422, detail="duplicate_specialty_category")
        seen.add(key)
        db.add(
            SpecialtyCount(
                entry_id=entry_id,
                specialty_code=item.specialty_code,
                category_code=item.category_code,
                count_value=item.count_value,
            )
        )


@router.post("/auth/login", response_model=LoginOut)
async def login(
    payload: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
):
    user = await db.scalar(
        select(User).where(User.username_normalized == normalize_username(payload.username))
    )
    # Use a generic response for unknown users and incorrect passwords.
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    now = datetime.now(timezone.utc)
    raw_session = new_session_token()
    csrf = session_csrf_token(raw_session)
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=token_hash(raw_session),
        csrf_token_hash=token_hash(csrf),
        expires_at=now + timedelta(minutes=settings.session_ttl_minutes),
    )
    db.add(auth_session)
    await db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        raw_session,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
        max_age=settings.session_ttl_minutes * 60,
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-CSRF-Token"] = csrf
    return LoginOut(user=UserOut(id=user.id, username=user.username, full_name=getattr(user, "full_name", None), is_active=user.is_active))


@router.post("/auth/logout", status_code=204, dependencies=[Depends(require_csrf)])
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    _, auth_session = current
    auth_session.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=settings.secure_cookies, samesite="lax")
    response.status_code = 204
    return response


@router.get("/auth/csrf")
async def csrf_token(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    _, auth_session = current
    csrf = session_csrf_token(request.cookies[SESSION_COOKIE])
    if not constant_time_match(csrf, auth_session.csrf_token_hash):
        auth_session.csrf_token_hash = token_hash(csrf)
        await db.commit()
    response.headers["Cache-Control"] = "no-store"
    return {"csrf_token": csrf}


@router.get("/auth/me", response_model=UserOut)
async def me(current: Annotated[tuple[User, AuthSession], Depends(get_current)], db: Annotated[AsyncSession, Depends(get_db_session)]):
    user, _ = current
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=getattr(user, "full_name", None),
        is_active=user.is_active,
        is_admin=await is_system_admin(db, user.id),
    )


@router.post("/auth/change-password", status_code=204, dependencies=[Depends(require_csrf)])
async def change_password(
    payload: ChangePasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, auth_session = current
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="invalid_current_password")
    user.password_hash = hash_password(payload.new_password)
    now = datetime.now(timezone.utc)
    await db.execute(
        update(AuthSession)
        .where(
            AuthSession.user_id == user.id,
            AuthSession.id != auth_session.id,
            AuthSession.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    await db.commit()
    return Response(status_code=204)


async def serialize_admin_user(db: AsyncSession, user: User) -> AdminUserOut:
    global_roles = (
        await db.scalars(select(UserGlobalRole.role_code).where(UserGlobalRole.user_id == user.id))
    ).all()
    global_role = "system_admin" if "system_admin" in global_roles else (global_roles[0] if global_roles else None)
    ward_rows = (
        await db.execute(select(UserWardRole).where(UserWardRole.user_id == user.id))
    ).scalars().all()
    return AdminUserOut(
        id=user.id,
        username=user.username,
        full_name=getattr(user, "full_name", None),
        is_active=user.is_active,
        created_at=user.created_at,
        global_role=global_role,
        ward_roles=[AdminWardRole(ward_id=r.ward_id, role_code=r.role_code) for r in ward_rows],
    )


@router.get("/admin/users", response_model=list[AdminUserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    _: Annotated[User, Depends(require_admin)],
):
    users = (await db.scalars(select(User).order_by(User.username_normalized))).all()
    global_rows = (await db.scalars(select(UserGlobalRole))).all()
    ward_rows = (await db.scalars(select(UserWardRole))).all()
    global_by_user: dict[UUID, str] = {}
    for row in global_rows:
        if row.role_code == "system_admin" or row.user_id not in global_by_user:
            global_by_user[row.user_id] = row.role_code
    wards_by_user: dict[UUID, list[AdminWardRole]] = {}
    for row in ward_rows:
        wards_by_user.setdefault(row.user_id, []).append(
            AdminWardRole(ward_id=row.ward_id, role_code=row.role_code)
        )
    return [
        AdminUserOut(
            id=user.id,
            username=user.username,
            full_name=getattr(user, "full_name", None),
            is_active=user.is_active,
            created_at=user.created_at,
            global_role=global_by_user.get(user.id),
            ward_roles=wards_by_user.get(user.id, []),
        )
        for user in users
    ]


@router.post("/admin/users", response_model=UserOut, status_code=201, dependencies=[Depends(require_csrf)])
async def create_user(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    _: Annotated[User, Depends(require_admin)],
):
    normalized = normalize_username(payload.username)
    user = User(
        username=payload.username.strip(),
        username_normalized=normalized,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        await db.flush()
        if payload.global_role:
            db.add(UserGlobalRole(user_id=user.id, role_code=payload.global_role))
        for assignment in payload.ward_roles:
            ward = await db.get(Ward, assignment.ward_id)
            if not ward or not ward.is_active:
                raise HTTPException(status_code=422, detail="ward_not_found_or_inactive")
            db.add(UserWardRole(user_id=user.id, ward_id=ward.id, role_code=assignment.role_code))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="username_or_role_already_exists")
    await db.refresh(user)
    return UserOut(id=user.id, username=user.username, full_name=getattr(user, "full_name", None), is_active=user.is_active)


@router.patch("/admin/users/{user_id}", response_model=AdminUserOut, dependencies=[Depends(require_csrf)])
async def update_user(
    user_id: UUID,
    payload: UserRolesUpdate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    admin_user: Annotated[User, Depends(require_admin)],
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    if user.id == admin_user.id:
        if "is_active" in payload.model_fields_set and payload.is_active is False:
            raise HTTPException(status_code=400, detail="cannot_modify_own_admin_access")
        if "global_role" in payload.model_fields_set and payload.global_role != "system_admin":
            raise HTTPException(status_code=400, detail="cannot_modify_own_admin_access")

    try:
        if "full_name" in payload.model_fields_set:
            user.full_name = payload.full_name
        if "is_active" in payload.model_fields_set and payload.is_active is not None:
            user.is_active = payload.is_active
            if not payload.is_active:
                await db.execute(
                    update(AuthSession)
                    .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
                    .values(revoked_at=datetime.now(timezone.utc))
                )
        if "global_role" in payload.model_fields_set:
            await db.execute(delete(UserGlobalRole).where(UserGlobalRole.user_id == user.id))
            if payload.global_role:
                db.add(UserGlobalRole(user_id=user.id, role_code=payload.global_role))
        if "ward_roles" in payload.model_fields_set and payload.ward_roles is not None:
            seen_roles: set[tuple[UUID, str]] = set()
            for assignment in payload.ward_roles:
                key = (assignment.ward_id, assignment.role_code)
                if key in seen_roles:
                    raise HTTPException(status_code=409, detail="username_or_role_already_exists")
                seen_roles.add(key)
                ward = await db.get(Ward, assignment.ward_id)
                if not ward or not ward.is_active:
                    raise HTTPException(status_code=422, detail="ward_not_found_or_inactive")
            await db.execute(delete(UserWardRole).where(UserWardRole.user_id == user.id))
            for assignment in payload.ward_roles:
                db.add(UserWardRole(user_id=user.id, ward_id=assignment.ward_id, role_code=assignment.role_code))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="username_or_role_already_exists")
    await db.refresh(user)
    return await serialize_admin_user(db, user)


@router.post("/admin/users/{user_id}/password", status_code=204, dependencies=[Depends(require_csrf)])
async def reset_user_password(
    user_id: UUID,
    payload: AdminPasswordResetRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    _: Annotated[User, Depends(require_admin)],
):
    admin_user, admin_session = current
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    user.password_hash = hash_password(payload.new_password)
    revoke_stmt = update(AuthSession).where(
        AuthSession.user_id == user.id,
        AuthSession.revoked_at.is_(None),
    )
    if user.id == admin_user.id:
        revoke_stmt = revoke_stmt.where(AuthSession.id != admin_session.id)
    await db.execute(revoke_stmt.values(revoked_at=datetime.now(timezone.utc)))
    await db.commit()
    return Response(status_code=204)


@router.get("/news", response_model=list[AnnouncementOut])
async def list_news(db: Annotated[AsyncSession, Depends(get_db_session)],
                    current: Annotated[tuple[User, AuthSession], Depends(get_current)]):
    query = select(Announcement).order_by(Announcement.created_at.desc())
    if not await is_system_admin(db, current[0].id):
        query = query.where(Announcement.published.is_(True))
    return (await db.scalars(query)).all()


@router.post("/news", response_model=AnnouncementOut, status_code=201, dependencies=[Depends(require_csrf)])
async def add_news(payload: AnnouncementInput, db: Annotated[AsyncSession, Depends(get_db_session)],
                   actor: Annotated[User, Depends(require_admin)]):
    item = Announcement(**payload.model_dump(), updated_by=actor.id, publisher_username=actor.username)
    db.add(item)
    await db.commit()
    return item


async def editable_news(db, news_id, version):
    item = await db.scalar(select(Announcement).where(Announcement.id == news_id).with_for_update())
    if not item:
        raise HTTPException(status_code=404, detail="news_not_found")
    if item.version != version:
        raise HTTPException(status_code=409, detail="entry_version_conflict")
    return item


@router.put("/news/{news_id}", response_model=AnnouncementOut, dependencies=[Depends(require_csrf)])
async def edit_news(news_id: UUID, version: int, payload: AnnouncementInput,
                    db: Annotated[AsyncSession, Depends(get_db_session)], actor: Annotated[User, Depends(require_admin)]):
    item = await editable_news(db, news_id, version)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.version += 1
    item.updated_by = actor.id
    item.publisher_username = actor.username
    await db.commit()
    return item


@router.delete("/news/{news_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def remove_news(news_id: UUID, version: int, db: Annotated[AsyncSession, Depends(get_db_session)],
                      _: Annotated[User, Depends(require_admin)]):
    item = await editable_news(db, news_id, version)
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)


@router.get("/wards", response_model=list[WardOut])
async def list_wards(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, _ = current
    query = select(Ward).where(Ward.is_active.is_(True)).order_by(Ward.code)
    admin = await is_system_admin(db, user.id)
    writable = set()
    if not admin:
        roles = (await db.execute(select(UserWardRole).where(UserWardRole.user_id == user.id))).scalars().all()
        query = query.where(Ward.id.in_([r.ward_id for r in roles]))
        writable = {r.ward_id for r in roles if r.role_code == "ward_recorder"}
    wards = (await db.execute(query)).scalars()
    return [WardOut.model_validate(w).model_copy(update={"can_write": admin or w.id in writable}) for w in wards]


@router.post("/wards", response_model=WardOut, status_code=201, dependencies=[Depends(require_csrf)])
async def create_ward(
    payload: WardCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    _: Annotated[User, Depends(require_admin)],
):
    ward = Ward(**payload.model_dump())
    db.add(ward)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="ward_code_already_exists")
    await db.refresh(ward)
    return ward


@router.get("/shifts", response_model=list[ShiftOut])
async def list_shifts(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    _: Annotated[tuple[User, AuthSession], Depends(get_current)],
    include_inactive: bool = False,
):
    query = select(ShiftType).order_by(ShiftType.display_order, ShiftType.id)
    if not include_inactive:
        query = query.where(ShiftType.is_active.is_(True))
    return (await db.scalars(query)).all()


@router.post("/shifts", response_model=ShiftOut, status_code=201, dependencies=[Depends(require_csrf)])
async def create_shift(
    payload: ShiftCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    _: Annotated[User, Depends(require_admin)],
):
    item = ShiftType(
        code=payload.code.strip(),
        display_name=payload.display_name.strip(),
        legacy_shift_id=payload.legacy_shift_id,
        display_order=payload.display_order,
    )
    db.add(item)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="shift_code_or_legacy_id_already_exists")
    await db.refresh(item)
    return item


@router.patch("/shifts/{shift_id}", response_model=ShiftOut, dependencies=[Depends(require_csrf)])
async def patch_shift(
    shift_id: int,
    payload: ShiftPatch,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    _: Annotated[User, Depends(require_admin)],
):
    item = await db.get(ShiftType, shift_id)
    if not item:
        raise HTTPException(status_code=404, detail="shift_not_found")
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, name, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/wards/{ward_id}/capacity", response_model=list[CapacityOut])
async def list_capacity(
    ward_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    await ensure_ward_read(db, current[0].id, ward_id)
    return (
        await db.execute(
            select(WardCapacityHistory)
            .where(WardCapacityHistory.ward_id == ward_id)
            .order_by(WardCapacityHistory.effective_from)
        )
    ).scalars().all()


@router.post("/wards/{ward_id}/capacity", response_model=CapacityOut, status_code=201, dependencies=[Depends(require_csrf)])
async def add_capacity(
    ward_id: UUID,
    payload: CapacityCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    await lock_active_ward_for_write(db, current[0].id, ward_id)
    if payload.effective_to and payload.effective_to < payload.effective_from:
        raise HTTPException(status_code=422, detail="capacity_date_order_invalid")
    query = select(WardCapacityHistory).where(WardCapacityHistory.ward_id == ward_id)
    existing = (await db.execute(query)).scalars().all()
    for period in existing:
        current_end = period.effective_to or date.max
        new_end = payload.effective_to or date.max
        if payload.effective_from <= current_end and new_end >= period.effective_from:
            raise HTTPException(status_code=409, detail="capacity_period_overlap")
    item = WardCapacityHistory(
        ward_id=ward_id,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        bed_count=payload.bed_count,
        created_by=current[0].id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


ENTRY_SUPPLEMENTS = {"specialties", "pressure", "readmission", "previous_readmission"}


async def save_counts(db, model, key, values, actor):
    item = await db.get(model, key)
    if item is None:
        db.add(model(**key, **values.model_dump(), updated_by=actor))
    else:
        for name, value in values.model_dump().items():
            setattr(item, name, value)
        item.updated_by = actor


async def save_entry_supplements(db, item, shift, payload, actor):
    if shift.legacy_shift_id != 3 and (payload.specialties or payload.pressure):
        raise HTTPException(status_code=422, detail="afternoon_fields_only")
    if shift.legacy_shift_id == 3 and payload.specialties is not None:
        await save_specialties(db, item.id, payload.specialties)
    if payload.pressure is not None:
        await save_counts(db, PressureDaily, dict(ward_id=item.ward_id, service_date=item.service_date), payload.pressure, actor)
    if payload.readmission is not None:
        key = dict(ward_id=item.ward_id, reporting_month=item.service_date.replace(day=1))
        existing = await db.get(ReadmissionMonthly, key)
        before = ReadmissionUpdate.model_validate(existing, from_attributes=True) if existing else None
        if before != payload.readmission:
            if "previous_readmission" in payload.model_fields_set and before != payload.previous_readmission:
                raise HTTPException(status_code=409, detail="readmission_changed")
            await save_counts(db, ReadmissionMonthly, key, payload.readmission, actor)


@router.get("/entry-form", response_model=EntryFormOut)
async def open_entry_form(
    ward_id: UUID, service_date: date, shift_type_id: int,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    await ensure_ward_read(db, current[0].id, ward_id)
    shift = await db.get(ShiftType, shift_type_id)
    if not shift:
        raise HTTPException(status_code=422, detail="shift_not_found_or_inactive")
    entries = select(DailyEntry).where(DailyEntry.ward_id == ward_id)
    existing = await db.scalar(entries.where(DailyEntry.service_date == service_date, DailyEntry.shift_type_id == shift.id))
    previous = None
    if existing is None and not shift.is_active:
        raise HTTPException(status_code=422, detail="shift_not_found_or_inactive")
    if existing is None:
        # insert_data.php chooses the highest recorded shift on or before the date, even for backfill.
        previous = await db.scalar(entries.join(ShiftType).where(DailyEntry.service_date <= service_date).order_by(
            DailyEntry.service_date.desc(), ShiftType.legacy_shift_id.desc().nulls_last(), ShiftType.display_order.desc(),
            ShiftType.id.desc()
        ).limit(1))
    month = await db.get(ReadmissionMonthly, (ward_id, service_date.replace(day=1)))
    pressure = await db.get(PressureDaily, (ward_id, service_date)) if shift.legacy_shift_id == 3 else None
    return EntryFormOut(
        entry=await serialize_entry(db, existing) if existing else None,
        pt_on=closing_count(previous, "pt") if previous else 0,
        nb_on=closing_count(previous, "nb") if previous else 0,
        amount_bed=previous.amount_bed if previous else None,
        source_date=previous.service_date if previous else None,
        source_shift_id=previous.shift_type_id if previous else None,
        readmission=ReadmissionUpdate.model_validate(month, from_attributes=True) if month else None,
        pressure=PressureUpdate.model_validate(pressure, from_attributes=True) if pressure else None,
    )


@router.get("/entries/pending-count")
async def pending_count(db: Annotated[AsyncSession, Depends(get_db_session)],
                        current: Annotated[tuple[User, AuthSession], Depends(get_current)]):
    query = select(func.count()).select_from(DailyEntry).where(DailyEntry.status == "unconfirmed")
    if not await is_system_admin(db, current[0].id):
        query = query.where(DailyEntry.ward_id.in_(select(UserWardRole.ward_id).where(UserWardRole.user_id == current[0].id)))
    return {"count": await db.scalar(query)}


async def scope_entry_history(query, db: AsyncSession, user: User, ward_id: UUID | None,
                              date_from: date | None, date_to: date | None):
    if ward_id:
        await ensure_ward_read(db, user.id, ward_id)
        query = query.where(DailyEntry.ward_id == ward_id)
    elif not await is_system_admin(db, user.id):
        allowed_wards = select(UserWardRole.ward_id).where(UserWardRole.user_id == user.id)
        query = query.where(DailyEntry.ward_id.in_(allowed_wards))
    if date_from:
        query = query.where(DailyEntry.service_date >= date_from)
    if date_to:
        query = query.where(DailyEntry.service_date <= date_to)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_range_invalid")
    return query


@router.get("/entries/status-counts", response_model=dict[str, int])
async def entry_status_counts(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    ward_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    query = select(DailyEntry.status, func.count()).group_by(DailyEntry.status)
    query = await scope_entry_history(query, db, current[0], ward_id, date_from, date_to)
    totals = dict((await db.execute(query)).all())
    return {"all": sum(totals.values()), "unconfirmed": totals.get("unconfirmed", 0), "confirmed": totals.get("confirmed", 0)}


@router.get("/entries", response_model=list[DailyEntryOut])
async def list_entries(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    ward_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    entry_status: str | None = Query(default=None, alias="status", pattern="^(unconfirmed|confirmed)$"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    query = await scope_entry_history(select(DailyEntry), db, current[0], ward_id, date_from, date_to)
    query = query.order_by(DailyEntry.service_date.desc(), DailyEntry.shift_type_id, DailyEntry.ward_id).limit(limit).offset(offset)
    if entry_status:
        query = query.where(DailyEntry.status == entry_status)
    items = (await db.execute(query)).scalars().all()
    return [await serialize_entry(db, item) for item in items]


@router.post("/entries", response_model=DailyEntryOut, status_code=201, dependencies=[Depends(require_csrf)])
async def create_entry(
    payload: DailyEntryCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, _ = current
    await lock_active_ward_for_write(db, user.id, payload.ward_id)
    shift = await db.get(ShiftType, payload.shift_type_id)
    if not shift or not shift.is_active:
        raise HTTPException(status_code=422, detail="shift_not_found_or_inactive")

    values = payload.model_dump(exclude=ENTRY_SUPPLEMENTS)
    item = DailyEntry(**values, created_by=user.id, updated_by=user.id)
    db.add(item)
    try:
        await db.flush()
        db.add(SubmissionEvent(entry_id=item.id, actor_id=user.id, action_code="created", to_status="unconfirmed"))
        await save_entry_supplements(db, item, shift, payload, user.id)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="daily_entry_already_exists")
    await db.refresh(item)
    return await serialize_entry(db, item)


@router.get("/entries/{entry_id}", response_model=DailyEntryOut)
async def get_entry(
    entry_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    item = await db.get(DailyEntry, entry_id)
    if not item:
        raise HTTPException(status_code=404, detail="entry_not_found")
    await ensure_ward_read(db, current[0].id, item.ward_id)
    return await serialize_entry(db, item)


@router.get("/entries/{entry_id}/events", response_model=list[SubmissionEventOut])
async def entry_events(
    entry_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    item = await db.get(DailyEntry, entry_id)
    if not item:
        raise HTTPException(status_code=404, detail="entry_not_found")
    await ensure_ward_read(db, current[0].id, item.ward_id)
    records = await db.execute(
        select(SubmissionEvent, User.username)
        .join(User, User.id == SubmissionEvent.actor_id)
        .where(SubmissionEvent.entry_id == entry_id)
        .order_by(SubmissionEvent.occurred_at, SubmissionEvent.id)
    )
    output = [SubmissionEventOut(
        id=event.id, action_code=event.action_code, from_status=event.from_status, to_status=event.to_status,
        actor_username=username, reason=event.reason, occurred_at=event.occurred_at,
    ) for event, username in records]
    legacy_records = await db.execute(
        select(LegacyConfirmationRecord, User.username)
        .outerjoin(User, User.id == LegacyConfirmationRecord.actor_id)
        .where(LegacyConfirmationRecord.entry_id == entry_id)
    )
    output.extend(SubmissionEventOut(
        id=legacy.id, action_code="legacy_confirmed", from_status=None, to_status=None,
        actor_username=username, reason=None, occurred_at=legacy.confirmed_at,
    ) for legacy, username in legacy_records)
    return sorted(output, key=lambda event: (event.occurred_at is None, event.occurred_at or item.created_at, str(event.id)))


@router.patch("/entries/{entry_id}", response_model=DailyEntryOut, dependencies=[Depends(require_csrf)])
async def patch_entry(
    entry_id: UUID,
    payload: DailyEntryPatch,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, _ = current
    ward_id = await db.scalar(select(DailyEntry.ward_id).where(DailyEntry.id == entry_id))
    if ward_id is None:
        raise HTTPException(status_code=404, detail="entry_not_found")
    await lock_active_ward_for_write(db, user.id, ward_id)
    item = await db.scalar(select(DailyEntry).where(DailyEntry.id == entry_id).with_for_update())
    if item.status != "unconfirmed":
        raise HTTPException(status_code=409, detail="confirmed_entry_is_read_only")
    if item.version != payload.expected_version:
        raise HTTPException(status_code=409, detail="entry_version_conflict")

    if (payload.amount_bed if "amount_bed" in payload.model_fields_set else item.amount_bed) is None:
        raise HTTPException(status_code=422, detail="bed_count_required")
    changes = payload.model_dump(exclude_unset=True, exclude=ENTRY_SUPPLEMENTS | {"expected_version"})
    for name, value in changes.items():
        setattr(item, name, value)
    item.version += 1
    item.updated_by = user.id
    db.add(SubmissionEvent(entry_id=item.id, actor_id=user.id, action_code="updated", from_status=item.status, to_status=item.status))
    shift = await db.get(ShiftType, item.shift_type_id)
    await save_entry_supplements(db, item, shift, payload, user.id)
    await db.commit()
    await db.refresh(item)
    return await serialize_entry(db, item)


@router.post("/entries/{entry_id}/confirm", response_model=DailyEntryOut, dependencies=[Depends(require_csrf)])
async def confirm_entry(
    entry_id: UUID,
    payload: ConfirmRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, _ = current
    item = await db.scalar(select(DailyEntry).where(DailyEntry.id == entry_id).with_for_update())
    if not item:
        raise HTTPException(status_code=404, detail="entry_not_found")
    await ensure_ward_write(db, user.id, item.ward_id)
    if item.status != "unconfirmed" or item.version != payload.expected_version:
        raise HTTPException(status_code=409, detail="entry_state_or_version_conflict")
    item.status = "confirmed"
    item.version += 1
    item.updated_by = user.id
    db.add(SubmissionEvent(entry_id=item.id, actor_id=user.id, action_code="confirmed", from_status="unconfirmed", to_status="confirmed"))
    await db.commit()
    await db.refresh(item)
    return await serialize_entry(db, item)


@router.post("/entries/{entry_id}/return", response_model=DailyEntryOut, dependencies=[Depends(require_csrf)])
async def return_entry(
    entry_id: UUID,
    payload: ReturnRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    admin_user: Annotated[User, Depends(require_admin)],
):
    item = await db.scalar(select(DailyEntry).where(DailyEntry.id == entry_id).with_for_update())
    if not item:
        raise HTTPException(status_code=404, detail="entry_not_found")
    if item.status != "confirmed" or item.version != payload.expected_version:
        raise HTTPException(status_code=409, detail="entry_state_or_version_conflict")
    item.status = "unconfirmed"
    item.version += 1
    item.updated_by = admin_user.id
    db.add(SubmissionEvent(
        entry_id=item.id,
        actor_id=admin_user.id,
        action_code="returned",
        from_status="confirmed",
        to_status="unconfirmed",
        reason=payload.reason.strip(),
    ))
    await db.commit()
    await db.refresh(item)
    return await serialize_entry(db, item)


@router.get("/reports/daily", response_model=DailyReportOut)
async def daily_report(
    service_date: date,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    ward_id: UUID | None = None,
    shift_type_id: int | None = Query(default=None, gt=0),
):
    user, _ = current
    query = select(DailyEntry).where(DailyEntry.service_date == service_date)
    if ward_id:
        await ensure_ward_read(db, user.id, ward_id)
        query = query.where(DailyEntry.ward_id == ward_id)
    elif not await is_system_admin(db, user.id):
        allowed_wards = select(UserWardRole.ward_id).where(UserWardRole.user_id == user.id)
        query = query.where(DailyEntry.ward_id.in_(allowed_wards))
    if shift_type_id:
        query = query.where(DailyEntry.shift_type_id == shift_type_id)
    items = (await db.execute(query.order_by(DailyEntry.ward_id, DailyEntry.shift_type_id))).scalars().all()
    return DailyReportOut(service_date=service_date, entries=[await serialize_entry(db, item) for item in items])


@router.get("/reports/summary/{kind}")
async def summary_report(
    kind: reports.ReportKind, selected: date,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    ward_id: UUID | None = None, through: date | None = None, shift_type_id: int | None = None,
    entry_status: str = Query(default="all", alias="status", pattern="^(all|confirmed|unconfirmed)$"),
    channel: reports.ReportChannel = "screen",
):
    user = current[0]
    if kind.startswith("census-") and not await is_system_admin(db, user.id):
        raise HTTPException(status_code=403, detail="system_admin_required")
    if (through and through.replace(day=1) < selected.replace(day=1)) or selected.year < 3:
        raise HTTPException(status_code=422, detail="date_range_invalid")
    query = select(Ward).where(Ward.is_active.is_(True)).order_by(Ward.display_order, Ward.code)
    if kind in reports.FISCAL or kind in ("census-day", "census-month", "productivity"):
        query = query.where(Ward.report_group != 0)
    if ward_id:
        await ensure_ward_read(db, user.id, ward_id)
        query = query.where(Ward.id == ward_id)
    elif not await is_system_admin(db, user.id):
        query = query.where(Ward.id.in_(select(UserWardRole.ward_id).where(UserWardRole.user_id == user.id)))
    wards = {ward.id: ward for ward in await db.scalars(query)}
    return await reports.build_report(db, kind, wards, selected, through, shift_type_id, entry_status, channel)


@router.get("/reports/occupancy", response_model=OccupancyReportOut)
async def occupancy_report(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    fiscal_year_end: int | None = Query(default=None, ge=2000, le=3000),
    entry_status: str | None = Query(default=None, alias="status", pattern="^(all|unconfirmed|confirmed)$"),
):
    user, _ = current
    if fiscal_year_end is None:
        now_bangkok = datetime.now(timezone(timedelta(hours=7))).date()
        fiscal_year_end = now_bangkok.year + 1 if now_bangkok.month >= 10 else now_bangkok.year
    status_filter = entry_status or "all"

    shifts = (
        await db.execute(
            select(ShiftType)
            .where(ShiftType.legacy_shift_id.in_((1, 2, 3)))
            .order_by(ShiftType.display_order, ShiftType.id)
        )
    ).scalars().all()
    night_shift = next((item for item in shifts if item.legacy_shift_id == 1), None)
    if len(shifts) != 3:
        raise HTTPException(status_code=409, detail="shift_mapping_missing_or_inactive")
    night_shift_ids = {night_shift.id}
    shift_count = len(shifts)

    wards_query = select(Ward).where(Ward.is_active.is_(True), Ward.report_group != 0).order_by(Ward.display_order, Ward.code)
    if not await is_system_admin(db, user.id):
        allowed_wards = select(UserWardRole.ward_id).where(UserWardRole.user_id == user.id)
        wards_query = wards_query.where(Ward.id.in_(allowed_wards))
    wards = (await db.execute(wards_query)).scalars().all()

    months = occupancy.fiscal_year_months(fiscal_year_end)
    previous_months = occupancy.fiscal_year_months(fiscal_year_end - 1)
    range_start = date(fiscal_year_end - 2, 10, 1)
    range_end = date(fiscal_year_end, 9, 30)
    entries_query = select(DailyEntry).where(
        DailyEntry.shift_type_id.in_([s.id for s in shifts]),
        DailyEntry.service_date >= range_start,
        DailyEntry.service_date <= range_end,
        DailyEntry.ward_id.in_([ward.id for ward in wards]),
    )
    if status_filter != "all":
        entries_query = entries_query.where(DailyEntry.status == status_filter)
    entries = (
        await db.execute(entries_query.order_by(DailyEntry.service_date, DailyEntry.shift_type_id))
    ).scalars().all()

    display_order_by_shift = {item.id: item.legacy_shift_id for item in shifts}
    ward_by_id = {ward.id: ward for ward in wards}
    rows = [
        occupancy.EntryRow(
            ward_id=entry.ward_id,
            legacy_ward_code=ward_by_id[entry.ward_id].legacy_code,
            service_date=entry.service_date,
            shift_id=entry.shift_type_id,
            display_order=display_order_by_shift.get(entry.shift_type_id, 0),
            amount_bed=entry.amount_bed,
            pt_on=entry.pt_on,
            pt_in=entry.pt_in,
            pt_move=entry.pt_move,
            pt_home=entry.pt_home,
            pt_move_b=entry.pt_move_b,
            pt_send=entry.pt_send,
            pt_dead=entry.pt_dead,
            pt_non_voluntary=entry.pt_non_voluntary,
            pt_ad=entry.pt_ad,
        )
        for entry in entries
    ]

    ward_outputs = []
    for ward in wards:
        ward_rows = [row for row in rows if row.ward_id == ward.id]
        ward_months, ward_summary = occupancy.compute_ward_series(
            ward_rows, months, night_shift_ids, shift_count
        )
        prev_months, prev_summary = occupancy.compute_ward_series(
            ward_rows, previous_months, night_shift_ids, shift_count
        )
        ward_outputs.append(
            OccupancyWardOut(
                ward_id=ward.id,
                code=ward.code,
                name=ward.name,
                months=[OccupancyMonthOut(**item.to_dict()) for item in ward_months],
                fiscal_year=OccupancyYearSummaryOut(**ward_summary.to_dict()),
                previous_fiscal_year=OccupancyYearSummaryOut(**prev_summary.to_dict()),
            )
        )

    total_months, total_summary = occupancy.compute_total_series(
        rows, months, night_shift_ids, shift_count, len(wards)
    )
    prev_total_months, prev_total_summary = occupancy.compute_total_series(
        rows, previous_months, night_shift_ids, shift_count, len(wards)
    )

    return OccupancyReportOut(
        fiscal_year_end=fiscal_year_end,
        fiscal_year_start=fiscal_year_end - 1,
        formula_id=occupancy.FORMULA_ID,
        formula_note=occupancy.FORMULA_NOTE,
        status_filter=status_filter,
        night_shift=ShiftOut.model_validate(night_shift),
        months=[f"{year:04d}-{month:02d}" for year, month in months],
        wards=ward_outputs,
        total=OccupancyTotalOut(
            months=[OccupancyMonthOut(**item.to_dict()) for item in total_months],
            fiscal_year=OccupancyYearSummaryOut(**total_summary.to_dict()),
            previous_fiscal_year=OccupancyYearSummaryOut(**prev_total_summary.to_dict()),
        ),
    )


@router.put("/indicators/pressure/{ward_id}/{service_date}", status_code=204, dependencies=[Depends(require_csrf)])
async def update_pressure(
    ward_id: UUID,
    service_date: date,
    payload: PressureUpdate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, _ = current
    await lock_active_ward_for_write(db, user.id, ward_id)
    entry = await db.scalar(select(DailyEntry).join(ShiftType).where(
        DailyEntry.ward_id == ward_id, DailyEntry.service_date == service_date, ShiftType.legacy_shift_id == 3
    ).with_for_update(of=DailyEntry))
    if not entry or entry.status != "unconfirmed":
        raise HTTPException(status_code=409, detail="afternoon_entry_required")
    await save_counts(db, PressureDaily, dict(ward_id=ward_id, service_date=service_date), payload, user.id)
    entry.version += 1
    entry.updated_by = user.id
    db.add(SubmissionEvent(entry_id=entry.id, actor_id=user.id, action_code="updated", from_status=entry.status, to_status=entry.status))
    await db.commit()
    return Response(status_code=204)


@router.get("/indicators/pressure/{ward_id}", response_model=list[PressureOut])
async def list_pressure(
    ward_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    date_from: date | None = None,
    date_to: date | None = None,
):
    await ensure_ward_read(db, current[0].id, ward_id)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_range_invalid")
    query = select(PressureDaily).where(PressureDaily.ward_id == ward_id)
    if date_from:
        query = query.where(PressureDaily.service_date >= date_from)
    if date_to:
        query = query.where(PressureDaily.service_date <= date_to)
    return (await db.execute(query.order_by(PressureDaily.service_date))).scalars().all()


@router.put("/indicators/readmission/{ward_id}/{reporting_month}", status_code=204, dependencies=[Depends(require_csrf)])
async def update_readmission(
    ward_id: UUID,
    reporting_month: date,
    payload: ReadmissionUpdate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
):
    user, _ = current
    await lock_active_ward_for_write(db, user.id, ward_id)
    if reporting_month.day != 1:
        raise HTTPException(status_code=422, detail="reporting_month_must_be_first_day")
    await save_counts(db, ReadmissionMonthly, dict(ward_id=ward_id, reporting_month=reporting_month), payload, user.id)
    await db.commit()
    return Response(status_code=204)


@router.get("/indicators/readmission/{ward_id}", response_model=list[ReadmissionOut])
async def list_readmission(
    ward_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current: Annotated[tuple[User, AuthSession], Depends(get_current)],
    month_from: date | None = None,
    month_to: date | None = None,
):
    await ensure_ward_read(db, current[0].id, ward_id)
    if (month_from and month_from.day != 1) or (month_to and month_to.day != 1):
        raise HTTPException(status_code=422, detail="reporting_month_must_be_first_day")
    if month_from and month_to and month_from > month_to:
        raise HTTPException(status_code=422, detail="month_range_invalid")
    query = select(ReadmissionMonthly).where(ReadmissionMonthly.ward_id == ward_id)
    if month_from:
        query = query.where(ReadmissionMonthly.reporting_month >= month_from)
    if month_to:
        query = query.where(ReadmissionMonthly.reporting_month <= month_to)
    return (await db.execute(query.order_by(ReadmissionMonthly.reporting_month))).scalars().all()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Fail early when required runtime configuration is missing; do not open a DB connection here.
    settings.async_database_url()
    yield


api_app = FastAPI(
    title="Inpatient Reporting API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)
api_app.include_router(router, prefix="/api/v1")


@api_app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}
