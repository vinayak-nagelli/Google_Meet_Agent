# MeetAgent — Backend Audit Report

> [!NOTE]
> This is an **analysis-only** report. No code has been modified. Fixes will only be applied after your review.

---

## 1. Backend Health Summary

| Area | Status |
|------|--------|
| **Server Startup** | ✅ Stable (FastAPI + Uvicorn) |
| **Core Features** | ✅ Deploy, chat, alerts, audio, transcript, summary, vision, memory all functional |
| **Architecture** | ⚠️ Monolithic — 849-line `main.py` contains ALL routes + business logic |
| **Data Persistence** | ⚠️ In-memory dicts — all session data lost on server restart |
| **Security** | 🔴 API key exposed in `.env` (committed to git), CORS wide open |
| **Dead Code** | ⚠️ Significant — entire OCR service, DB layer, API router unused |

### Major Strengths
- All Groq integrations work (STT, LLM summary, vision, auto-reply)
- Audio preprocessing pipeline with ffmpeg fallback is robust
- Hallucination filtering in transcription is smart
- Meeting memory search is well-structured

### Major Risks
1. **`.env` has raw API key committed to git** — credential leak
2. **All state is in-memory** — server restart = total data loss mid-meeting
3. **`main.py` is 849 lines** — monolith with routes + logic mixed together
4. **`ocr_service.py` is dead code** (replaced by `vision_service.py`) but still imported by nothing
5. **Entire `api/endpoints.py`, `core/database.py`, `models/`, `schemas/` are unused** — leftover from an earlier DB-based architecture

---

## 2. Route / API Audit

### All Endpoints in `main.py`

| # | Method | Path | Purpose | Used by Frontend? | Risk |
|---|--------|------|---------|-------------------|------|
| 1 | POST | `/bot/deploy` | Deploy bot | ✅ Yes | Low |
| 2 | GET | `/bot/status/{bot_id}` | Poll status | ✅ Yes | Low |
| 3 | POST | `/bot/{bot_id}/chat` | Bot posts chat msg | ❌ Bot-service only | Low |
| 4 | GET | `/bot/{bot_id}/chat` | Get chat messages | ✅ Yes | Low |
| 5 | GET | `/bot/{bot_id}/alerts` | Get alerts | ✅ Yes | Low |
| 6 | POST | `/bot/{bot_id}/send-message` | Manual reply | ✅ Yes | Low |
| 7 | GET | `/bot/{bot_id}/pending-messages` | Bot polls outbox | ❌ Bot-service only | Low |
| 8 | POST | `/bot/{bot_id}/generate-summary` | Generate AI summary | ✅ Yes | Medium |
| 9 | GET | `/bot/{bot_id}/summary` | Get cached summary | ❌ Not called by frontend | Low |
| 10 | GET | `/bot/{bot_id}/audio-files` + `/bot/{bot_id}/recording` | Get audio chunks | ✅ Yes (audio-files) | ⚠️ Medium — dual-path alias |
| 11 | GET | `/bot/{bot_id}/transcript` | Get transcript | ✅ Yes | Low |
| 12 | POST | `/bot/{bot_id}/transcribe-audio` | Full preprocess+transcribe pipeline | ❌ Not called by frontend | Medium — orphaned |
| 13 | POST | `/bot/{bot_id}/stop` + `/bot/{bot_id}/end` | Stop bot | ✅ Yes (stop) | ⚠️ Dual-path alias |
| 14 | POST | `/bot/{bot_id}/preprocess-audio` | Preprocess audio only | ❌ Not called | Medium — orphaned |
| 15 | GET | `/bot/{bot_id}/audio-processing-status` | Preprocessing status | ❌ Not called | Low — orphaned |
| 16 | GET | `/bot/{bot_id}/visual-status` | Visual summary stats | ❌ Not called by frontend | Low — orphaned |
| 17 | GET | `/bot/{bot_id}/screenshots` | Get screenshots | ✅ Yes | Low |
| 18 | POST | `/bot/{bot_id}/process-visual-content` | Groq Vision extraction | ✅ Yes | Medium |
| 19 | GET | `/bot/{bot_id}/visual-content` | Get vision results | ✅ Yes | Low |
| 20 | GET | `/health` | Health check | ❌ Not called | Low |
| 21 | POST | `/meetings/search` | Search memory | ✅ Yes | Low |
| 22 | GET | `/meetings/list` | List all meetings | ✅ Yes | Low |
| 23 | GET | `/meetings/{bot_id}` | Meeting detail | ✅ Yes | Low |
| 24 | POST | `/bot/{bot_id}/save-memory` | Save meeting to memory | ✅ Yes | Medium |

