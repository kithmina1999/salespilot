from app.config import get_settings
from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.redis import redis_service
from app.api.v1.router import api_v1_router


settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_service.connect()
    yield
    await redis_service.close()

app = FastAPI(
    title="Salespilot Sinhala/Singlish NLP Sidecar",
    description="Dedicated microservice for colloquial Singlish and spoken Sinhala parsing & response generation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(api_v1_router, prefix="/api/v1")

@app.get("/healthz", tags=["System"])
async def health_check():
    """Health check endpoint used by Docker and Go backend circuit breaker."""
    redis_ok = await redis_service.is_healthy()
    return {
        "status": "ok",
        "service":"salespilot-sinhala-nlp",
        "redis_connected":redis_ok,
    }