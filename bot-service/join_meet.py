import asyncio
from playwright.async_api import async_playwright
import sys

async def main(meet_link: str):
    print("Launching browser")
    async with async_playwright() as p:
        # Launch non-headless so you can see it
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print(f"Opening meet link: {meet_link}")
        await page.goto(meet_link)
        
        print("Reached meet page")
        
        # Keep open for 10 seconds to observe
        await asyncio.sleep(10)
        
        await browser.close()

if __name__ == "__main__":
    # Default link if none provided
    link = "https://meet.google.com/abc-defg-hij"
    if len(sys.argv) > 1:
        link = sys.argv[1]
    asyncio.run(main(link))