### Endpoints in `api/endpoints.py` (NEVER MOUNTED)

| Method | Path | Status |
|--------|------|--------|
| POST | `/deploy` | 🔴 Dead — not mounted in `app` |
| GET | `/status/{bot_id}` | 🔴 Dead — not mounted |
| POST | `/status/{bot_id}` | 🔴 Dead — not mounted |
| GET | `/health` | 🔴 Dead — duplicate of main.py |

> [!WARNING]
> `api/endpoints.py` is **never imported or mounted** in `main.py`. It uses SQLAlchemy DB sessions which are also unused. This entire file is dead code from an earlier architecture.

### Route Issues Found

1. **Dual-path aliases**: Lines 496-497 (`/audio-files` + `/recording`) and 600-601 (`/stop` + `/end`) — confusing, only one path is used
2. **Orphaned endpoints**: `transcribe-audio`, `preprocess-audio`, `audio-processing-status`, `visual-status`, `summary` GET — none called by frontend
3. **`/bot/{bot_id}/visual-status`** vs **`/bot/{bot_id}/screenshots`** — two endpoints returning overlapping data with different shapes

---

## 3. Service Layer Audit

### File-by-File Analysis

| Service File | Lines | Purpose | Issues |
|-------------|-------|---------|--------|
| `summary_service.py` | 214 | LLM summary + auto-reply | ✅ Clean, well-structured |
| `transcription_service.py` | 152 | Groq Whisper STT | ⚠️ SSL verify=False, httpx import inside function |
| `vision_service.py` | 144 | Groq Vision extraction | ✅ Good, has JSON fallback |
| `ocr_service.py` | 196 | Tesseract OCR | 🔴 **Entirely dead code** — never called anywhere |
| `audio_preprocess_service.py` | 276 | ffmpeg preprocessing | ⚠️ Hardcoded Windows user paths |
| `meeting_memory_service.py` | 186 | JSON file storage | ✅ Clean, well-structured |

### Critical Findings

1. **`ocr_service.py`** — 196 lines of dead code. `process_bot_screenshots` is never imported. It was replaced by `vision_service.py`. Imports `cv2`, `pytesseract`, `numpy` which aren't even in `requirements.txt`.

2. **Business logic in `main.py`** — The `run_bot_process()` function (lines 191-374) is ~180 lines of business logic directly in the routes file. It handles stdout parsing, status updates, transcription spawning, orphan detection, and auto-save. This should be a service.

3. **`parse_instruction()`** (lines 66-125) — 60 lines of keyword-matching logic in `main.py` that is now **unused** because auto-reply switched to LLM-based `check_auto_reply_with_llm()`. The old `auto_rule` dict is still stored in sessions but never read for matching.

4. **Duplicate memory save logic** — Nearly identical code at lines 340-369 (auto-save on process exit) and lines 802-848 (manual save endpoint). The manual save version has extra fields (`meeting_title`, `audio_chunks`) that the auto-save version is missing.

---

## 4. Groq API Audit

### All Groq API Calls

| Service | Model | Purpose | Temp | Max Tokens | Risk |
|---------|-------|---------|------|------------|------|
| `summary_service.py` | `llama-3.3-70b-versatile` | Meeting summary | 0.2 | 4096 | ⚠️ Cost — 70B model |
| `summary_service.py` | `llama-3.1-8b-instant` | Auto-reply decisions | 0.1 | 200 | ✅ Low cost |
| `transcription_service.py` | `whisper-large-v3` | Audio STT | — | — | ⚠️ 25MB file limit |
| `vision_service.py` | `llama-4-scout-17b-16e-instruct` | Screenshot OCR | 0.1 | — | ⚠️ No max_tokens set |

