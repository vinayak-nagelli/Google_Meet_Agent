"""
Centralized in-memory store for all bot session data.
All routes and services import from this single module to share state.
"""
from typing import Dict, Any, List
import itertools

import os
import glob

# ── Bot Sessions & Counter ────────────────────────────────────────────────────
bot_sessions: Dict[int, Any] = {}

def _get_starting_id() -> int:
    try:
        mem_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "meeting_memory"))
        if not os.path.exists(mem_dir):
            return 1
        files = glob.glob(os.path.join(mem_dir, "*.json"))
        highest = 0
        for f in files:
            name = os.path.basename(f).replace(".json", "")
            if name.isdigit():
                highest = max(highest, int(name))
        return highest + 1
    except:
        return 1

session_counter = itertools.count(_get_starting_id())  # Thread-safe: use next(session_counter) to get next ID

# ── Chat & Messaging ─────────────────────────────────────────────────────────
bot_chats: Dict[int, List[Dict]] = {}
bot_outbox: Dict[int, List[str]] = {}
auto_replied_msgs: Dict[int, set] = {}

# ── Alerts ────────────────────────────────────────────────────────────────────
bot_alerts: Dict[int, List[Dict]] = {}

# ── AI Summaries ──────────────────────────────────────────────────────────────
bot_summaries: Dict[int, Any] = {}

# ── Audio & Transcription ─────────────────────────────────────────────────────
bot_transcripts: Dict[int, List[Dict]] = {}
bot_preprocess: Dict[int, Any] = {}

# ── Visual / Screenshots ─────────────────────────────────────────────────────
bot_visual_status: Dict[int, Any] = {}
bot_visual_artifacts: Dict[int, Any] = {}
