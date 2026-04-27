import asyncio
from playwright.async_api import async_playwright
import sys
import os

async def main(meet_link: str, bot_name: str):
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
            
            # Fill Name if asked
            name_selectors = [
                'input[placeholder*="name" i]',
                'input[aria-label*="name" i]',
                'input[type="text"]'
            ]
            for selector in name_selectors:
                try:
                    name_input = await page.wait_for_selector(selector, timeout=3000, state="visible")
                    if name_input:
                        await name_input.fill(bot_name)
                        await page.wait_for_timeout(500)
                        await page.keyboard.press("Enter")
                        await page.wait_for_timeout(500)
                        break
                except Exception:
                    continue

            # Disable Microphone
            try:
                mic_btn = await page.wait_for_selector('button[aria-label*="microphone" i]', timeout=5000)
                if mic_btn:
                    label = await mic_btn.get_attribute("aria-label")
                    if label and "turn off" in label.lower():
                        await mic_btn.click()
                    await page.wait_for_timeout(500)
            except Exception:
                await page.keyboard.press("Control+d")
                await page.wait_for_timeout(500)

            # Disable Camera
            try:
                cam_btn = await page.wait_for_selector('button[aria-label*="camera" i]', timeout=5000)
                if cam_btn:
                    label = await cam_btn.get_attribute("aria-label")
                    if label and "turn off" in label.lower():
                        await cam_btn.click()
                    await page.wait_for_timeout(500)
            except Exception:
                await page.keyboard.press("Control+e")
                await page.wait_for_timeout(500)

            # Wait for Join Button (up to 30 seconds)
            join_btn = None
            join_type = None
            
            for _ in range(15): # 30 seconds max polling
                try:
                    # Check "Join now"
                    join_now = page.locator('button:has-text("Join now")')
                    if await join_now.count() > 0 and await join_now.first.is_visible():
                        join_btn = join_now.first
                        join_type = "join_now"
                        break
                        
                    # Check "Ask to join"
                    ask_to_join = page.locator('button:has-text("Ask to join")')
                    if await ask_to_join.count() > 0 and await ask_to_join.first.is_visible():
                        join_btn = ask_to_join.first
                        join_type = "ask_to_join"
                        break
                        
                    # Just "Join"
                    join_simple = page.locator('button:has-text("Join")')
                    if await join_simple.count() > 0 and await join_simple.first.is_visible():
                        join_btn = join_simple.first
                        join_type = "join_now"
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
            
            # Handle post-click states
            if join_type == "ask_to_join":
                print("STATUS: waiting_for_host_approval", flush=True)
                try:
                    # Wait for the "Leave call" button which signifies we are inside the meeting
                    await page.wait_for_selector('button[aria-label*="Leave call" i]', timeout=300000) # wait up to 5 mins for host
                    print("STATUS: joined", flush=True)
                except Exception:
                    print("STATUS: failed", flush=True)
                    print("ERROR: Timed out waiting for host approval", flush=True)
                    await context.close()
                    return
            else:
                try:
                    # Wait for the "Leave call" button
                    await page.wait_for_selector('button[aria-label*="Leave call" i]', timeout=30000)
                    print("STATUS: joined", flush=True)
                except Exception:
                    print("STATUS: failed", flush=True)
                    print("ERROR: Failed to confirm meeting entry", flush=True)
                    await context.close()
                    return
            
            # Keep bot alive in the meeting for 5 minutes for testing
            await asyncio.sleep(300)
            
            await context.close()
            print("STATUS: stopped", flush=True)
            
    except Exception as e:
        print("STATUS: failed", flush=True)
        print(f"ERROR: {str(e)}", flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("STATUS: failed", flush=True)
        print("ERROR: Missing arguments. Provide LINK and NAME.", flush=True)
        sys.exit(1)
        
    link = sys.argv[1]
    name = sys.argv[2]
    
    asyncio.run(main(link, name))