### Prompt Quality Analysis

**Auto-Reply Prompt** (summary_service.py:30-56)
- ✅ Strengths: Clear JSON schema, explicit "should_reply" boolean, context injection
- ⚠️ Weakness: No token limit awareness. If `user_context` is very long, prompt could be huge
- ⚠️ Risk: No rate limiting — every chat message triggers an LLM call
- Hallucination risk: **Low** — binary decision with constrained output

**Summary Prompt** (summary_service.py:106-149)
- ✅ Strengths: Explicit JSON schema, anti-hallucination rules, "use only provided data"
- ⚠️ Weakness: Both chat + transcript are injected as raw text. If meeting is long (>1hr), this could exceed context window (~128K tokens for 70B)
- ⚠️ Risk: No truncation/chunking for very long meetings
- Hallucination risk: **Medium** — "Extract action items only if clearly mentioned" is good, but model may still infer

**Vision Prompt** (vision_service.py:81-97)
- ✅ Strengths: Clear JSON schema, "Do not summarize, extract full text"
- ⚠️ Weakness: **No max_tokens set** — model could return arbitrarily long response
- ⚠️ Weakness: "Ignore browser UI clutter" is vague — model may miss actual content
- Hallucination risk: **Medium** — extracting text from images is inherently uncertain

**Transcription** (Whisper)
- ✅ Has hallucination blocklist (`HALLUCINATION_PATTERNS`)
- ✅ Filters short/garbage segments
- ⚠️ Uses `translations` endpoint (always English) — might lose meaning if meeting is in another language intentionally

### Cost/Usage Risks

1. **Auto-reply calls 8B model per EVERY incoming chat message** — if meeting has 100 messages, that's 100 LLM calls
2. **Summary uses 70B model** — expensive, but only called once per session (manually)
3. **Vision processes up to 15 screenshots** — each is a separate API call with base64 image
4. **No rate limiting or caching** on any Groq calls

---

## 5. Storage and Path Audit

### Path Definitions Found

| Variable | Location | Value | Issue |
|----------|----------|-------|-------|
| `RECORDINGS_DIR` | main.py:17 | `../../bot-service/recordings` (relative) | ✅ OK |
| `CLEANED_DIR` | main.py:22 | `RECORDINGS_DIR/cleaned` | ✅ OK |
| `RECORDINGS_DIR` | audio_preprocess_service.py:13 | Same relative path | ⚠️ Duplicate definition |
| `CLEANED_DIR` | audio_preprocess_service.py:16 | Same | ⚠️ Duplicate definition |
| `MEMORY_DIR` | meeting_memory_service.py:13 | `../../../meeting_memory` | ✅ OK |
| `WINGET_FFMPEG` | audio_preprocess_service.py:26 | `C:\Users\Swapnil\AppData\...` | 🔴 **Hardcoded user path** |
| `WINGET_FFPROBE` | audio_preprocess_service.py:27 | `C:\Users\Swapnil\AppData\...` | 🔴 **Hardcoded user path** |
| `base_dir` | vision_service.py:70 | `../../../bot-service/recordings/screenshots/{bot_id}` | ✅ OK |
| `base_dir` | ocr_service.py:116 | Same | 🔴 Dead code |
| Tesseract paths | ocr_service.py:107-109 | `C:\Users\Swapnil\AppData\...` | 🔴 Dead code + hardcoded |

### Issues

1. **`RECORDINGS_DIR` defined in 2 places** (main.py + audio_preprocess_service.py) — could drift
2. **Hardcoded `C:\Users\Swapnil\...`** in ffmpeg paths — breaks on any other machine
3. **No cleanup/retention** — recordings, screenshots, cleaned files grow forever
4. **Screenshot paths use `/recordings/screenshots/{bot_id}/`** which is served via static mount, but the mount is only on `/recordings` pointing to `bot-service/recordings/` — this works only if screenshots dir is inside that tree

---

## 6. Meeting Memory Audit

