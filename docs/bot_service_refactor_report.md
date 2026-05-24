# MeetAgent — Bot-Service Refactor Report

## ✅ Refactor Complete — All Imports Verified

| Metric | Before | After |
|--------|--------|-------|
| `join_meet.py` lines | **395** | **259** (34% reduction) |
| Extracted modules | 0 | **5** |
| Dead code removed | 2 files | → moved to `_trash/` |
| Import test | — | ✅ All OK |

---

## Final Bot-Service Structure

```
bot-service/
│
├── join_meet.py              ← 259 lines (was 395) — main orchestrator
├── config.py                 ← 42 lines — all constants, paths, selectors
├── status_logger.py          ← 18 lines — stdout helpers (STATUS:, ERROR:, etc.)
├── audio_recorder.py         ← 54 lines — AudioRecorder class
├── image_utils.py            ← 19 lines — screenshot diff utility
├── message_sender.py         ← 37 lines — polls backend + types into Meet chat
├── login_bot.py              ← 34 lines — Google account setup (unchanged)
│
├── recordings/               ← audio chunks + screenshots
│   ├── cleaned/
│   └── screenshots/
│
├── bot_profile/              ← persistent Chrome profile
├── requirements.txt
├── Dockerfile
│
└── _trash/                   ← dead code from old Docker architecture
    ├── app_join_meet_old.py  ← old httpx-based headless bot (unused)
    └── app_main_old.py       ← old FastAPI wrapper (unused)
```

---

## Files Created (5 new)

| File | Lines | Extracted From |
|------|-------|---------------|
| `config.py` | 42 | Constants, paths, selectors, thresholds from `join_meet.py` |
| `status_logger.py` | 18 | All `print("STATUS: ...")` calls wrapped in helpers |
| `audio_recorder.py` | 54 | `AudioRecorder` class (lines 28-82 of old file) |
| `image_utils.py` | 19 | `compute_image_difference()` function (lines 16-26) |
| `message_sender.py` | 37 | `send_pending_messages()` function (lines 84-111) |

## Files Modified (1)

| File | Change |
|------|--------|
| `join_meet.py` | 395 → 259 lines — now imports from extracted modules |

## Files Moved to `_trash/` (2 dead files)

| File | Reason |
|------|--------|
| `app/join_meet.py` | Old Docker/httpx-based bot — never used by current backend |
| `app/main.py` | Old FastAPI wrapper for Docker deployment — never called |

## Files Unchanged (2)

| File | Reason |
|------|--------|
| `login_bot.py` | Already clean (34 lines), standalone utility |
| `requirements.txt` | No dependency changes |

---

## Stdout Contract — Preserved ✅

| Prefix | Format | Used By Backend |
|--------|--------|----------------|
| `STATUS:` | `STATUS: <value>` | `bot_runtime_service.py` → updates `bot_sessions[bot_id]["status"]` |
| `STATUS: recording_started\|<path>` | pipe-delimited | Sets `is_recording = True` |
| `STATUS: chunk_saved\|<path>` | pipe-delimited | Appends to `recording_chunks`, triggers transcription |
| `STATUS: recording_failed\|<msg>` | pipe-delimited | Sets `recording_error` |
| `STATUS: recording_stopped` | plain | Cleanup |
| `STATUS: presentation_started` | plain | Sets `presentation_active = True` |
| `STATUS: presentation_ended` | plain | Sets `presentation_active = False` |
| `CHAT_MESSAGE:` | `sender \| message \| timestamp` | Appends to `bot_chats`, triggers auto-reply |
| `VISUAL:` | `captured_slide\|filename\|score` | Appends to `bot_visual_status["screenshots"]` |
| `ERROR:` | `ERROR: <message>` | Sets `error_message` |

> [!IMPORTANT]
> All status values (`launching`, `opened_meet`, `configuring_device`, `joining`, `waiting_for_host_approval`, `joined`, `monitoring_chat`, `message_sent`, `stopping_gracefully`, `stopped`, `failed`) are **identical** to the original.

---

## Backend Launch Compatibility — Preserved ✅

The backend launches:
```python
process = subprocess.Popen(
    [python_exe, bot_script, meet_link, bot_name, str(bot_id), backend_url],
    cwd=bot_dir, ...
)
```

Where `bot_script = "join_meet.py"`. The CLI interface is unchanged:
```
python join_meet.py <meet_link> <bot_name> <bot_id> <backend_url>
```

---

## How to Explain Each Module in Viva

| Module | One-Line Explanation |
|--------|---------------------|
| `join_meet.py` | Main script — launches Chrome, joins Meet, runs the monitoring loop |
| `config.py` | All settings in one place — paths, timeouts, selectors, thresholds |
| `status_logger.py` | Wraps stdout prints so backend can parse bot status |
| `audio_recorder.py` | Records system audio in 30-second WAV chunks using loopback |
| `image_utils.py` | Compares screenshots to detect when slides actually change |
| `message_sender.py` | Polls backend for user replies and types them into Meet chat |
| `login_bot.py` | One-time setup — opens Chrome so you can log into Google |

---

## What Was Deliberately NOT Split

> [!WARNING]
> The **main monitoring loop** (lines 193-256 in new `join_meet.py`) was kept intact. This loop handles chat scraping, message sending, presentation detection, and screenshot capture in a single `for` loop sharing the same `page` object and local state variables (`seen_messages`, `last_screenshot_bytes`, etc.).
>
> Splitting this loop across separate async tasks would require:
> - Shared mutable state across coroutines (race conditions)
> - Complex async coordination for a single Playwright page
> - Risk of breaking the fragile timing-dependent flow
>
> **This is the most dangerous code to refactor.** It works. Leave it.
