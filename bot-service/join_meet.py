import asyncio
from playwright.async_api import async_playwright
import sys

async def main(meet_link: str, bot_name: str):
    print("STATUS: launching", flush=True)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(
                permissions=["camera", "microphone"]
            )
            page = await context.new_page()
            
            print("STATUS: opened_meet", flush=True)
            await page.goto(meet_link)
            
            print("STATUS: waiting_to_join", flush=True)
            
            # Wait for user observation (15 secs for testing)
            await asyncio.sleep(15)
            
            await browser.close()
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
