"""
Audio routes: audio files, preprocessing, processing status.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime
import os

from app.storage.in_memory_store import (
    bot_sessions, bot_preprocess, bot_transcripts, bot_alerts
)
from app.core.config import RECORDINGS_DIR, CLEANED_DIR

router = APIRouter()


@router.get("/bot/{bot_id}/audio-files")
@router.get("/bot/{bot_id}/recording")
def get_recording(bot_id: int):
    """Return recording chunks for the bot session."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
    
    chunks = bot_sessions[bot_id].get("recording_chunks", [])
    error = bot_sessions[bot_id].get("recording_error")
    
    # Get cleaned chunks if they exist
    cleaned_dir = os.path.join(RECORDINGS_DIR, "cleaned")
    cleaned_chunks = []
    if os.path.exists(cleaned_dir):
        cleaned_chunks = [f for f in os.listdir(cleaned_dir) if f.endswith("_clean.wav")]

    return {
        "chunks": [os.path.basename(c) for c in chunks],
        "cleaned_chunks": cleaned_chunks,
        "error": error
    }


@router.post("/bot/{bot_id}/preprocess-audio")
def preprocess_audio(bot_id: int, background_tasks: BackgroundTasks):
    """Preprocess all recorded chunks for a bot session."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")

    bot_preprocess[bot_id] = {"status": "preprocessing", "result": None}

    def _run_preprocess():
        from app.services.audio_preprocess_service import preprocess_bot_recordings
        result = preprocess_bot_recordings(bot_id)
        bot_preprocess[bot_id] = {"status": result["status"], "result": result}

    background_tasks.add_task(_run_preprocess)
    return {"status": "preprocessing", "message": "Audio preprocessing started in background."}


@router.get("/bot/{bot_id}/audio-processing-status")
def get_audio_processing_status(bot_id: int):
    """Return detailed status of audio preprocessing and transcription."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
        
    preprocess_state = bot_preprocess.get(bot_id, {"status": "not_started"})
    transcription_status = bot_sessions[bot_id].get("transcription_status", "not_started")
    error = bot_sessions[bot_id].get("transcription_error")
    
    return {
        "bot_id": bot_id,
        "preprocessing_status": preprocess_state["status"],
        "transcription_status": transcription_status,
        "error": error
    }
