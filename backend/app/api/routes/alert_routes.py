"""
Alert routes.
"""
from fastapi import APIRouter

from app.storage.in_memory_store import bot_alerts

router = APIRouter()


@router.get("/bot/{bot_id}/alerts")
def get_alerts(bot_id: int):
    return bot_alerts.get(bot_id, [])
