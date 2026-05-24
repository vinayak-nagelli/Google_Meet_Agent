"""
MeetAgent Bot — Main Orchestrator

Launches Chrome, joins Google Meet, monitors chat,
records audio, captures screenshots, and reports status
back to the backend via stdout.

Usage:
    python join_meet.py <meet_link> <bot_name> <bot_id> <backend_url>

IMPORTANT: The backend reads stdout lines with these prefixes:
    STATUS:       → updates bot session status
    CHAT_MESSAGE: → appends to bot chat messages
    VISUAL:       → appends to bot visual status
    ERROR:        → sets error message
Do NOT change these formats.
"""
import asyncio
from playwright.async_api import async_playwright
import sys
import os
import json
import urllib.request
from datetime import datetime
import time

from config import (
    BOT_PROFILE_DIR, RECORDINGS_DIR,
    CHAT_BUTTON_SELECTORS, IGNORED_CHAT_STRINGS,
    SCREENSHOT_INTERVAL_SECONDS, SCREENSHOT_DIFF_THRESHOLD, SCREENSHOT_QUALITY,
    MONITOR_LOOP_ITERATIONS,
)
from status_logger import log_status, log_error, log_chat_message, log_visual
from audio_recorder import AudioRecorder
from image_utils import compute_image_difference
from message_sender import send_pending_messages


