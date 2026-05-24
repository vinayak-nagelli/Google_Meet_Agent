"""
Bot Runtime Service
Handles bot subprocess lifecycle, stdout parsing, and helper functions.

IMPORTANT: This is a direct extraction from the original main.py.
The logic has NOT been rewritten — only moved here for clarity.
"""
import os
import re
import subprocess
import threading
import glob
from datetime import datetime
from typing import Dict, Optional

from app.storage.in_memory_store import (
    bot_sessions, bot_chats, bot_alerts, bot_outbox,
    auto_replied_msgs, bot_transcripts, bot_summaries,
    bot_visual_status, bot_visual_artifacts
)
from app.core.config import RECORDINGS_DIR


# ── Instruction Parser (legacy keyword-based, still called at deploy) ─────────

def parse_instruction(instruction: str) -> Optional[Dict]:
    """
    Parse a plain-English instruction into trigger keywords + response.

    Strategy: Find "reply:" anywhere in the instruction.
    - Everything AFTER reply: is the response.
    - Everything BEFORE reply: is the trigger text; extract meaningful keywords from it.

    Supported examples:
      - "If someone asks about how are you Vinayak, reply: I am fine and you?"
      - "If someone asks task update, reply: Done by Thursday"
      - "meeting, agenda -> Tell them it starts at 10AM"
      - "trigger: deadline | response: It is Friday"
    """
    if not instruction.strip():
        return None

    instruction = instruction.strip()

    # ── Primary strategy: split on "reply:" ──────────────────────────────────
    reply_match = re.search(r'\breply\s*[:\-]\s*(.+)$', instruction, re.IGNORECASE)
    if reply_match:
        response = reply_match.group(1).strip()
        trigger_text = instruction[:reply_match.start()].strip()

        FILLER = {
            "if", "someone", "anyone", "asks", "ask", "says", "say",
            "about", "when", "a", "the", "is", "are", "for", "to",
            "they", "mention", "mentions", "mentioned", "question",
            "message", "messages", "chat", "types", "type"
        }
        words = re.split(r'[\s,/]+', trigger_text)
        keywords = [w.lower() for w in words if len(w) > 2 and w.lower() not in FILLER]

        if keywords and response:
            print(f"[AutoReply] Parsed keywords={keywords}, response={response!r}")
            return {"keywords": keywords, "response": response}

    # ── Fallback: "keyword1, keyword2 -> response" ────────────────────────────
    arrow_match = re.search(r'(.+?)\s*->\s*(.+)', instruction)
    if arrow_match:
        keyword_part = arrow_match.group(1).strip()
        response = arrow_match.group(2).strip()
        keywords = [w.strip().lower() for w in re.split(r'[,/\s]+', keyword_part) if len(w.strip()) > 2]
        if keywords and response:
            print(f"[AutoReply] Arrow-parsed keywords={keywords}, response={response!r}")
            return {"keywords": keywords, "response": response}

    # ── Fallback: "trigger: ... | response: ..." ─────────────────────────────
    pipe_match = re.search(r'trigger[:\s]+(.+?)\s*\|\s*response[:\s]+(.+)', instruction, re.IGNORECASE)
    if pipe_match:
        keyword_part = pipe_match.group(1).strip()
        response = pipe_match.group(2).strip()
        keywords = [w.strip().lower() for w in re.split(r'[,/\s]+', keyword_part) if len(w.strip()) > 2]
        if keywords and response:
            print(f"[AutoReply] Pipe-parsed keywords={keywords}, response={response!r}")
            return {"keywords": keywords, "response": response}

    return None


# ── Auto-Reply via LLM ───────────────────────────────────────────────────────

