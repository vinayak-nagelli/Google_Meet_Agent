"""
MeetAgent — Backend Entry Point

This is the slim application shell. All routes are in app/api/routes/.
All shared state is in app/storage/in_memory_store.py.
All business logic is in app/services/.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.core.config import RECORDINGS_DIR
from app.api.router import api_router

load_dotenv()

app = FastAPI(title="MeetAgent API")

# ── Static file serving ──────────────────────────────────────────────────────
app.mount("/recordings", StaticFiles(directory=RECORDINGS_DIR), name="recordings")

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include all API routes ───────────────────────────────────────────────────
app.include_router(api_router)
