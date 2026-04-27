import asyncio
from playwright.async_api import async_playwright
import httpx
import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

async def update_status(bot_id: int, status: str, error_message: str = None):
    """Sends a status update back to the backend."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{BACKEND_URL}/bot/status/{bot_id}",
                json={"status": status, "error_message": error_message}
            )
            print(f"Bot {bot_id} status updated to {status}")
    except Exception as e:
        print(f"Failed to update status for bot {bot_id}: {e}")

async def run_bot(bot_id: int, meet_link: str, bot_name: str):
    await update_status(bot_id, "launching")
    
    try:
        async with async_playwright() as p:
            # Launch Chromium with fake media devices to simulate a broken/empty camera and mic
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--use-fake-ui-for-media-stream",
                    "--use-fake-device-for-media-stream"
                ]
            )
            context = await browser.new_context(
                permissions=["camera", "microphone"],
                # Some sites like Google Meet might act differently based on user agent
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            await update_status(bot_id, "opened_meet")
            
            print(f"Bot {bot_id} opening Meet link: {meet_link}")
            await page.goto(meet_link)
            
            # Wait a bit for page to load
            await page.wait_for_timeout(5000)
            
            await update_status(bot_id, "waiting_to_join")

            # Try to turn off mic and camera using keyboard shortcuts
            await page.keyboard.press("Control+e") # Toggle Camera
            await page.wait_for_timeout(1000)
            await page.keyboard.press("Control+d") # Toggle Mic
            await page.wait_for_timeout(1000)

            # Look for the name input field (usually when joining as an unauthenticated guest)
            input_selector = 'input[type="text"], input[placeholder*="name"]'
            
            try:
                # Wait up to 5 seconds for the input field
                await page.wait_for_selector(input_selector, timeout=5000)
                if await page.locator(input_selector).count() > 0:
                    await page.locator(input_selector).first.fill(bot_name)
                    await page.wait_for_timeout(1000)
            except Exception as e:
                print(f"Name input field not found or not required: {e}")
            
            # Look for the Join button
            join_btn_selector = 'button:has-text("Ask to join"), button:has-text("Join now")'
            try:
                if await page.locator(join_btn_selector).count() > 0:
                    await page.locator(join_btn_selector).first.click()
                    print("Clicked join button.")
                else:
                    print("Join button not found, maybe selector changed.")
            except Exception as e:
                 print(f"Failed to click join: {e}")

            await update_status(bot_id, "joined")

            # For MVP, keep the bot in the meeting for 5 minutes then exit
            print(f"Bot {bot_id} is in the meeting. Waiting for 5 minutes...")
            await asyncio.sleep(300) 
            
            await update_status(bot_id, "stopped")
            await browser.close()
            
    except Exception as e:
        print(f"Bot {bot_id} error: {str(e)}")
        await update_status(bot_id, "failed", str(e))
