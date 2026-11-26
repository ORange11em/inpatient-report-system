import ssl
from functools import lru_cache
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    settings = get_settings()
    connect_args = {}
    if settings.database_ssl_required:
        connect_args["ssl"] = ssl.create_default_context(cafile=settings.db_ssl_ca_file)
    engine = create_async_engine(
        settings.async_database_url(),
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session
