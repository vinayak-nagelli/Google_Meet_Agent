"""
Summary routes: generate and retrieve AI meeting summaries.
"""
from fastapi import APIRouter, HTTPException

from app.storage.in_memory_store import (
    bot_sessions, bot_chats, bot_transcripts, bot_summaries
)

router = APIRouter()


@router.post("/bot/{bot_id}/generate-summary")
def generate_summary_endpoint(bot_id: int):
    """Generate AI meeting summary from captured chat messages."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")

    messages = bot_chats.get(bot_id, [])
    transcript_segments = bot_transcripts.get(bot_id, [])
    
    if not messages and not transcript_segments:
        return {"error": "No captured chat messages or audio transcripts available for summary."}

    try:
        from app.services.summary_service import generate_summary
        summary = generate_summary(messages, transcript_segments)
        bot_summaries[bot_id] = summary
        return summary
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API error: {str(e)}")


@router.get("/bot/{bot_id}/summary")
def get_summary(bot_id: int):
    """Return previously generated summary."""
    if bot_id not in bot_summaries:
        return {"message": "Summary not generated yet."}
    return bot_summaries[bot_id]
