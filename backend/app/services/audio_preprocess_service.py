"""
Milestone 10.5 — Audio Cleaning / Preprocessing Pipeline
Uses ffmpeg to standardize and clean recorded WAV files before transcription.
"""
import os
import subprocess
import shutil
import json
from typing import Dict, List, Optional


# ── Folder Paths ─────────────────────────────────────────────────────────────
RECORDINGS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "bot-service", "recordings")
)
CLEANED_DIR = os.path.join(RECORDINGS_DIR, "cleaned")


def _ensure_dirs():
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    os.makedirs(CLEANED_DIR, exist_ok=True)


# ── ffmpeg availability check ─────────────────────────────────────────────────

def get_ffmpeg_exe():
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    return None

def get_ffprobe_exe():
    if shutil.which("ffprobe"):
        return "ffprobe"
    return None

def check_ffmpeg() -> bool:
    try:
        exe = get_ffmpeg_exe()
        if not exe:
            return False
        result = subprocess.run(
            [exe, "-version"],
            capture_output=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ── Get audio duration via ffprobe ────────────────────────────────────────────
def _get_duration(file_path: str) -> float:
    """Returns duration of audio file in seconds using ffprobe."""
    try:
        exe = get_ffprobe_exe()
        if not exe:
            return 0.0
        result = subprocess.run(
            [
                exe, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path
            ],
            capture_output=True, text=True, timeout=15
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


# ── Core preprocessing function ───────────────────────────────────────────────
def preprocess_audio_file(input_path: str, output_path: str) -> Dict:
    """
    Preprocess a single audio file using ffmpeg:
    - Convert to mono
    - Resample to 16000 Hz
    - Normalize loudness (EBU R128 loudnorm)
    - Apply mild highpass filter (remove low-frequency hum)
    - Output as WAV PCM 16-bit

    Returns a metadata dict.
    """
    if not os.path.isfile(input_path):
        return {"success": False, "error": f"Input file not found: {input_path}"}

    if not check_ffmpeg():
        return {
            "success": False,
            "error": (
                "ffmpeg is not installed or not in PATH. "
                "Install it from https://ffmpeg.org/download.html "
                "and add it to your system PATH."
            )
        }

    size_before = os.path.getsize(input_path)
    duration_before = _get_duration(input_path)

    # Build ffmpeg command
    # speechnorm: Designed specifically for speech normalization
    # highpass: remove low-frequency hum
    exe = get_ffmpeg_exe()
    ffmpeg_cmd = [
        exe,
        "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-af", "highpass=f=80,speechnorm=e=4:p=0.4",
        "-c:a", "pcm_s16le", # Explicitly set codec for WAV
        output_path
    ]

    try:
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True, text=True, timeout=300
        )

        if result.returncode != 0:
            # Try simplified fallback (just convert format, no filters)
            fallback_cmd = [
                exe, "-y",
                "-i", input_path,
                "-ac", "1", "-ar", "16000",
                "-c:a", "pcm_s16le",
                output_path
            ]
            result2 = subprocess.run(
                fallback_cmd, capture_output=True, text=True, timeout=120
            )
            if result2.returncode != 0:
                return {
                    "success": False,
                    "error": f"ffmpeg failed: {result.stderr[-500:]}",
                    "input_path": input_path,
                }

        size_after = os.path.getsize(output_path)
        duration_after = _get_duration(output_path)

        return {
            "success": True,
            "input_path": input_path,
            "output_path": output_path,
            "filename": os.path.basename(output_path),
            "duration_before": round(duration_before, 2),
            "duration_after": round(duration_after, 2),
            "size_before_bytes": size_before,
            "size_after_bytes": size_after,
            "size_before_mb": round(size_before / 1024 / 1024, 2),
            "size_after_mb": round(size_after / 1024 / 1024, 2),
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "ffmpeg timed out during preprocessing."}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Preprocess all chunks for a bot session ───────────────────────────────────
def preprocess_bot_recordings(bot_id: int) -> Dict:
    """
    Find all WAV files for a given bot_id in recordings/, preprocess each one,
    and save cleaned versions to recordings/cleaned/.

    Returns full preprocessing report.
    """
    _ensure_dirs()

    if not check_ffmpeg():
        return {
            "status": "preprocessing_failed",
            "error": (
                "ffmpeg is not installed. "
                "Download from https://ffmpeg.org/download.html, "
                "install, then add to PATH."
            ),
            "original_files": [],
            "cleaned_files": [],
            "logs": [],
        }

    # Find all WAV files for this bot_id (sorted by name = chronological order)
    all_wavs = sorted([
        f for f in os.listdir(RECORDINGS_DIR)
        if f.endswith(".wav") and f.startswith(f"{bot_id}_")
        and "clean" not in f  # skip already-cleaned files
    ])

    import time
    now = time.time()
    valid_wavs = []
    skipped_active = []

    for f in all_wavs:
        path = os.path.join(RECORDINGS_DIR, f)
        # If file was modified in the last 10 seconds, it's likely still being written to by the bot
        if now - os.path.getmtime(path) < 10:
            skipped_active.append(f)
            continue
        valid_wavs.append(f)

    if not valid_wavs:
        msg = f"No complete recordings found for bot {bot_id}."
        if skipped_active:
            msg += f" (Waiting for active recording {skipped_active[0]} to finish)."
        return {
            "status": "preprocessing_failed",
            "error": msg,
            "original_files": [],
            "cleaned_files": [],
            "logs": [],
        }

    logs = []
    cleaned_files = []
    original_files = []

    for wav_file in valid_wavs:
        input_path = os.path.join(RECORDINGS_DIR, wav_file)
        # Output: cleaned/{bot_id}_{timestamp}_part1_clean.wav
        base = wav_file.replace(".wav", "")
        output_filename = f"{base}_clean.wav"
        output_path = os.path.join(CLEANED_DIR, output_filename)

        original_files.append(wav_file)

        log_entry = preprocess_audio_file(input_path, output_path)
        log_entry["source_file"] = wav_file
        log_entry["output_filename"] = output_filename
        logs.append(log_entry)

        if log_entry["success"]:
            cleaned_files.append(f"cleaned/{output_filename}")

    status = "preprocessed" if cleaned_files else "preprocessing_failed"
    return {
        "status": status,
        "bot_id": bot_id,
        "original_files": original_files,
        "cleaned_files": cleaned_files,
        "logs": logs,
        "total_processed": len(cleaned_files),
        "total_failed": len(all_wavs) - len(cleaned_files),
    }


# ── List available audio files for a bot ─────────────────────────────────────
def list_audio_files(bot_id: int) -> Dict:
    """Return lists of original and cleaned files for a bot session."""
    _ensure_dirs()

    original = sorted([
        f for f in os.listdir(RECORDINGS_DIR)
        if f.endswith(".wav") and f.startswith(f"{bot_id}_") and "clean" not in f
    ])

    cleaned_all = []
    if os.path.isdir(CLEANED_DIR):
        cleaned_all = sorted([
            f"cleaned/{f}" for f in os.listdir(CLEANED_DIR)
            if f.endswith(".wav") and f.startswith(f"{bot_id}_")
        ])

    status = "preprocessed" if cleaned_all else ("not_started" if original else "no_recordings")

    return {
        "original_files": original,
        "cleaned_files": cleaned_all,
        "status": status,
    }