### Auto-Save (process exit, line 356) vs Manual Save (line 832)

| Field | Auto-Save | Manual Save | Match? |
|-------|-----------|-------------|--------|
| `meet_link` | ✅ | ✅ | ✅ |
| `bot_name` | ✅ | ✅ | ✅ |
| `meeting_title` | ❌ Missing | ✅ | 🔴 **Mismatch** |
| `created_at` | ✅ | ✅ | ✅ |
| `ended_at` | ✅ | ✅ | ✅ |
| `chat_messages` | ✅ | ✅ | ✅ |
| `transcript` | ✅ | ✅ | ✅ |
| `summary` | ✅ (if generated) | ✅ (auto-generates if missing) | ⚠️ Manual is smarter |
| `audio_chunks` | ❌ Missing | ✅ | 🔴 **Mismatch** |
| `screenshot_metadata` | ✅ | ✅ | ✅ |
| `visual_content` | ✅ | ✅ | ✅ |
| `user_name` | ❌ Missing | ❌ Missing | 🔴 **Both missing** |
| `alerts` | ❌ Missing | ❌ Missing | 🔴 **Both missing** |

### Issues

1. **`user_name` never saved to memory** — lost after session ends
2. **`meeting_title` only saved via manual save**, not auto-save on process exit
3. **`alerts` never persisted** to meeting memory at all
4. **`audio_chunks` only saved via manual save** — auto-save doesn't include them
5. **Transcript format mismatch**: Auto-save uses `{start, end, text}`, frontend memory detail view expects `{timestamp_str, text}` — the memory service stores whatever is passed, so loaded data may not have `timestamp_str`

---

## 7. Error Handling Audit

| Area | Error Handling | Visibility to Frontend | Severity |
|------|---------------|----------------------|----------|
| Bot deploy (invalid link) | ✅ Returns failed status | ✅ | Low |
| Subprocess crash | ✅ Sets status=failed with message | ✅ | Low |
| Groq summary failure | ✅ HTTPException 500 | ✅ | Low |
| Groq auto-reply failure | ⚠️ Print only, silently skips | ❌ Hidden | Medium |
| Groq vision failure | ⚠️ Per-screenshot error, no overall fail | ✅ Partial | Low |
| Transcription failure | ⚠️ Print only in thread | ❌ Hidden | Medium |
| ffmpeg not found | ✅ Returns clear error message | ✅ | Low |
| Meeting memory save failure | ⚠️ Print only in auto-save | ❌ Hidden in auto-save | High |
| File not found (audio/screenshot) | ⚠️ `continue` silently | ❌ Hidden | Medium |
| JSON parse failure (Groq response) | ✅ Returns fallback dict | ✅ | Low |
| SSL certificate error | ⚠️ Bypassed with `verify=False` | N/A | Medium (security) |

### Key Gaps

1. **Auto-save failure on process exit** (line 368) — only prints warning, frontend never knows
2. **Transcription errors in background threads** (line 233) — printed, not stored in session state
3. **Auto-reply LLM errors** (line 154) — silently swallowed

---

## 8. Performance and Cost Audit

### High Risk
| Issue | Impact | Fix Effort |
|-------|--------|------------|
| Auto-reply calls LLM for EVERY chat message | 🔴 100+ API calls per meeting | Medium — add cooldown/batching |
| No dedup check before re-transcribing chunks | ⚠️ May re-transcribe same chunk | Low — check if already in bot_transcripts |
| All state in-memory dicts | 🔴 Server restart = total loss | High — needs persistence layer |

### Medium Risk
| Issue | Impact | Fix Effort |
|-------|--------|------------|
| `load_all_meetings()` reads ALL JSON files on every call | Slow with many meetings | Medium |
| Vision sends up to 15 base64 images sequentially | Slow, ~15 API calls | Low — already limited |
| No cleanup for old recordings/screenshots | Disk growth | Low |
| Polling interval 3s from frontend × 7 endpoints | 2.3 requests/second per session | Low |

### Low Risk
| Issue | Impact |
|-------|--------|
| `cleaned_chunks` scans entire directory on every audio-files GET | Negligible for few files |
| `format_timestamp` import inside function body | Negligible perf impact |