def check_auto_reply(bot_id: int, sender: str, message: str):
    """Use Groq LLM to decide if message should trigger auto-reply."""
    session = bot_sessions.get(bot_id)
    if not session:
        return

    instruction = session.get("auto_instruction", "").strip()
    if not instruction:
        return

    # Avoid replying to bot's own messages
    if sender in ("You via Bot", "Bot (Auto-reply)"):
        return

    # Avoid replying to the same message twice
    msg_key = f"{sender}:{message}"
    if msg_key in auto_replied_msgs.get(bot_id, set()):
        return

    user_context = session.get("user_context", "").strip()

    try:
        from app.services.summary_service import check_auto_reply_with_llm
        reply_text = check_auto_reply_with_llm(instruction, sender, message, user_context)
    except Exception as e:
        print(f"[Bot {bot_id}] AutoReply LLM error: {e}")
        return

    if reply_text:
        auto_replied_msgs.setdefault(bot_id, set()).add(msg_key)
        bot_outbox.setdefault(bot_id, []).append(reply_text)
        ts = datetime.now().strftime("%H:%M:%S")
        bot_chats.setdefault(bot_id, []).append({
            "sender": "Bot (Auto-reply)",
            "message": reply_text,
            "timestamp": ts,
            "auto_reply": True
        })
        print(f"[Bot {bot_id}] LLM AUTO-REPLY to '{sender}': {reply_text}")


# ── Name Mention Detection ───────────────────────────────────────────────────

def check_name_mention(bot_id: int, sender: str, message: str, timestamp: str):
    session = bot_sessions.get(bot_id)
    if not session:
        return
    user_name = session.get("user_name", "").strip()
    if not user_name:
        return
    if user_name.lower() in message.lower():
        alert = {
            "bot_id": bot_id,
            "type": "name_mention",
            "message": f"Your name was mentioned by {sender}",
            "original_message": message,
            "sender": sender,
            "timestamp": timestamp
        }
        bot_alerts.setdefault(bot_id, []).append(alert)
        print(f"[Bot {bot_id}] ALERT: Name mention by {sender}: {message}")


# ── Bot Subprocess Runner ─────────────────────────────────────────────────────
# WARNING: This function is complex but battle-tested. Do NOT rewrite internals.

