"""
Visual/Screenshot routes: screenshots, vision extraction, visual status.
"""
from fastapi import APIRouter, HTTPException
import threading

from app.storage.in_memory_store import (
    bot_sessions, bot_visual_status, bot_visual_artifacts
)

router = APIRouter()


@router.get("/bot/{bot_id}/visual-status")
def get_visual_status(bot_id: int):
    """Return presentation and screenshot status."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
        
    visual = bot_visual_status.get(bot_id, {"presentation_active": False, "screenshots": []})
    screenshots = visual.get("screenshots", [])
    
    return {
        "bot_id": bot_id,
        "presentation_active": visual.get("presentation_active", False),
        "screenshot_count": len(screenshots),
        "latest_screenshot": screenshots[-1]["captured_at"] if screenshots else None
    }


@router.get("/bot/{bot_id}/screenshots")
def get_screenshots(bot_id: int):
    """Return all captured screenshots."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
        
    visual = bot_visual_status.get(bot_id, {"presentation_active": False, "screenshots": []})
    return {
        "bot_id": bot_id,
        "presentation_active": visual.get("presentation_active", False),
        "screenshots": visual.get("screenshots", [])
    }


@router.post("/bot/{bot_id}/process-visual-content")
async def process_visual_content(bot_id: int):
    """Run Groq Vision on key screenshots."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
        
    visual = bot_visual_status.get(bot_id, {"presentation_active": False, "screenshots": []})
    screenshots = visual.get("screenshots", [])
    
    if not screenshots:
        raise HTTPException(status_code=400, detail="No screenshots available to process")
        
    bot_visual_artifacts.setdefault(bot_id, {"status": "processing"})
    bot_visual_artifacts[bot_id]["status"] = "processing"
    
    def run_vision():
        try:
            from app.services.vision_service import process_vision_screenshots
            result = process_vision_screenshots(bot_id, screenshots)
            bot_visual_artifacts[bot_id] = result
        except Exception as e:
            bot_visual_artifacts[bot_id] = {"status": "failed", "error": str(e)}
            
    threading.Thread(target=run_vision).start()
    return {"status": "processing started", "message": f"Processing screenshots via Groq Vision"}


@router.get("/bot/{bot_id}/visual-content")
def get_visual_content(bot_id: int):
    """Return the Groq Vision results."""
    if bot_id not in bot_sessions:
        raise HTTPException(status_code=404, detail="Bot session not found")
        
    artifacts_data = bot_visual_artifacts.get(bot_id, {"status": "not_started", "processed_count": 0, "screenshots": []})
    return {
        "bot_id": bot_id,
        "status": artifacts_data.get("status", "not_started"),
        "error": artifacts_data.get("error"),
        "processed_count": artifacts_data.get("processed_count", 0),
        "skipped_count": artifacts_data.get("skipped_count", 0),
        "screenshots": artifacts_data.get("screenshots", [])
    }
