"""Redis-backed tenant and IP rate limiting for API & webhooks."""
import logging
import time
from fastapi import HTTPException, Request

from app.core.idempotency import get_redis

logger = logging.getLogger(__name__)


async def check_rate_limit(key: str, max_requests: int = 60, window_seconds: int = 60) -> tuple[bool, int, int]:
    """Sliding or fixed window rate limiter using Redis.
    Returns: (is_allowed, current_count, retry_after_seconds)
    """
    redis = get_redis()
    redis_key = f"ratelimit:{key}"
    try:
        current = await redis.incr(redis_key)
        if current == 1:
            await redis.expire(redis_key, window_seconds)
            ttl = window_seconds
        else:
            ttl = await redis.ttl(redis_key)
            if ttl < 0:
                await redis.expire(redis_key, window_seconds)
                ttl = window_seconds

        if current > max_requests:
            return False, current, max(ttl, 1)
        return True, current, 0
    except Exception as e:
        logger.warning("Redis rate limit check error (failing open): %s", e)
        return True, 1, 0


class RateLimitGate:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60, prefix: str = "tenant"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.prefix = prefix

    async def __call__(self, request: Request) -> None:
        # Determine tenant or IP key
        client_ip = request.client.host if request.client else "unknown"
        tenant_key = request.headers.get("X-Installation-Id") or client_ip
        key = f"{self.prefix}:{tenant_key}"

        allowed, count, retry_after = await check_rate_limit(key, self.max_requests, self.window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {count} requests within {self.window_seconds}s (limit: {self.max_requests}).",
                headers={"Retry-After": str(retry_after)},
            )

