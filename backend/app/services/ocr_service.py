import os
import cv2
import numpy as np
import pytesseract
import re
from typing import List, Dict, Any
from datetime import datetime
from difflib import SequenceMatcher

def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

def preprocess_image_for_ocr(input_path: str, output_path: str) -> bool:
    try:
        img = cv2.imread(input_path)
        if img is None:
            return False
            
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Increase contrast to make text pop out more
        alpha = 1.5
        beta = 0
        contrast = cv2.convertScaleAbs(gray, alpha=alpha, beta=beta)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, contrast)
        return True
    except Exception as e:
        print(f"Error preprocessing image {input_path}: {e}")
        return False

def extract_artifacts_from_text(text: str, screenshot_path: str, captured_at: str) -> List[Dict]:
    artifacts = []
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return artifacts
        
    # Slide Title: Usually the first non-empty line
    artifacts.append({
        "type": "slide_title",
        "value": lines[0],
        "source_screenshot": screenshot_path,
        "captured_at": captured_at
    })
    
    # URLs
    url_pattern = re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+')
    for url in url_pattern.findall(text):
        artifacts.append({
            "type": "url",
            "value": url,
            "source_screenshot": screenshot_path,
            "captured_at": captured_at
        })
        
    # Emails
    email_pattern = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
    for email in email_pattern.findall(text):
        artifacts.append({
            "type": "email",
            "value": email,
            "source_screenshot": screenshot_path,
            "captured_at": captured_at
        })
        
    # Bullet points (Add OCR misreads for bullets like « and ¢)
    for line in lines:
        if line.startswith('•') or line.startswith('-') or line.startswith('*') or line.startswith('«') or line.startswith('¢') or line.startswith('»'):
            # Only keep reasonable length bullets
            val = line[1:].strip()
            if 5 < len(val) < 200:
                artifacts.append({
                    "type": "bullet_point",
                    "value": val,
                    "source_screenshot": screenshot_path,
                    "captured_at": captured_at
                })
                
    # Dates/Deadlines (simple regex for formats like YYYY-MM-DD or MM/DD/YYYY)
    date_pattern = re.compile(r'\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b')
    for date_str in date_pattern.findall(text):
        artifacts.append({
            "type": "date",
            "value": date_str,
            "source_screenshot": screenshot_path,
            "captured_at": captured_at
        })
        
    # File names (e.g. report.pdf, index.html)
    file_pattern = re.compile(r'\b[\w-]+\.(?:pdf|docx|xlsx|pptx|html|py|ts|js|json|md)\b', re.IGNORECASE)
    for filename in file_pattern.findall(text):
        artifacts.append({
            "type": "file_name",
            "value": filename,
            "source_screenshot": screenshot_path,
            "captured_at": captured_at
        })
        
    return artifacts

def process_bot_screenshots(bot_id: int, screenshots_meta: List[Dict]) -> Dict:
    # Set tesseract path for windows if common
    if os.name == 'nt':
        common_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            r'C:\Users\Swapnil\AppData\Local\Programs\Tesseract-OCR\tesseract.exe'
        ]
        for p in common_paths:
            if os.path.exists(p):
                pytesseract.pytesseract.tesseract_cmd = p
                break
                
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "bot-service", "recordings", "screenshots", str(bot_id)))
    ocr_dir = os.path.join(base_dir, "ocr")
    os.makedirs(ocr_dir, exist_ok=True)
    
    results = []
    all_artifacts = []
    seen_texts = []
    
    for shot in screenshots_meta:
        filename = shot["filename"]
        input_path = os.path.join(base_dir, filename)
        preprocessed_path = os.path.join(ocr_dir, f"prep_{filename}")
        
        if not os.path.exists(input_path):
            continue
            
        success = preprocess_image_for_ocr(input_path, preprocessed_path)
        img_path_for_ocr = preprocessed_path if success else input_path
        
        try:
            text = pytesseract.image_to_string(img_path_for_ocr)
        except pytesseract.TesseractNotFoundError:
            return {
                "status": "failed",
                "error": "Tesseract OCR is not installed. Please install Tesseract-OCR and ensure it is in your PATH.",
                "ocr_results": [],
                "visual_artifacts": []
            }
        except Exception as e:
            text = ""
            
        text = text.strip()
        if not text or len(text) < 10:
            results.append({
                "screenshot_path": shot["file_path"],
                "filename": filename,
                "captured_at": shot["captured_at"],
                "extracted_text": text,
                "ocr_status": "low_confidence",
                "is_duplicate": False
            })
            continue
            
        # Deduplication
        is_duplicate = False
        for seen in seen_texts:
            if similarity(seen, text) > 0.85:
                is_duplicate = True
                break
                
        if is_duplicate:
            results.append({
                "screenshot_path": shot["file_path"],
                "filename": filename,
                "captured_at": shot["captured_at"],
                "extracted_text": text,
                "ocr_status": "duplicate",
                "is_duplicate": True
            })
            continue
            
        seen_texts.append(text)
        
        artifacts = extract_artifacts_from_text(text, shot["file_path"], shot["captured_at"])
        all_artifacts.extend(artifacts)
        
        results.append({
            "screenshot_path": shot["file_path"],
            "filename": filename,
            "captured_at": shot["captured_at"],
            "extracted_text": text,
            "ocr_status": "success",
            "is_duplicate": False
        })
        
    return {
        "status": "completed",
        "ocr_results": results,
        "visual_artifacts": all_artifacts
    }