async def main(meet_link: str, bot_name: str, bot_id: str, backend_url: str):
    log_status("launching")

    try:
        async with async_playwright() as p:
            # ── Launch Browser ────────────────────────────────────────────
            context = await p.chromium.launch_persistent_context(
                user_data_dir=BOT_PROFILE_DIR,
                headless=False,
                channel="chrome",
                args=[
                    "--use-fake-ui-for-media-stream",
                    "--use-fake-device-for-media-stream",
                    "--disable-blink-features=AutomationControlled",
                    # ── Fix black screenshots ──────────────────────────────
                    # Chrome GPU compositing prevents Playwright from capturing
                    # rendered frames — force software rendering instead.
                    "--disable-gpu",
                    "--disable-gpu-compositing",
                    "--disable-software-rasterizer",
                    "--disable-gpu-sandbox",
                    "--use-gl=swiftshader",
                ],
                permissions=["camera", "microphone"]
            )
            page = context.pages[0] if context.pages else await context.new_page()

            # ── Open Meet Link ────────────────────────────────────────────
            log_status("opened_meet")
            try:
                await page.goto(meet_link, wait_until="networkidle", timeout=30000)
            except Exception:
                log_status("failed")
                log_error("Failed to load Meet page")
                await context.close()
                return

            log_status("configuring_device")

            # ── Fill Name ─────────────────────────────────────────────────
            for selector in ['input[placeholder*="name" i]', 'input[aria-label*="name" i]', 'input[type="text"]']:
                try:
                    el = await page.wait_for_selector(selector, timeout=3000, state="visible")
                    if el:
                        await el.fill(bot_name)
                        await page.wait_for_timeout(500)
                        await page.keyboard.press("Enter")
                        await page.wait_for_timeout(500)
                        break
                except Exception:
                    continue

            # ── Disable Mic ───────────────────────────────────────────────
            try:
                btn = await page.wait_for_selector('button[aria-label*="microphone" i]', timeout=5000)
                if btn:
                    lbl = await btn.get_attribute("aria-label")
                    if lbl and "turn off" in lbl.lower():
                        await btn.click()
                    await page.wait_for_timeout(500)
            except Exception:
                await page.keyboard.press("Control+d")

            # ── Disable Camera ────────────────────────────────────────────
            try:
                btn = await page.wait_for_selector('button[aria-label*="camera" i]', timeout=5000)
                if btn:
                    lbl = await btn.get_attribute("aria-label")
                    if lbl and "turn off" in lbl.lower():
                        await btn.click()
                    await page.wait_for_timeout(500)
            except Exception:
                await page.keyboard.press("Control+e")

            # ── Find & Click Join Button ──────────────────────────────────
            join_btn = None
            join_type = None
            for _ in range(15):
                try:
                    for text, jtype in [("Join now", "join_now"), ("Ask to join", "ask_to_join"), ("Join", "join_now")]:
                        loc = page.locator(f'button:has-text("{text}")')
                        if await loc.count() > 0 and await loc.first.is_visible():
                            join_btn = loc.first
                            join_type = jtype
                            break
                    if join_btn:
                        break
                except Exception:
                    pass
                await page.wait_for_timeout(2000)

            if not join_btn:
                log_status("failed")
                log_error("Could not find Join button within 30 seconds")
                await context.close()
                return

            log_status("joining")
            await join_btn.click()

            # ── Wait for Join Confirmation ────────────────────────────────
            if join_type == "ask_to_join":
                log_status("waiting_for_host_approval")
                try:
                    await page.wait_for_selector('button[aria-label*="Leave call" i]', timeout=300000)
                    log_status("joined")
                except Exception:
                    log_status("failed")
                    log_error("Timed out waiting for host approval")
                    await context.close()
                    return
            else:
                try:
                    await page.wait_for_selector('button[aria-label*="Leave call" i]', timeout=30000)
                    log_status("joined")
                except Exception:
                    log_status("failed")
                    log_error("Failed to confirm meeting entry")
                    await context.close()
                    return

            # ── Post-Join: Ensure Mic/Camera OFF ──────────────────────────
            await page.wait_for_timeout(1500)
            for aria in ['button[aria-label*="Turn off microphone" i]', 'button[aria-label*="Turn off camera" i]']:
                try:
                    btn = page.locator(aria)
                    if await btn.count() > 0 and await btn.first.is_visible():
                        await btn.first.click()
                        await page.wait_for_timeout(500)
                except Exception:
                    pass

            # ── Start Audio Recording ─────────────────────────────────────
            recorder = AudioRecorder(bot_id)
            recorder.start()

            # ── Open Chat Panel ───────────────────────────────────────────
            await asyncio.sleep(3)
            chat_opened = False
            for sel in CHAT_BUTTON_SELECTORS:
                try:
                    chat_btn = await page.wait_for_selector(sel, timeout=3000, state="visible")
                    if chat_btn:
                        await chat_btn.click()
                        await page.wait_for_timeout(1500)
                        chat_opened = True
                        log_status("monitoring_chat")
                        break
                except Exception:
                    continue

            if not chat_opened:
                try:
                    await page.keyboard.press("Control+Alt+c")
                    await page.wait_for_timeout(2000)
                    chat_opened = True
                    log_status("monitoring_chat")
                except Exception:
                    pass

            if not chat_opened:
                log_error("Could not open chat panel — chat monitoring disabled")

            # ── Monitoring State ──────────────────────────────────────────
            seen_messages = set()
            last_presentation_state = False
            last_screenshot_bytes = None
            last_screenshot_time = 0
            screenshots_dir = os.path.join(RECORDINGS_DIR, "screenshots", bot_id)

            # ── Main Monitoring Loop ──────────────────────────────────────
            for _ in range(MONITOR_LOOP_ITERATIONS):

                # 1. Check if backend says stop
                try:
                    url = f"{backend_url}/bot/status/{bot_id}"
                    with urllib.request.urlopen(url, timeout=2) as resp:
                        data = json.loads(resp.read().decode())
                        if data.get("status") == "stopped":
                            log_status("stopping_gracefully")
                            break
                except Exception:
                    pass

                # 2. Scrape chat messages
                try:
                    els = await page.query_selector_all('[class*="message"], [data-message-id]')
                    for el in els:
                        try:
                            text = (await el.inner_text()).strip()
                            if not text or text in seen_messages:
                                continue
                            if any(ig in text.lower() for ig in IGNORED_CHAT_STRINGS):
                                continue
                            seen_messages.add(text)
                            lines = [l for l in text.split("\n") if l.strip()]
                            sender = lines[0] if lines else "Unknown"
                            message = lines[1] if len(lines) > 1 else text
                            ts = datetime.now().strftime("%H:%M:%S")
                            log_chat_message(sender, message, ts)
                        except Exception:
                            continue
                except Exception:
                    pass

                # 3. Send pending outbound messages
                await send_pending_messages(page, bot_id, backend_url)

                # 4. Presentation detection & screenshot capture
                try:
                    is_presenting = False
                    presentation_els = await page.query_selector_all('[aria-label*="presentation" i], [aria-label*="presenting" i]')
                    text_el = await page.query_selector("text=/is presenting/i")
                    if len(presentation_els) > 0 or text_el:
                        is_presenting = True

                    if is_presenting != last_presentation_state:
                        status_str = "presentation_started" if is_presenting else "presentation_ended"
                        log_status(status_str)
                        last_presentation_state = is_presenting

                    if is_presenting:
                        current_time = time.time()
                        if current_time - last_screenshot_time > SCREENSHOT_INTERVAL_SECONDS:
                            screenshot_bytes = await page.screenshot(type="jpeg", quality=SCREENSHOT_QUALITY)

                            diff_score = 99999
                            if last_screenshot_bytes:
                                diff_score = compute_image_difference(screenshot_bytes, last_screenshot_bytes)

                            if diff_score > SCREENSHOT_DIFF_THRESHOLD:
                                os.makedirs(screenshots_dir, exist_ok=True)
                                timestamp = int(current_time)
                                filename = f"{bot_id}_slide_{timestamp}.jpg"
                                filepath = os.path.join(screenshots_dir, filename)
                                with open(filepath, "wb") as f:
                                    f.write(screenshot_bytes)

                                log_visual("captured_slide", filename, f"{diff_score:.2f}")

                            last_screenshot_bytes = screenshot_bytes
                            last_screenshot_time = current_time
                except Exception:
                    pass

                await asyncio.sleep(3)

            # ── Cleanup ───────────────────────────────────────────────────
            recorder.stop()
            await context.close()
            log_status("stopped")

    except Exception as e:
        log_status("failed")
        log_error(str(e))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        log_status("failed")
        log_error("Missing arguments. Provide LINK, NAME, BOT_ID, BACKEND_URL.")
        sys.exit(1)

    link = sys.argv[1]
    name = sys.argv[2]
    bid = sys.argv[3] if len(sys.argv) > 3 else "0"
    burl = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:8000"

    asyncio.run(main(link, name, bid, burl))
