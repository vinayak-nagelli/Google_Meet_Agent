import os
import base64
import json
import logging
import re
from typing import List, Dict, Any
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Defaulting to the latest vision model available on Groq in this environment
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

def encode_image_base64(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def extract_json_from_text(text: str) -> Dict:
    try:
        # Sometimes models wrap in ```json ... ```
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        
        # Or just find the first { and last }
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
            
        return json.loads(text)
    except:
        return {
            "slide_title": "Error Parsing JSON",
            "bullet_points": [],
            "visible_dates": [],
            "urls": [],
            "file_names": [],
            "ticket_ids": [],
            "code_or_errors": [],
            "important_visual_notes": [text],
            "uncertain_text": []
        }

def process_vision_screenshots(bot_id: int, screenshots_meta: List[Dict], max_screenshots: int = 15) -> Dict:
    if not GROQ_API_KEY:
        return {"status": "failed", "error": "GROQ_API_KEY is missing. Please add it to your .env file."}
        
    client = Groq(api_key=GROQ_API_KEY)
    
    # Sort screenshots by change score (highest first) to prioritize key slides
    for shot in screenshots_meta:
        try:
            shot["_score"] = float(shot.get("change_score", 0))
        except:
            shot["_score"] = 0.0
            
    # Sort descending
    sorted_shots = sorted(screenshots_meta, key=lambda x: x["_score"], reverse=True)
    
    # Limit to max
    selected_shots = sorted_shots[:max_screenshots]
    skipped_count = len(screenshots_meta) - len(selected_shots)
    
    # Re-sort selected by time (chronological)
    selected_shots = sorted(selected_shots, key=lambda x: x["captured_at"])
    
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "bot-service", "recordings", "screenshots", str(bot_id)))
    
    results = []
    
    for shot in selected_shots:
        input_path = os.path.join(base_dir, shot["filename"])
        if not os.path.exists(input_path):
            continue
            
        base64_image = encode_image_base64(input_path)
        
        prompt = """Analyze this presentation slide or screen share. 
Ignore browser UI clutter and Google Meet controls.
Focus on extracting ALL the actual presentation content exactly as written. Do not summarize, extract the full text.
Return a clean JSON object exactly matching this schema:
{
  "slide_title": "Title of the slide or screen",
  "main_text_blocks": ["Full paragraph text 1", "Full paragraph text 2"],
  "bullet_points": ["Include ALL lists, steps, numbered items, and bullet points here"],
  "visible_dates": ["date 1"],
  "urls": ["https://..."],
  "file_names": ["file.pdf"],
  "ticket_ids": ["JIRA-123"],
  "code_or_errors": ["Error details"],
  "important_visual_notes": ["A pie chart shows 50% growth"],
  "uncertain_text": ["blurry text here"]
}
Do not return any markdown wrapping or extra text. Output exactly and only the JSON object."""

        try:
            response = client.chat.completions.create(
                model=GROQ_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.1
            )
            
            raw_content = response.choices[0].message.content
            parsed_json = extract_json_from_text(raw_content)
            
            results.append({
                "file_path": shot["file_path"],
                "filename": shot["filename"],
                "captured_at": shot["captured_at"],
                "vision_result": parsed_json
            })
            
        except Exception as e:
            logging.error(f"Groq Vision error: {e}")
            results.append({
                "file_path": shot["file_path"],
                "filename": shot["filename"],
                "captured_at": shot["captured_at"],
                "error": str(e)
            })

    return {
        "status": "completed",
        "processed_count": len(results),
        "skipped_count": skipped_count,
        "screenshots": results
    }