---

## 9. Security and Privacy Audit

| Issue | Severity | Location |
|-------|----------|----------|
| 🔴 **API key in `.env` committed to git** | **Critical** | `.env` line 1 — `gsk_OqnkNURL...` |
| 🔴 **Second API key in comment** | **Critical** | `.env` line 2 — commented but exposed |
| ⚠️ **CORS allows all origins** (`allow_origins=["*"]`) | Medium | main.py:27 |
| ⚠️ **SSL verification disabled** (`verify=False`) | Medium | transcription_service.py:57 |
| ⚠️ **Static files served without auth** | Medium | All recordings/screenshots publicly accessible |
| ⚠️ **User paths hardcoded** (`C:\Users\Swapnil\...`) | Low | audio_preprocess_service.py:26-27 |
| ⚠️ **`data/users.json` has hashed passwords** | Low | Not served via API but in repo |
| ⚠️ **No user isolation** — single global state | Low | Architecture limitation |

> [!CAUTION]
> The `.env` file contains a **live Groq API key** that is committed to git. This key should be rotated immediately and `.env` added to `.gitignore`.

---

## 10. Dead Code / Unused Code Candidates

| File / Function | Reason Unused | Confidence | Safe to Delete? |
|----------------|---------------|------------|-----------------|
| `app/services/ocr_service.py` (196 lines) | Replaced by `vision_service.py`. Never imported anywhere. | **High** | ✅ Yes — safe now |
| `app/api/endpoints.py` (63 lines) | Never mounted in `main.py`. Uses DB sessions that aren't used. | **High** | ✅ Yes — safe now |
| `app/api/routes/` (empty dir, only `__pycache__`) | No route files exist | **High** | ✅ Yes — safe now |
| `app/core/database.py` (20 lines) | Only imported by dead `endpoints.py`. DB never used. | **High** | ✅ Yes — safe now |
| `app/models/bot_session.py` (15 lines) | SQLAlchemy model, DB never used | **High** | ✅ Yes — safe now |
| `app/models/__init__.py` | Imports dead model | **High** | ✅ Yes — safe now |
| `app/schemas/bot_session.py` (24 lines) | Only imported by dead `endpoints.py` | **High** | ✅ Yes — safe now |
| `app/schemas/__init__.py` | Imports dead schemas | **High** | ✅ Yes — safe now |
| `parse_instruction()` in main.py (lines 66-125) | Old keyword-based auto-reply. Replaced by LLM-based `check_auto_reply_with_llm()`. Still called but result (`auto_rule`) is stored and never read. | **High** | ⚠️ Remove carefully — still called at deploy |
| `data/users.json` | User management system not integrated | **Medium** | ⚠️ Later — may be planned |
| `user_profiles/` dir | Chrome profiles for auth, partially used | **Medium** | ⚠️ Later |
| `backend/Dockerfile` | Uses Python 3.11, not matching local 3.14. Not actively used. | **Low** | ⚠️ Keep for future |
| `test_vision.py` (project root) | Test script | **Medium** | ✅ Yes — safe now |
| `test_out.txt` (project root) | Test output | **High** | ✅ Yes — safe now |
| `scratch/` (project root) | Scratch dir | **Low** | ⚠️ Check contents first |
| `requirements.txt` entries: `torch`, `silero-vad`, `soundfile`, `numpy` | Not imported anywhere in current backend code | **Medium** | ⚠️ May be used by bot-service |
| Route `/bot/{bot_id}/recording` (alias) | Duplicate of `/audio-files` | **High** | ✅ Remove alias |
| Route `/bot/{bot_id}/end` (alias) | Duplicate of `/stop` | **High** | ✅ Remove alias |
| Route `GET /bot/{bot_id}/summary` | Never called by frontend | **Medium** | ⚠️ Keep — useful API |
| Route `POST /bot/{bot_id}/transcribe-audio` | Never called | **Medium** | ⚠️ Keep — useful for manual trigger |
| Route `POST /bot/{bot_id}/preprocess-audio` | Never called | **Medium** | ⚠️ Keep — useful for manual trigger |
| Route `GET /bot/{bot_id}/audio-processing-status` | Never called | **Medium** | ⚠️ Keep |
| Route `GET /bot/{bot_id}/visual-status` | Never called, overlaps with `/screenshots` | **High** | ⚠️ Consider merging |

