from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime
import subprocess
import os

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

def run_bot_process(bot_id: int, meet_link: str, bot_name: str):
    # Locate the bot-service directory and script
    bot_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "bot-service"))
    bot_script = os.path.join(bot_dir, "join_meet.py")
    
    # Target the virtual environment's python directly for safety
    python_exe = os.path.join(bot_dir, "venv", "Scripts", "python.exe")
    if not os.path.exists(python_exe):
        python_exe = "python" # fallback
        
    try:
        # Start the bot process and pipe its output
        process = subprocess.Popen(
            [python_exe, bot_script, meet_link, bot_name],
            cwd=bot_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        # Read the logs line by line as they come in
        for line in iter(process.stdout.readline, ''):
            line = line.strip()
            if not line:
                continue
                
            print(f"[Bot {bot_id}] {line}")
            
            # Update status dynamically if the script reports it
            if line.startswith("STATUS:"):
                new_status = line.split("STATUS:")[1].strip()
                bot_sessions[bot_id]["status"] = new_status
            elif line.startswith("ERROR:"):
                error_msg = line.split("ERROR:")[1].strip()
                bot_sessions[bot_id]["error_message"] = error_msg
                
        process.wait()
        
        # Catch unexpected crashes
        if process.returncode != 0 and bot_sessions[bot_id]["status"] != "failed":
            bot_sessions[bot_id]["status"] = "failed"
            if "error_message" not in bot_sessions[bot_id]:
                bot_sessions[bot_id]["error_message"] = f"Process crashed with code {process.returncode}"
                
    except Exception as e:
        bot_sessions[bot_id]["status"] = "failed"
        bot_sessions[bot_id]["error_message"] = f"Subprocess launch failed: {str(e)}"

@app.post("/bot/deploy")
def deploy_bot(bot_data: BotSessionCreate, background_tasks: BackgroundTasks):
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
    
    # 1. Error handling: check link validity
    if not bot_data.meet_link.startswith("http"):
        bot_sessions[bot_id]["status"] = "failed"
        bot_sessions[bot_id]["error_message"] = "Invalid Meet link."
        return bot_sessions[bot_id]
        
    # 2. Start bot script in background immediately
    background_tasks.add_task(run_bot_process, bot_id, bot_data.meet_link, bot_data.bot_name)
    
    # 3. Return response directly
    return bot_sessions[bot_id]

@app.get("/bot/status/{bot_id}")
def get_bot_status(bot_id: int):
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
    return bot_sessions[bot_id]

@app.get("/health")
def health_check():
    return {"status": "ok"}
