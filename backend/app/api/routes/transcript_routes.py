"""
Transcript routes: get transcript, trigger transcription pipeline.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime
import os

from app.storage.in_memory_store import (
    bot_sessions, bot_transcripts, bot_preprocess, bot_alerts
)
from app.core.config import CLEANED_DIR

router = APIRouter()


@router.get("/bot/{bot_id}/transcript")
def get_transcript(bot_id: int):
    """Return the meeting transcript from recorded audio."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
    
    from app.services.transcription_service import format_timestamp
    segments = bot_transcripts.get(bot_id, [])
    preprocess_state = bot_preprocess.get(bot_id, {"status": "not_started"})
    
    formatted = []
    for seg in segments:
        formatted.append({
            "timestamp_str": format_timestamp(seg["start"]),
            "text": seg["text"]
        })
        
    return {
        "status": bot_sessions[bot_id].get("transcription_status", "not_started"),
        "preprocessing_status": preprocess_state["status"],
        "segments": formatted,
        "transcript": formatted
    }


@router.post("/bot/{bot_id}/transcribe-audio")
def transcribe_audio_unified(bot_id: int, background_tasks: BackgroundTasks):
    """Unified: Preprocess -> Transcribe -> Detect Name Mentions."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")

    bot_sessions[bot_id]["transcription_status"] = "preprocessing"
    
    def _run_full_pipeline():
        try:
            # 1. Preprocess
            from app.services.audio_preprocess_service import preprocess_bot_recordings
            bot_preprocess[bot_id] = {"status": "preprocessing", "result": None}
            prep_result = preprocess_bot_recordings(bot_id)
            bot_preprocess[bot_id] = {"status": prep_result["status"], "result": prep_result}
            
            if prep_result["status"] != "preprocessed":
                bot_sessions[bot_id]["transcription_status"] = "failed"
                bot_sessions[bot_id]["transcription_error"] = prep_result.get("error", "Preprocessing failed")
                return

            # 2. Transcribe
            bot_sessions[bot_id]["transcription_status"] = "transcribing"
            from app.services.transcription_service import transcribe_multiple_files
            
            cleaned_paths = [os.path.join(CLEANED_DIR, os.path.basename(f)) for f in prep_result["cleaned_files"]]
            
            segments = transcribe_multiple_files(cleaned_paths)
            bot_transcripts[bot_id] = segments
            bot_sessions[bot_id]["transcription_status"] = "transcribed"
            
            # 3. Detect Name Mentions
            user_name = bot_sessions[bot_id].get("user_name", "").lower()
            if user_name:
                for seg in segments:
                    if user_name in seg["text"].lower():
                        bot_alerts.setdefault(bot_id, []).append({
                            "type": "audio_name_mention",
                            "timestamp": datetime.now().isoformat(),
                            "message": f"Your name '{user_name}' was mentioned in spoken audio.",
                            "original_message": seg["text"]
                        })
                        break 
                        
        except Exception as e:
            print(f"Pipeline error: {e}")
            bot_sessions[bot_id]["transcription_status"] = "failed"
            bot_sessions[bot_id]["transcription_error"] = str(e)

    background_tasks.add_task(_run_full_pipeline)
    return {"status": "started", "message": "Preprocessing and transcription started."}
