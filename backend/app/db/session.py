from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings

# NullPool: Celery tasks each run in a fresh event loop (asyncio.run), and pooled
# asyncpg connections can't be shared across loops.
engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)



async def get_session():
    """FastAPI dependency."""
    async with AsyncSessionLocal() as session:
        yield session
