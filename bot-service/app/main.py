from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import asyncio
from app.join_meet import run_bot

app = FastAPI(title="Bot Service API")

class BotStartRequest(BaseModel):
    bot_id: int
    meet_link: str
    bot_name: str

@app.post("/start")
def start_bot(request: BotStartRequest, background_tasks: BackgroundTasks):
    # Run the playwright bot in the background
    background_tasks.add_task(run_bot, request.bot_id, request.meet_link, request.bot_name)
    return {"message": "Bot starting in background", "bot_id": request.bot_id}

@app.get("/health")
def health_check():
    return {"status": "ok"}
