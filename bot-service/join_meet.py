import asyncio
from playwright.async_api import async_playwright
import sys
import os
import urllib.request
import json
from datetime import datetime
import threading
import time
import soundcard as sc
import soundfile as sf
import numpy as np
from PIL import Image
import io

def compute_image_difference(bytesA: bytes, bytesB: bytes) -> float:
    try:
        imgA = Image.open(io.BytesIO(bytesA)).convert('L').resize((64, 64))
        imgB = Image.open(io.BytesIO(bytesB)).convert('L').resize((64, 64))
        arrA = np.array(imgA, dtype=float)
        arrB = np.array(imgB, dtype=float)
        mse = np.mean((arrA - arrB) ** 2)
        return mse
    except Exception as e:
        print(f"ERROR: Image diff failed: {e}", flush=True)
        return 99999

class AudioRecorder:
    def __init__(self, bot_id: str):
        self.bot_id = bot_id
        self.is_recording = False
        self.thread = None
        self.chunk_seconds = 30 # 30 seconds per chunk for live updates

    def start(self):
        self.is_recording = True
        self.thread = threading.Thread(target=self._record_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_recording = False
        if self.thread:
            self.thread.join(timeout=2)

    def _record_loop(self):
        record_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "recordings"))
        os.makedirs(record_dir, exist_ok=True)
        # Whisper uses 16000 Hz internally. Using 16000 Hz Mono reduces 5 min WAV from 52MB to 9.6MB (Fits under Groq 25MB limit).
        sample_rate = 16000
        chunk_index = 1
        
        try:
            # Get the first available loopback microphone (which captures system speaker output)
            loopbacks = [m for m in sc.all_microphones(include_loopback=True) if m.isloopback]
            if not loopbacks:
                raise RuntimeError("No loopback device found. Cannot record system audio.")
            mic = loopbacks[0]
            
            with mic.recorder(samplerate=sample_rate, channels=1) as recorder:
                while self.is_recording:
                    filename = os.path.join(record_dir, f"{self.bot_id}_{int(time.time())}_part{chunk_index}.wav")
                    print(f"STATUS: recording_started|{filename}", flush=True)
                    
                    frames_recorded = 0
                    frames_per_chunk = sample_rate * self.chunk_seconds
                    
                    # Force channels=1 for mono output
                    with sf.SoundFile(filename, mode='w', samplerate=sample_rate, channels=1) as file:
                        while self.is_recording and frames_recorded < frames_per_chunk:
                            # 0.5 second chunks for responsiveness
                            frames_to_record = int(sample_rate * 0.5)
                            data = recorder.record(numframes=frames_to_record)
                            file.write(data)
                            frames_recorded += frames_to_record
                            
                    print(f"STATUS: chunk_saved|{filename}", flush=True)
                    chunk_index += 1
                    
        except Exception as e:
            print(f"STATUS: recording_failed|{e}", flush=True)
        finally:
            print("STATUS: recording_stopped", flush=True)

async def send_pending_messages(page, bot_id: str, backend_url: str):
    """Poll backend for outbound messages and type them into Meet chat."""
    try:
        url = f"{backend_url}/bot/{bot_id}/pending-messages"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        messages = data.get("messages", [])
        for msg in messages:
            try:
                # Find the chat input box
                chat_input = await page.wait_for_selector(
                    'textarea[aria-label*="message" i], input[aria-label*="message" i], [contenteditable="true"][aria-label*="message" i]',
                    timeout=5000, state="visible"
                )
                if chat_input:
                    await chat_input.click()
                    await chat_input.fill(msg)
                    await page.wait_for_timeout(300)
                    await page.keyboard.press("Enter")
                    await page.wait_for_timeout(500)
                    print(f"STATUS: message_sent", flush=True)
                    await asyncio.sleep(0.5)
                    print(f"STATUS: monitoring_chat", flush=True)  # Revert so reply box stays visible
                    print(f"CHAT_MESSAGE: You via Bot | {msg} | {datetime.now().strftime('%H:%M:%S')}", flush=True)
            except Exception as e:
                print(f"ERROR: Failed to send message: {e}", flush=True)
    except Exception:
        pass  # Backend not reachable or no messages — silently skip


