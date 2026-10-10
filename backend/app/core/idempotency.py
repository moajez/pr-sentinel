"""Redis-backed webhook deduplication keyed on the X-GitHub-Delivery id."""
from functools import lru_cache

import redis.asyncio as aioredis

from app.config import get_settings


@lru_cache
def get_redis() -> aioredis.Redis:
    return aioredis.from_url(get_settings().redis_url, decode_responses=True)


def _key(delivery_id: str) -> str:
    return f"gh:delivery:{delivery_id}"


async def claim_delivery(redis, delivery_id: str, ttl: int = 3600) -> bool:
    """Atomically claim a delivery. True if new, False if duplicate."""
    return bool(await redis.set(_key(delivery_id), "1", nx=True, ex=ttl))


async def release_delivery(redis, delivery_id: str) -> None:
    await redis.delete(_key(delivery_id))

