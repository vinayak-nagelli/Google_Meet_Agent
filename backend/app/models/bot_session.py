from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class BotSession(Base):
    __tablename__ = "bot_sessions"

    id = Column(Integer, primary_key=True, index=True)
    meet_link = Column(String, index=True)
    bot_name = Column(String)
    status = Column(String, default="created")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(String, nullable=True)
