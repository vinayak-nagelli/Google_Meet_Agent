"""
Central API router — aggregates all route modules.
"""
from fastapi import APIRouter

from app.api.routes import (
    bot_routes,
    chat_routes,
    alert_routes,
    audio_routes,
    transcript_routes,
    summary_routes,
    visual_routes,
    memory_routes,
)

api_router = APIRouter()

api_router.include_router(bot_routes.router)
api_router.include_router(chat_routes.router)
api_router.include_router(alert_routes.router)
api_router.include_router(audio_routes.router)
api_router.include_router(transcript_routes.router)
api_router.include_router(summary_routes.router)
api_router.include_router(visual_routes.router)
api_router.include_router(memory_routes.router)
