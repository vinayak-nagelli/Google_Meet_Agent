"""
Bot-service configuration and constants.
All paths, timeouts, and selectors in one place.
"""
import os

# ── Paths ─────────────────────────────────────────────────────────────────────
BOT_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
RECORDINGS_DIR = os.path.join(BOT_SERVICE_DIR, "recordings")
BOT_PROFILE_DIR = os.path.join(BOT_SERVICE_DIR, "bot_profile")

# ── Audio ─────────────────────────────────────────────────────────────────────
AUDIO_SAMPLE_RATE = 16000       # 16kHz mono — fits Groq Whisper 25MB limit
AUDIO_CHUNK_SECONDS = 30        # 30 seconds per chunk for live transcription

# ── Screenshots ───────────────────────────────────────────────────────────────
SCREENSHOT_INTERVAL_SECONDS = 15
SCREENSHOT_DIFF_THRESHOLD = 300  # MSE threshold for significant slide change
SCREENSHOT_QUALITY = 85          # JPEG quality — higher = better for Groq Vision extraction

# ── Monitoring ────────────────────────────────────────────────────────────────
MONITOR_LOOP_ITERATIONS = 1200   # 1200 × 3s = 60 minutes max
MONITOR_POLL_INTERVAL = 3        # seconds between each loop iteration

# ── Chat ──────────────────────────────────────────────────────────────────────
CHAT_BUTTON_SELECTORS = [
    'button[aria-label*="chat" i]',
    'button[aria-label*="Chat with everyone" i]',
    'button[aria-label*="Open chat" i]',
    'button[aria-label*="show everyone" i]',
    'button[aria-label*="Message" i]',
    '[data-tooltip*="chat" i]',
]

CHAT_INPUT_SELECTORS = (
    'textarea[aria-label*="message" i], '
    'input[aria-label*="message" i], '
    '[contenteditable="true"][aria-label*="message" i]'
)

IGNORED_CHAT_STRINGS = [
    "hover over a message to pin it",
    "continuous chat is turned off",
    "messages will not be saved",
    "let participants send messages",
    "send a message",
    "in-call messages",
    "pin it",
]
