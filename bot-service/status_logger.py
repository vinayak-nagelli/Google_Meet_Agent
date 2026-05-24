"""
Status logger — provides helpers for stdout messages
that the backend parses.

WARNING: Do NOT change the prefix formats (STATUS:, ERROR:, CHAT_MESSAGE:, VISUAL:).
The backend's bot_runtime_service.py reads these exact prefixes.
"""


def log_status(status: str):
    """Print a STATUS line. Backend reads this to update bot_sessions."""
    print(f"STATUS: {status}", flush=True)


def log_error(message: str):
    """Print an ERROR line. Backend reads this to set error_message."""
    print(f"ERROR: {message}", flush=True)


def log_chat_message(sender: str, message: str, timestamp: str):
    """Print a CHAT_MESSAGE line. Backend reads this to append to bot_chats."""
    print(f"CHAT_MESSAGE: {sender} | {message} | {timestamp}", flush=True)


def log_visual(event_type: str, filename: str, diff_score: str):
    """Print a VISUAL line. Backend reads this to append to bot_visual_status."""
    print(f"VISUAL: {event_type}|{filename}|{diff_score}", flush=True)
