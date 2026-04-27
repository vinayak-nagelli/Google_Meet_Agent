from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BotSessionCreate(BaseModel):
    meet_link: str
    bot_name: str

class BotSessionResponse(BaseModel):
    id: int
    meet_link: str
    bot_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class BotStatusUpdate(BaseModel):
    status: str
    error_message: Optional[str] = None
