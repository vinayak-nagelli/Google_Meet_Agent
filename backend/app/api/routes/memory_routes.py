"""
Meeting memory routes: save, list, search, detail.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
import os

from app.schemas import MeetingSearchQuery
from app.storage.in_memory_store import (
    bot_sessions, bot_chats, bot_alerts, bot_transcripts,
    bot_summaries, bot_visual_status, bot_visual_artifacts
)

router = APIRouter()


@router.post("/bot/{bot_id}/save-memory")
def manual_save_memory(bot_id: int):
    """Manually trigger meeting memory save. Works even after server restart."""
    try:
        from app.services.meeting_memory_service import save_meeting
        from app.services.transcription_service import format_timestamp

        # Gracefully fetch whatever data is in memory — may be empty if server restarted,
        # but we still save the meeting shell with whatever is available.
        session_data = bot_sessions.get(bot_id, {})
        chats = bot_chats.get(bot_id, [])
        visual_artifacts = bot_visual_artifacts.get(bot_id, {})
        raw_segments = bot_transcripts.get(bot_id, [])

        formatted_transcript = [
            {"start": format_timestamp(s["start"]), "end": format_timestamp(s["end"]), "text": s["text"]}
            for s in raw_segments
        ]

        # Auto-generate summary if not already present but we have data
        summary_data = bot_summaries.get(bot_id, {})
        if not summary_data and (chats or raw_segments):
            try:
                from app.services.summary_service import generate_summary
                summary_data = generate_summary(chats, raw_segments)
                bot_summaries[bot_id] = summary_data
            except Exception as se:
                print(f"[Bot {bot_id}] Auto-summary failed: {se}")

        audio_chunks = [os.path.basename(c) for c in session_data.get("recording_chunks", [])]

        save_meeting(bot_id, {
            "meet_link": session_data.get("meet_link", ""),
            "bot_name": session_data.get("bot_name", "Agent"),
            "meeting_title": session_data.get("meeting_title", ""),
            "user_name": session_data.get("user_name", ""),
            "created_at": session_data.get("created_at", ""),
            "ended_at": datetime.now().isoformat(),
            "chat_messages": chats,
            "transcript": formatted_transcript,
            "summary": summary_data,
            "alerts": bot_alerts.get(bot_id, []),
            "audio_chunks": audio_chunks,
            "screenshot_metadata": bot_visual_status.get(bot_id, {}).get("screenshots", []),
            "visual_content": visual_artifacts,
        })
        return {"status": "saved", "bot_id": bot_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save failed: {e}")



@router.post("/meetings/search")
def search_meetings_endpoint(body: MeetingSearchQuery):
    """Search all stored meeting memories."""
    from app.services.meeting_memory_service import search_meetings
    results = search_meetings(
        query=body.query,
        date_filter=body.date_filter,
        participant_filter=body.participant_filter,
        has_deadline=body.has_deadline,
        has_action_items=body.has_action_items,
    )
    return {"query": body.query, "count": len(results), "results": results}


@router.get("/meetings/list")
def list_all_meetings():
    """Return metadata for all stored meetings, newest first."""
    from app.services.meeting_memory_service import load_all_meetings
    meetings = load_all_meetings()
    return {"count": len(meetings), "meetings": [
        {
            "bot_id": m.get("bot_id"),
            "meet_link": m.get("meet_link", ""),
            "bot_name": m.get("bot_name", "Agent"),
            "saved_at": m.get("saved_at", ""),
            "summary_short": (m.get("summary", {}) or {}).get("meeting_summary", "")[:200],
            "action_items": (m.get("summary", {}) or {}).get("action_items", []),
            "deadlines": (m.get("summary", {}) or {}).get("deadlines", []),
        }
        for m in meetings
    ]}


@router.get("/meetings/{bot_id}")
def get_meeting_detail(bot_id: int):
    """Return full stored meeting data for a given bot_id."""
    from app.services.meeting_memory_service import load_meeting
    meeting = load_meeting(bot_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found in memory")
    return meeting