def run_bot_process(bot_id: int, meet_link: str, bot_name: str):
    bot_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "bot-service"))
    bot_script = os.path.join(bot_dir, "join_meet.py")

    python_exe = os.path.join(bot_dir, "venv", "Scripts", "python.exe")
    if not os.path.exists(python_exe):
        python_exe = "python"

    backend_url = "http://localhost:8000"

    try:
        process = subprocess.Popen(
            [python_exe, bot_script, meet_link, bot_name, str(bot_id), backend_url],
            cwd=bot_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        bot_sessions[bot_id]["_process"] = process

        def _run_transcription_task(f_path):
            from app.services.transcription_service import transcribe_audio_file, format_timestamp
            import time
            time.sleep(2)  # Wait for file write to fully flush before transcribing
            bot_sessions[bot_id]["transcribing"] = True
            try:
                segments = transcribe_audio_file(f_path)
                if segments:
                    bot_transcripts.setdefault(bot_id, []).extend(segments)
                    
                    user_name = bot_sessions[bot_id].get("user_name", "").strip().lower()
                    if user_name:
                        for seg in segments:
                            if user_name in seg["text"].lower():
                                alert = {
                                    "bot_id": bot_id,
                                    "type": "name_mention_audio",
                                    "message": f"Your name was spoken in the meeting!",
                                    "original_message": f"{format_timestamp(seg['start'])}: {seg['text']}",
                                    "sender": "Audio Transcript",
                                    "timestamp": datetime.now().strftime("%H:%M:%S")
                                }
                                bot_alerts.setdefault(bot_id, []).append(alert)
            except Exception as e:
                print(f"[Bot {bot_id}] Transcription error: {e}")
            finally:
                bot_sessions[bot_id]["transcribing"] = False

        for line in iter(process.stdout.readline, ''):
            line = line.strip()
            if not line:
                continue
            print(f"[Bot {bot_id}] {line}")

            if line.startswith("STATUS:"):
                status_str = line.split("STATUS:")[1].strip()
                if status_str.startswith("recording_started|"):
                    bot_sessions[bot_id]["is_recording"] = True
                elif status_str.startswith("chunk_saved|"):
                    filename = status_str.split("|")[1]
                    bot_sessions[bot_id].setdefault("recording_chunks", []).append(filename)
                    threading.Thread(target=_run_transcription_task, args=(filename,)).start()

                elif status_str.startswith("recording_failed|"):
                    bot_sessions[bot_id]["recording_error"] = status_str.split("|")[1]
                elif status_str == "presentation_started":
                    bot_visual_status.setdefault(bot_id, {"presentation_active": False, "screenshots": []})
                    bot_visual_status[bot_id]["presentation_active"] = True
                elif status_str == "presentation_ended":
                    bot_visual_status.setdefault(bot_id, {"presentation_active": False, "screenshots": []})
                    bot_visual_status[bot_id]["presentation_active"] = False
                elif status_str in ["recording_started", "recording_stopped"]:
                    pass
                else:
                    bot_sessions[bot_id]["status"] = status_str

            elif line.startswith("VISUAL:"):
                parts = line.replace("VISUAL:", "").strip().split("|")
                if len(parts) >= 3 and parts[0].strip() == "captured_slide":
                    filename = parts[1].strip()
                    diff_score = parts[2].strip()
                    bot_visual_status.setdefault(bot_id, {"presentation_active": False, "screenshots": []})
                    bot_visual_status[bot_id]["screenshots"].append({
                        "file_path": f"/recordings/screenshots/{bot_id}/{filename}",
                        "filename": filename,
                        "captured_at": datetime.now().strftime("%H:%M:%S"),
                        "change_score": diff_score
                    })


            elif line.startswith("ERROR:"):
                bot_sessions[bot_id]["error_message"] = line.split("ERROR:")[1].strip()

            elif line.startswith("CHAT_MESSAGE:"):
                # Split with maxsplit=2 so pipe chars inside the message body don't break parsing
                parts = line.replace("CHAT_MESSAGE:", "").strip().split("|", 2)
                if len(parts) >= 3:
                    sender = parts[0].strip()
                    message = parts[1].strip()
                    timestamp = parts[2].strip()

                    is_bot_message = False
                    
                    session = bot_sessions.get(bot_id, {})
                    ignore_names = {"You", "You via Bot", "Bot (Auto-reply)", session.get("user_name", ""), session.get("bot_name", "")}
                    if sender in ignore_names or not sender:
                        is_bot_message = True
                        
                    if not is_bot_message:
                        recent_outbox = bot_outbox.get(bot_id, [])
                        if message in recent_outbox:
                            is_bot_message = True

                    if not is_bot_message:
                        bot_chats.setdefault(bot_id, []).append({
                            "sender": sender, "message": message, "timestamp": timestamp
                        })
                        check_name_mention(bot_id, sender, message, timestamp)
                        check_auto_reply(bot_id, sender, message)

        process.wait()
        bot_sessions[bot_id]["is_recording"] = False
        bot_sessions[bot_id]["transcribing"] = False
        bot_sessions[bot_id]["_process"] = None
        
        # Scan for orphaned audio chunks
        pattern = os.path.join(RECORDINGS_DIR, f"{bot_id}_*.wav")
        found_files = glob.glob(pattern)
        known_chunks = bot_sessions[bot_id].get("recording_chunks", [])
        
        for f in found_files:
            if f not in known_chunks:
                print(f"[Bot {bot_id}] Found orphaned chunk: {f}")
                bot_sessions[bot_id].setdefault("recording_chunks", []).append(f)
                _run_transcription_task(f)

        # Guard against KeyError if session was cleared externally (e.g. stop was called)
        if process.returncode != 0 and bot_sessions.get(bot_id, {}).get("status") not in ["failed", "stopped"]:
            bot_sessions[bot_id]["status"] = "failed"
            bot_sessions[bot_id].setdefault("error_message", f"Process crashed with code {process.returncode}")

        # Auto-save meeting memory when bot process finishes
        try:
            from app.services.meeting_memory_service import save_meeting
            from app.services.transcription_service import format_timestamp

            session_data = bot_sessions.get(bot_id, {})
            summary_data = bot_summaries.get(bot_id, {})
            chats = bot_chats.get(bot_id, [])
            visual_artifacts = bot_visual_artifacts.get(bot_id, {})

            raw_segments = bot_transcripts.get(bot_id, [])
            formatted_transcript = [
                {"start": format_timestamp(s["start"]), "end": format_timestamp(s["end"]), "text": s["text"]}
                for s in raw_segments
            ]

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
            print(f"[Bot {bot_id}] Meeting memory saved.")
        except Exception as e:
            print(f"[Bot {bot_id}] Warning: Failed to save meeting memory: {e}")

    except Exception as e:
        bot_sessions[bot_id]["status"] = "failed"
        bot_sessions[bot_id]["error_message"] = f"Subprocess launch failed: {str(e)}"
