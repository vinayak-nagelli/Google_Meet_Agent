"""
Pydantic request/response schemas used across routes.
"""
from pydantic import BaseModel
from typing import Optional


class BotSessionCreate(BaseModel):
    meet_link: str
    bot_name: str
    user_name: str = ""
    auto_instruction: str = ""
    user_context: str = ""  # Who the user is — gives LLM personality context


class ChatMessage(BaseModel):
    sender: str
    message: str
    timestamp: str


class OutboundMessage(BaseModel):
    message: str


class MeetingSearchQuery(BaseModel):
    query: str = ""
    date_filter: Optional[str] = None          # YYYY-MM-DD
    participant_filter: Optional[str] = None
    has_deadline: Optional[bool] = None
    has_action_items: Optional[bool] = None
