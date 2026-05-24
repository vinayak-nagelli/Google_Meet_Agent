"""
Milestone 15: Meeting Memory Service
Handles persisting and searching past meeting data to local JSON files.
Structured to allow easy database migration in the future.
"""
import os
import json
import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

MEMORY_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "meeting_memory")
)
os.makedirs(MEMORY_DIR, exist_ok=True)


def _meeting_path(bot_id: int) -> str:
    return os.path.join(MEMORY_DIR, f"{bot_id}.json")


def _is_nonempty(value: Any) -> bool:
    """Return True if value contains meaningful data (not empty string/list/dict/None)."""
    if value is None:
        return False
    if isinstance(value, (str, list, dict)):
        return bool(value)
    return True


def save_meeting(bot_id: int, data: Dict[str, Any]) -> bool:
    """Persist meeting data to disk. Smart-merges with existing data:
    existing good data is NEVER overwritten by new empty values.
    This prevents server-restart saves from wiping real session data."""
    try:
        path = _meeting_path(bot_id)
        existing = {}
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                existing = json.load(f)

        # Smart merge: only overwrite a field if the new value is non-empty
        # OR if the field doesn't exist yet in the existing record.
        for key, new_val in data.items():
            if key not in existing:
                # New field — always write it
                existing[key] = new_val
            elif _is_nonempty(new_val):
                # Existing field — only overwrite if new value has real content
                existing[key] = new_val
            # else: keep the existing good value, skip empty new value

        existing["bot_id"] = bot_id
        existing.setdefault("saved_at", datetime.now().isoformat())
        existing["last_updated"] = datetime.now().isoformat()

        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        logging.info(f"MeetingMemory: Saved bot {bot_id} to {path}")
        return True
    except Exception as e:
        logging.error(f"MeetingMemory: Failed to save bot {bot_id}: {e}")
        return False


def load_meeting(bot_id: int) -> Optional[Dict[str, Any]]:
    """Load a single meeting by bot_id."""
    path = _meeting_path(bot_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"MeetingMemory: Failed to load bot {bot_id}: {e}")
        return None


def load_all_meetings() -> List[Dict[str, Any]]:
    """Load all stored meetings, sorted newest first."""
    meetings = []
    for fname in os.listdir(MEMORY_DIR):
        if not fname.endswith(".json"):
            continue
        try:
            with open(os.path.join(MEMORY_DIR, fname), "r", encoding="utf-8") as f:
                meetings.append(json.load(f))
        except Exception:
            continue
    # Sort newest first
    meetings.sort(key=lambda m: m.get("saved_at", ""), reverse=True)
    return meetings


def _extract_text_corpus(meeting: Dict) -> str:
    """Build a single flat text from all meeting fields for keyword search."""
    parts = []

    # Summary
    summary = meeting.get("summary", {})
    if isinstance(summary, dict):
        parts.append(summary.get("meeting_summary", ""))
        for k in ["key_points", "decisions", "action_items", "deadlines", "unanswered_questions"]:
            items = summary.get(k, [])
            if isinstance(items, list):
                parts.extend(items)
        for p in summary.get("participant_summaries", []):
            parts.append(p.get("participant", ""))
            parts.extend(p.get("main_points", []))
            parts.extend(p.get("action_items", []))

    # Chat messages
    for msg in meeting.get("chat_messages", []):
        parts.append(msg.get("sender", ""))
        parts.append(msg.get("message", ""))

    # Transcript
    for seg in meeting.get("transcript", []):
        parts.append(seg.get("text", ""))

    # Visual extraction
    for shot in meeting.get("visual_content", {}).get("screenshots", []):
        vr = shot.get("vision_result", {})
        if vr:
            parts.append(vr.get("slide_title", ""))
            parts.extend(vr.get("main_text_blocks", []))
            parts.extend(vr.get("bullet_points", []))

    return " ".join(str(p) for p in parts if p)


def _find_snippet(text: str, query: str, window: int = 80) -> str:
    """Return a short snippet around the first keyword match."""
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx == -1:
        return text[:160] + "..." if len(text) > 160 else text
    start = max(0, idx - window)
    end = min(len(text), idx + len(query) + window)
    snippet = ("..." if start > 0 else "") + text[start:end].strip() + ("..." if end < len(text) else "")
    return snippet


def search_meetings(
    query: str,
    date_filter: Optional[str] = None,
    participant_filter: Optional[str] = None,
    has_deadline: Optional[bool] = None,
    has_action_items: Optional[bool] = None
) -> List[Dict[str, Any]]:
    """Search all meetings for keyword query with optional filters."""
    all_meetings = load_all_meetings()
    results = []

    query_lower = query.lower().strip() if query else ""

    for meeting in all_meetings:
        # ── Apply Filters ────────────────────────────
        if date_filter:
            saved_at = meeting.get("saved_at", "")[:10]
            if saved_at != date_filter:
                continue

        if participant_filter:
            summary = meeting.get("summary", {})
            participants = [
                p.get("participant", "").lower()
                for p in summary.get("participant_summaries", [])
            ]
            chat_senders = [
                m.get("sender", "").lower()
                for m in meeting.get("chat_messages", [])
            ]
            all_names = participants + chat_senders
            if not any(participant_filter.lower() in n for n in all_names):
                continue

        summary = meeting.get("summary", {})
        if has_deadline is True:
            if not summary.get("deadlines"):
                continue
        if has_action_items is True:
            if not summary.get("action_items"):
                continue

        # ── Keyword Search ─────────────────────────
        corpus = _extract_text_corpus(meeting)
        if query_lower and query_lower not in corpus.lower():
            continue

        # Build result
        snippet = _find_snippet(corpus, query_lower) if query_lower else (corpus[:200] + "...")
        results.append({
            "bot_id": meeting.get("bot_id"),
            "meet_link": meeting.get("meet_link", ""),
            "bot_name": meeting.get("bot_name", "Agent"),
            "saved_at": meeting.get("saved_at", ""),
            "last_updated": meeting.get("last_updated", ""),
            "summary_short": (summary.get("meeting_summary", "") or "")[:200],
            "snippet": snippet,
            "action_items": summary.get("action_items", []),
            "deadlines": summary.get("deadlines", []),
        })

    return results
