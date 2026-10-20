from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings loaded from .env file"""

    port: int = 8000
    environment:str = "development"
    log_level:str ="info"

    gemini_api_key:str=""
    gemini_model:str = "gemini-2.5-flash"

    redish_url:str = "redis://redis:6379/1"
    redis_key_prefix: str = "salespilot:nlp:"
    default_cache_ttl_seconds: int = 86400 

    model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore"
        )

@lru_cache()
def get_settings() -> Settings:
    return Settings()
