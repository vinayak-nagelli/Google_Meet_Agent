"""
Message sender — polls backend for pending outbound messages
and types them into the Google Meet chat input.
"""
import asyncio
import json
import urllib.request
from datetime import datetime

from config import CHAT_INPUT_SELECTORS
from status_logger import log_status, log_error, log_chat_message


async def send_pending_messages(page, bot_id: str, backend_url: str):
    """Poll backend for outbound messages and type them into Meet chat."""
    try:
        url = f"{backend_url}/bot/{bot_id}/pending-messages"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        messages = data.get("messages", [])
        for msg in messages:
            try:
                chat_input = await page.wait_for_selector(
                    CHAT_INPUT_SELECTORS,
                    timeout=5000, state="visible"
                )
                if chat_input:
                    await chat_input.click()
                    await chat_input.fill(msg)
                    await page.wait_for_timeout(300)
                    await page.keyboard.press("Enter")
                    await page.wait_for_timeout(500)
                    log_status("message_sent")
                    await asyncio.sleep(0.5)
                    log_status("monitoring_chat")
                    log_chat_message("You via Bot", msg, datetime.now().strftime("%H:%M:%S"))
            except Exception as e:
                log_error(f"Failed to send message: {e}")
    except Exception:
        pass  # Backend not reachable or no messages — silently skip
