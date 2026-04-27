# MeetClone - Personal Meeting Agent

This is the MVP-1 for the Personal Meeting Agent project. 

## Project Vision
An AI bot that joins Google Meet on behalf of the user, listens to the meeting, captures decisions/action items/deadlines, and generates a structured report after the meeting. 
*(Note: MVP-1 focuses only on orchestrating the bot presence, not audio/transcription/AI yet).*

## MVP-1 Scope
- [x] Monorepo structure setup.
- [x] FastAPI backend with Bot Session database schemas.
- [x] Playwright Python bot-service that launches Chromium and opens a Google Meet link.
- [x] React + TypeScript + Tailwind frontend to deploy and track the bot.
- [x] Docker Compose setup to run everything easily.

**What is NOT included yet:**
- Speech-to-text (Whisper/Deepgram)
- AI summarization (LLM)
- Notion/Jira/Slack integrations
- Mobile Application
- Auto-responses in meeting chat

## Prerequisites
- Docker & Docker Compose
- (Optional) Python 3.11+ and Node 18+ if running locally without Docker.

## Setup & Run via Docker (Recommended)
1. Ensure Docker Desktop is running.
2. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
3. Open `http://localhost:5173` to access the React Dashboard.
4. Open `http://localhost:8000/docs` to access the FastAPI Swagger UI.

## Ethical Note
The bot is designed to be honest. It must explicitly identify itself (e.g., "Meeting Assistant") when joining calls. It should only be used in meetings where recording/transcription is acceptable and with the consent of the participants.

## Known Limitations
Google Meet UI updates frequently. The Playwright selectors for dismissing camera/mic and clicking the "Join" button may need occasional updates if Google changes their DOM structure.
