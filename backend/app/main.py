from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime

app = FastAPI(title="MeetClone Local API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for bot sessions
bot_sessions: Dict[int, Any] = {}
session_counter = 1

class BotSessionCreate(BaseModel):
    meet_link: str
    bot_name: str

@app.post("/bot/deploy")
def deploy_bot(bot_data: BotSessionCreate):
    global session_counter
    bot_id = session_counter
    session_counter += 1
    
    bot_sessions[bot_id] = {
        "id": bot_id,
        "meet_link": bot_data.meet_link,
        "bot_name": bot_data.bot_name,
        "status": "created",
        "created_at": datetime.now().isoformat()
    }
    
    return bot_sessions[bot_id]

@app.get("/bot/status/{bot_id}")
def get_bot_status(bot_id: int):
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
    return bot_sessions[bot_id]

@app.get("/health")
def health_check():
    return {"status": "ok"}
