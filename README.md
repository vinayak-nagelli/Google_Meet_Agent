# 🤖 MeetClone - Advanced AI Meeting Agent

MeetClone is a powerful, self-hosted AI assistant that joins your Google Meet sessions to record, transcribe, translate, and summarize your meetings with professional-grade intelligence.

---

## ✨ Key Features

### 🎙️ Audio Intelligence (Milestone 11)
- **High-Fidelity Recording**: Captures meeting audio in 5-minute chunks using high-quality system loopback.
- **Smart Preprocessing**: Automatically cleans audio using `ffmpeg` (loudness normalization + noise filtering) for perfect transcription.
- **English Translation**: Spoken Telugu, Hindi, and other languages are automatically translated into English text via Groq Whisper.
- **Audio Name Mentions**: Real-time alerts if your name is mentioned in spoken audio.

### 🧠 AI Summarization (Milestone 9)
- **Structured Reports**: Generates deep insights using Llama 3.3, including Key Points, Decisions, Action Items, and Deadlines.
- **Participant Analysis**: Tracks who said what, how many messages they sent, and their specific contributions.
- **Consolidated Intelligence**: Combines both spoken audio transcripts and typed chat messages into one master report.

### 💬 Chat Automation (Milestone 8)
- **Context-Aware Auto-Reply**: The bot can reply to questions autonomously using your personal instructions and persona context.
- **Live Monitoring**: Real-time scraping of meeting chat displayed on your dashboard.
- **Remote Outbox**: Send messages to the Google Meet chat directly from the web dashboard.

### 🎨 Modern Dashboard
- **Glassmorphism UI**: A premium, responsive React interface with live status polling.
- **Interactive Playback**: Listen to meeting audio chunks directly in the browser.
- **Live Alert System**: Visual notifications for name mentions and AI actions.

---

## 🛠️ Technology Stack
- **Frontend**: React + Vite + Vanilla CSS
- **Backend**: FastAPI (Python)
- **Bot Service**: Playwright + Python Soundcard/Soundfile
- **AI Engine**: Groq API (Whisper-v3 + Llama-3.3)
- **Processing**: FFmpeg

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **FFmpeg** (Auto-detected on Windows if installed via `winget install Gyan.FFmpeg`)
- **Groq API Key** (Get one at [console.groq.com](https://console.groq.com))

### 2. Configuration
Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=your_key_here
```

### 3. Installation & Run
**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## ⚖️ Ethical Note
This bot is designed for transparency. It identifies itself in meetings and should only be used where consent for recording/transcription has been established.

## 📝 License
This project is for educational and personal productivity use.
