import hashlib
import json
import logging
from typing import Optional
import redis.asyncio as aioredis
from app.config import get_settings

logger = logging.getLogger("salespilot.redis")
settings = get_settings()

class RedisClient: 
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None

    async def connect(self):
        """Initializes the async Redis connection pool."""
        try:
            self.client = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
            await self.client.ping()
            logger.info("Connected to Redis successfully.")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis ({e}). Running in cache-bypass mode.")
            self.client = None

    async def close(self):
        """Close connection pool."""
        if self.client:
            await self.client.aclose()
            logging.info("Redis connection closed.")

    async def is_healthy(self)->bool:
        if not self.client:
            return False
        try: 
            return await self.client.ping()
        except Exception:
            return False

    def build_cache_key(slf, business_id: str, message: str)->str :
        """Generate a deterministic hash for repeated colloquial phrases."""
        normalized = message.strip().lower()
        msg_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
        return f"{settings.redis_key_prefix}parse:{business_id}:{msg_hash}"

    async def get_cache_parse(self,key:str)->Optional[dict]:
        """Safely retrives cached JSON payload with fallback on error."""
        if not self.client:
            return None
        try:
            data = await self.client.get(key)
            return json.loads(data) if data else None
        except Exception as err:
            logger.warning(f"Redis GET failed for key {key}: {err}")
            return None

    async def set_cached_parse(self, key:str, data:dict, ttl:Optional[int]=None)->None:
        """Safely caches parse JSON payload."""
        if not self.client:
            return 
        try :
            ttl_sec = ttl or settings.default_cache_ttl_seconds
            await self.client.set(key, json.dumps(data),ex = ttl_sec)
        except Exception as err:
            logger.warning(f"Redis SET failed for key {key}: {err}")


redis_service = RedisClient()