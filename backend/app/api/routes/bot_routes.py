"""
Bot lifecycle routes: deploy, status, stop, health.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime
import os
import re
from typing import Dict, Optional

from app.schemas import BotSessionCreate
from app.storage.in_memory_store import (
    bot_sessions, bot_chats, bot_alerts, bot_outbox,
    auto_replied_msgs, bot_visual_status, session_counter
)
import app.storage.in_memory_store as store
from app.services.bot_runtime_service import run_bot_process, parse_instruction

router = APIRouter()


@router.post("/bot/deploy")
def deploy_bot(bot_data: BotSessionCreate, background_tasks: BackgroundTasks):
    bot_id = next(store.session_counter)

    # Parse auto-reply instruction
    auto_rule = parse_instruction(bot_data.auto_instruction)
    if auto_rule:
        print(f"[Bot {bot_id}] Auto-reply rule: keywords={auto_rule['keywords']}, response={auto_rule['response']}")

    bot_sessions[bot_id] = {
        "id": bot_id,
        "meet_link": bot_data.meet_link,
        "bot_name": bot_data.bot_name,
        "user_name": bot_data.user_name,
        "auto_instruction": bot_data.auto_instruction,
        "user_context": bot_data.user_context,
        "auto_rule": auto_rule,
        "status": "created",
        "created_at": datetime.now().isoformat()
    }
    bot_chats[bot_id] = []
    bot_alerts[bot_id] = []
    bot_outbox[bot_id] = []
    auto_replied_msgs[bot_id] = set()
    bot_visual_status[bot_id] = {"presentation_active": False, "screenshots": []}

    if not bot_data.meet_link.startswith("http"):
        bot_sessions[bot_id]["status"] = "failed"
        bot_sessions[bot_id]["error_message"] = "Invalid Meet link."
        return bot_sessions[bot_id]

    # Early save: write the meeting shell to disk immediately so it exists in memory history
    # even if the server restarts before the meeting finishes.
    try:
        from app.services.meeting_memory_service import save_meeting
        save_meeting(bot_id, {
            "meet_link": bot_sessions[bot_id]["meet_link"],
            "bot_name": bot_sessions[bot_id]["bot_name"],
            "user_name": bot_sessions[bot_id].get("user_name", ""),
            "created_at": bot_sessions[bot_id]["created_at"],
        })
    except Exception as e:
        print(f"[Bot {bot_id}] Early save failed: {e}")

    background_tasks.add_task(run_bot_process, bot_id, bot_data.meet_link, bot_data.bot_name)
    return {k: v for k, v in bot_sessions[bot_id].items() if k not in ("auto_rule", "_process")}


@router.get("/bot/status/{bot_id}")
def get_bot_status(bot_id: int):
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
    s = dict(bot_sessions[bot_id])
    s.pop("auto_rule", None)
    s.pop("_process", None)
    return s


@router.post("/bot/{bot_id}/stop")
@router.post("/bot/{bot_id}/end")
def stop_bot(bot_id: int):
    """End the bot session gracefully (stops recording and leaves meeting)."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")

    if bot_sessions[bot_id]["status"] in ["failed", "stopped"]:
        return {"status": "already_stopped"}

    process = bot_sessions[bot_id].get("_process")
    if process:
        try:
            process.terminate()
            bot_sessions[bot_id]["status"] = "stopped"
            bot_sessions[bot_id]["is_recording"] = False
            bot_sessions[bot_id]["transcribing"] = False
            return {"status": "stopping"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    bot_sessions[bot_id]["status"] = "stopped"
    bot_sessions[bot_id]["is_recording"] = False
    return {"status": "stopped"}


@router.get("/health")
def health_check():
    return {"status": "ok"}