async def main(meet_link: str, bot_name: str, bot_id: str, backend_url: str):
    print("STATUS: launching", flush=True)
    user_data_dir = os.path.join(os.getcwd(), "bot_profile")

    try:
        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=False,
                channel="chrome",
                args=[
                    "--use-fake-ui-for-media-stream",
                    "--use-fake-device-for-media-stream",
                    "--disable-blink-features=AutomationControlled"
                ],
                permissions=["camera", "microphone"]
            )
            page = context.pages[0] if context.pages else await context.new_page()

            print("STATUS: opened_meet", flush=True)
            try:
                await page.goto(meet_link, wait_until="networkidle", timeout=30000)
            except Exception:
                print("STATUS: failed", flush=True)
                print("ERROR: Failed to load Meet page", flush=True)
                await context.close()
                return

            print("STATUS: configuring_device", flush=True)

            # Fill name if asked
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

            # Disable mic
            try:
                btn = await page.wait_for_selector('button[aria-label*="microphone" i]', timeout=5000)
                if btn:
                    lbl = await btn.get_attribute("aria-label")
                    if lbl and "turn off" in lbl.lower():
                        await btn.click()
                    await page.wait_for_timeout(500)
            except Exception:
                await page.keyboard.press("Control+d")

            # Disable camera
            try:
                btn = await page.wait_for_selector('button[aria-label*="camera" i]', timeout=5000)
                if btn:
                    lbl = await btn.get_attribute("aria-label")
                    if lbl and "turn off" in lbl.lower():
                        await btn.click()
                    await page.wait_for_timeout(500)
            except Exception:
                await page.keyboard.press("Control+e")

            # Find join button
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
                print("STATUS: failed", flush=True)
                print("ERROR: Could not find Join button within 30 seconds", flush=True)
                await context.close()
                return

            print("STATUS: joining", flush=True)
            await join_btn.click()

            if join_type == "ask_to_join":
                print("STATUS: waiting_for_host_approval", flush=True)
                try:
                    await page.wait_for_selector('button[aria-label*="Leave call" i]', timeout=300000)
                    print("STATUS: joined", flush=True)
                except Exception:
                    print("STATUS: failed", flush=True)
                    print("ERROR: Timed out waiting for host approval", flush=True)
                    await context.close()
                    return
            else:
                try:
                    await page.wait_for_selector('button[aria-label*="Leave call" i]', timeout=30000)
                    print("STATUS: joined", flush=True)
                except Exception:
                    print("STATUS: failed", flush=True)
                    print("ERROR: Failed to confirm meeting entry", flush=True)
                    await context.close()
                    return

            # Extra pass: ensure mic and camera are OFF after joining
            await page.wait_for_timeout(1500)
            for aria in ['button[aria-label*="Turn off microphone" i]', 'button[aria-label*="Turn off camera" i]']:
                try:
                    btn = page.locator(aria)
                    if await btn.count() > 0 and await btn.first.is_visible():
                        await btn.first.click()
                        await page.wait_for_timeout(500)
                except Exception:
                    pass

            # ── Start Audio Recording ──────────────────────────────────────
            recorder = AudioRecorder(bot_id)
            recorder.start()

            # ── Open Chat Panel ───────────────────────────────────────────
            await asyncio.sleep(3)
            chat_opened = False
            chat_selectors = [
                'button[aria-label*="chat" i]',
                'button[aria-label*="Chat with everyone" i]',
                'button[aria-label*="Open chat" i]',
                'button[aria-label*="show everyone" i]',
                'button[aria-label*="Message" i]',
                '[data-tooltip*="chat" i]',
            ]
            for sel in chat_selectors:
                try:
                    chat_btn = await page.wait_for_selector(sel, timeout=3000, state="visible")
                    if chat_btn:
                        await chat_btn.click()
                        await page.wait_for_timeout(1500)
                        chat_opened = True
                        print("STATUS: monitoring_chat", flush=True)
                        break
                except Exception:
                    continue

            if not chat_opened:
                try:
                    await page.keyboard.press("Control+Alt+c")
                    await page.wait_for_timeout(2000)
                    chat_opened = True
                    print("STATUS: monitoring_chat", flush=True)
                except Exception:
                    pass

            if not chat_opened:
                print("ERROR: Could not open chat panel — chat monitoring disabled", flush=True)

            seen_messages = set()
            IGNORED_STRINGS = [
                "hover over a message to pin it",
                "continuous chat is turned off",
                "messages will not be saved",
                "let participants send messages",
                "send a message",
                "in-call messages",
                "pin it",
            ]

            # ── Presentation Tracking Setup ──────────
            last_presentation_state = False
            last_screenshot_bytes = None
            last_screenshot_time = 0
            screenshots_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "recordings", "screenshots", bot_id))

            # ── Combined chat monitoring + outbound message loop ──────────
            # Increased loop duration to handle longer meetings (e.g. 60 mins)
            # Will automatically break if user clicks "End Meeting" in UI
            for _ in range(1200):  
                # 1. Check if backend says we should stop
                try:
                    url = f"{backend_url}/bot/status/{bot_id}"
                    with urllib.request.urlopen(url, timeout=2) as resp:
                        data = json.loads(resp.read().decode())
                        if data.get("status") == "stopped":
                            print("STATUS: stopping_gracefully", flush=True)
                            break
                except Exception:
                    pass

                # 2. Check for incoming chat messages
                try:
                    els = await page.query_selector_all('[class*="message"], [data-message-id]')
                    for el in els:
                        try:
                            text = (await el.inner_text()).strip()
                            if not text or text in seen_messages:
                                continue
                            if any(ig in text.lower() for ig in IGNORED_STRINGS):
                                continue
                            seen_messages.add(text)
                            lines = [l for l in text.split("\n") if l.strip()]
                            sender = lines[0] if lines else "Unknown"
                            message = lines[1] if len(lines) > 1 else text
                            ts = datetime.now().strftime("%H:%M:%S")
                            print(f"CHAT_MESSAGE: {sender} | {message} | {ts}", flush=True)
                        except Exception:
                            continue
                except Exception:
                    pass

                # 3. Check for outbound messages queued by user
                await send_pending_messages(page, bot_id, backend_url)

                # 4. Check for Presentation and Screenshot
                try:
                    is_presenting = False
                    # Look for elements that suggest presenting
                    presentation_els = await page.query_selector_all('[aria-label*="presentation" i], [aria-label*="presenting" i]')
                    text_el = await page.query_selector("text=/is presenting/i")
                    if len(presentation_els) > 0 or text_el:
                        is_presenting = True

                    if is_presenting != last_presentation_state:
                        status_str = "presentation_started" if is_presenting else "presentation_ended"
                        print(f"STATUS: {status_str}", flush=True)
                        last_presentation_state = is_presenting

                    if is_presenting:
                        current_time = time.time()
                        # Capture at most once every 15 seconds
                        if current_time - last_screenshot_time > 15:
                            screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
                            
                            diff_score = 99999
                            if last_screenshot_bytes:
                                diff_score = compute_image_difference(screenshot_bytes, last_screenshot_bytes)
                            
                            # Threshold for significant slide/content change
                            if diff_score > 300:
                                os.makedirs(screenshots_dir, exist_ok=True)
                                timestamp = int(current_time)
                                filename = f"{bot_id}_slide_{timestamp}.jpg"
                                filepath = os.path.join(screenshots_dir, filename)
                                with open(filepath, "wb") as f:
                                    f.write(screenshot_bytes)
                                
                                print(f"VISUAL: captured_slide|{filename}|{diff_score:.2f}", flush=True)
                            
                            # Update state so we don't spam screenshots
                            last_screenshot_bytes = screenshot_bytes
                            last_screenshot_time = current_time
                except Exception as e:
                    pass

                await asyncio.sleep(3)

            recorder.stop()
            await context.close()
            print("STATUS: stopped", flush=True)

    except Exception as e:
        print("STATUS: failed", flush=True)
        print(f"ERROR: {str(e)}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("STATUS: failed", flush=True)
        print("ERROR: Missing arguments. Provide LINK, NAME, BOT_ID, BACKEND_URL.", flush=True)
        sys.exit(1)

    link = sys.argv[1]
    name = sys.argv[2]
    bid = sys.argv[3] if len(sys.argv) > 3 else "0"
    burl = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:8000"

    asyncio.run(main(link, name, bid, burl))
