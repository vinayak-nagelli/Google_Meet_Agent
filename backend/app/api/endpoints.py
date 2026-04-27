from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.bot_session import BotSession
from app.schemas.bot_session import BotSessionCreate, BotSessionResponse, BotStatusUpdate
import httpx
import os

router = APIRouter()

BOT_SERVICE_URL = os.getenv("BOT_SERVICE_URL", "http://bot-service:8001")

def trigger_bot_service(bot_id: int, meet_link: str, bot_name: str):
    """Call the bot service to start the Playwright automation."""
    try:
        print(f"Triggering bot service for bot_id={bot_id} at {BOT_SERVICE_URL}/start")
        # Trigger bot service
        response = httpx.post(f"{BOT_SERVICE_URL}/start", json={
            "bot_id": bot_id,
            "meet_link": meet_link,
            "bot_name": bot_name
        }, timeout=10.0)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to trigger bot service: {e}")

@router.post("/deploy", response_model=BotSessionResponse)
def deploy_bot(bot_data: BotSessionCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Create session in DB
    db_bot = BotSession(meet_link=bot_data.meet_link, bot_name=bot_data.bot_name, status="created")
    db.add(db_bot)
    db.commit()
    db.refresh(db_bot)
    
    # Trigger bot service in background
    background_tasks.add_task(trigger_bot_service, db_bot.id, db_bot.meet_link, db_bot.bot_name)
    
    return db_bot

@router.get("/status/{bot_id}", response_model=BotSessionResponse)
def get_bot_status(bot_id: int, db: Session = Depends(get_db)):
    db_bot = db.query(BotSession).filter(BotSession.id == bot_id).first()
    if not db_bot:
        raise HTTPException(status_code=404, detail="Bot session not found")
    return db_bot

@router.post("/status/{bot_id}")
def update_bot_status(bot_id: int, status_update: BotStatusUpdate, db: Session = Depends(get_db)):
    db_bot = db.query(BotSession).filter(BotSession.id == bot_id).first()
    if not db_bot:
        raise HTTPException(status_code=404, detail="Bot session not found")
    
    db_bot.status = status_update.status
    if status_update.error_message:
        db_bot.error_message = status_update.error_message
        
    db.commit()
    return {"message": "Status updated successfully"}

@router.get("/health")
def health_check():
    return {"status": "ok"}