---

## 11. Priority Fix List

### 🔴 Critical Before Demo

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | **Rotate Groq API key** — current key is exposed in git history | `.env` + Groq dashboard | 5 min |
| 2 | **Add `.env` to `.gitignore`** (verify it's there) | `.gitignore` | 1 min |
| 3 | **Unify memory save logic** — auto-save missing `meeting_title`, `audio_chunks`, `user_name`, `alerts` | main.py:340-369 | 15 min |
| 4 | **Remove hardcoded `C:\Users\Swapnil\...` paths** in ffmpeg fallback | audio_preprocess_service.py:26-27 | 5 min |

### 🟡 Important Soon

| # | Fix | File | Effort |
|---|-----|------|--------|
| 5 | Delete `ocr_service.py` — pure dead code, imports unavailable packages | services/ | 1 min |
| 6 | Delete unused `api/endpoints.py`, `core/database.py`, `models/`, `schemas/` | Multiple | 5 min |
| 7 | Add auto-reply rate limiting (max 1 LLM call per 10 seconds per bot) | main.py | 10 min |
| 8 | Set `max_tokens` on vision API calls | vision_service.py | 2 min |
| 9 | Remove dual-path route aliases (`/recording`, `/end`) | main.py | 2 min |
| 10 | Fix transcript format in memory (ensure `timestamp_str` is saved) | main.py | 10 min |

### 🟢 Later Cleanup

| # | Fix | File | Effort |
|---|-----|------|--------|
| 11 | Extract `run_bot_process()` into a proper service file | main.py → new service | 30 min |
| 12 | Extract route definitions from `main.py` into `api/routes/` using APIRouter | main.py | 45 min |
| 13 | Remove `parse_instruction()` and `auto_rule` storage (fully replaced by LLM) | main.py | 10 min |
| 14 | Add recording/screenshot cleanup for old sessions | New utility | 20 min |
| 15 | Add persistent session storage (SQLite or JSON) to survive restarts | Architecture change | 2 hrs |
| 16 | Remove `verify=False` SSL bypass and fix cert properly | transcription_service.py | 15 min |
| 17 | Centralize `RECORDINGS_DIR` definition (currently in 2 files) | Config module | 10 min |
| 18 | Add input truncation for very long chat/transcript before summary | summary_service.py | 15 min |

---

## 12. Do-Not-Touch List

> [!IMPORTANT]
> These areas are **working correctly** and should NOT be refactored before the deadline:

| Area | Reason |
|------|--------|
| `run_bot_process()` stdout parsing | Complex but battle-tested — handles STATUS/CHAT_MESSAGE/VISUAL/ERROR lines correctly |
| `check_auto_reply()` + `check_auto_reply_with_llm()` flow | Working LLM auto-reply chain with dedup protection |
| `check_name_mention()` | Simple and correct |
| Bot-service subprocess launch | Working with venv detection fallback |
| `meeting_memory_service.py` search logic | Clean, well-tested keyword search with filters |
| `transcription_service.py` hallucination filtering | Effective blocklist, don't expand without testing |
| Frontend polling logic in `App.tsx` | Stable 3s interval with proper state separation |
| `DeployForm.tsx` InputField placement | **Critical** — must stay OUTSIDE component to prevent focus loss |
| All frontend component files | Just redesigned — do not touch |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total backend Python files | 10 |
| Dead/unused files | 6 (endpoints.py, database.py, ocr_service.py, models/, schemas/) |
| Total routes defined | 24 |
| Routes never called by frontend | 8 |
| Groq API call sites | 4 |
| Hardcoded user paths | 4 occurrences |
| Critical security issues | 2 (API key in git, CORS wildcard) |
| Memory save field mismatches | 4 fields |
| Lines of dead code | ~500+ |
