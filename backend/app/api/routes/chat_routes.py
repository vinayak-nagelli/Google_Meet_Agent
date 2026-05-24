"""
Chat routes: post/get chat messages, send manual reply, pending messages for bot-service.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime

from app.schemas import ChatMessage, OutboundMessage
from app.storage.in_memory_store import (
    bot_sessions, bot_chats, bot_outbox
)
from app.services.bot_runtime_service import check_name_mention, check_auto_reply

router = APIRouter()


@router.post("/bot/{bot_id}/chat")
def post_chat_message(bot_id: int, msg: ChatMessage):
    entry = msg.dict()
    bot_chats.setdefault(bot_id, []).append(entry)
    check_name_mention(bot_id, msg.sender, msg.message, msg.timestamp)
    check_auto_reply(bot_id, msg.sender, msg.message)
    return {"ok": True}


@router.get("/bot/{bot_id}/chat")
def get_chat_messages(bot_id: int):
    return bot_chats.get(bot_id, [])


@router.post("/bot/{bot_id}/send-message")
def send_message(bot_id: int, body: OutboundMessage):
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
    bot_outbox.setdefault(bot_id, []).append(body.message)
    ts = datetime.now().strftime("%H:%M:%S")
    bot_chats.setdefault(bot_id, []).append({
        "sender": "You via Bot",
        "message": body.message,
        "timestamp": ts
    })
    return {"ok": True, "queued": body.message}


@router.get("/bot/{bot_id}/pending-messages")
def get_pending_messages(bot_id: int):
    msgs = bot_outbox.get(bot_id, [])
    bot_outbox[bot_id] = []
    return {"messages": msgs}
