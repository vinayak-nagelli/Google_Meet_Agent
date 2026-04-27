import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    user_data_dir = os.path.join(os.getcwd(), "bot_profile")
    print("=========================================")
    print("🤖 BOT LOGIN SETUP")
    print("=========================================")
    print("1. A browser window will open.")
    print("2. Please log in to a Google Account (create a dummy one if you want).")
    print("3. Once logged in successfully, simply CLOSE the browser window.")
    print("=========================================")
    
    async with async_playwright() as p:
        try:
            # We use channel="chrome" to use the real Chrome browser
            # This bypasses Google's "This browser is not secure" block
            context = await p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=False,
                channel="chrome",
                args=["--disable-blink-features=AutomationControlled"]
            )
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto("https://accounts.google.com")
            
            # Wait for user to manually close the browser
            await page.wait_for_event("close", timeout=0)
            print("✅ Profile saved successfully! Your bot is now authenticated.")
        except Exception as e:
            print(f"Error: {e}")
            print("Note: Make sure Google Chrome is installed on this computer.")

if __name__ == "__main__":
    asyncio.run(main())
