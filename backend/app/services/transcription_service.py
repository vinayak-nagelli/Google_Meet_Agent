"""
Audio Transcription Service
Uses Groq Whisper to transcribe cleaned WAV audio files → English text with timestamps.

No heavy dependencies required beyond openai (Groq SDK).
Hallucination filtering built-in.
"""
import os
import re
from openai import OpenAI
from typing import List, Dict


# ── Hallucination blocklist ───────────────────────────────────────────────────
HALLUCINATION_PATTERNS = [
    r"subtitles by.*amara",
    r"translate everything to english",
    r"transcription by castingwords",
    r"thanks?\s+for\s+watching",
    r"please subscribe",
    r"^\s*\.\s*$",
    r"^\s*you\s*$",
]

def _is_hallucination(text: str) -> bool:
    t = text.lower().strip()
    if len(t) <= 2:
        return True
    return any(re.search(p, t) for p in HALLUCINATION_PATTERNS)


# ── Main transcription function ───────────────────────────────────────────────
def transcribe_audio_file(file_path: str) -> List[Dict]:
    """
    Transcribe a single WAV file using Groq Whisper.
    - Uses translations endpoint → always outputs English regardless of input language.
    - Filters hallucinations.
    - Returns list of {start, end, text} dicts.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is missing from environment variables.")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    if file_size_mb > 24:
        raise ValueError(
            f"Audio file too large ({file_size_mb:.1f} MB). "
            "Groq Whisper supports max 25 MB. "
            "Ensure audio is recorded at 16kHz Mono (the bot now does this automatically)."
        )

    import httpx
    # Using verify=False to bypass SSL: CERTIFICATE_VERIFY_FAILED which often happens in local Windows environments
    http_client = httpx.Client(verify=False)
    client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1", http_client=http_client)

    print(f"  [Transcription] Sending {os.path.basename(file_path)} ({file_size_mb:.2f} MB) to Groq...")

    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        transcription = client.audio.translations.create(
            file=(os.path.basename(file_path), file_bytes),
            model="whisper-large-v3",
            response_format="verbose_json",
        )

        segments = getattr(transcription, "segments", [])
        if not segments and isinstance(transcription, dict):
            segments = transcription.get("segments", [])

        result = []
        for seg in segments:
            if isinstance(seg, dict):
                start = seg.get("start", 0)
                end = seg.get("end", 0)
                text = seg.get("text", "").strip()
            else:
                start = getattr(seg, "start", 0)
                end = getattr(seg, "end", 0)
                text = getattr(seg, "text", "").strip()

            if text and not _is_hallucination(text):
                result.append({"start": start, "end": end, "text": text})

        print(f"  [Transcription] Got {len(result)} clean segments.")
        return result

    except Exception as e:
        print(f"  [Transcription error] {os.path.basename(file_path)}: {e}")
        raise


def transcribe_multiple_files(file_paths: List[str]) -> List[Dict]:
    """
    Transcribe multiple audio files (chunks) in order and merge results
    with correct time offsets.
    """
    all_segments = []
    time_offset = 0.0

    for file_path in file_paths:
        try:
            segments = transcribe_audio_file(file_path)
            for seg in segments:
                all_segments.append({
                    "start": seg["start"] + time_offset,
                    "end": seg["end"] + time_offset,
                    "text": seg["text"],
                })
            # Time offset for next chunk based on last segment end time
            if segments:
                time_offset += segments[-1]["end"]
            else:
                # Estimate from file duration if no segments
                import subprocess
                from app.services.audio_preprocess_service import get_ffprobe_exe
                try:
                    exe = get_ffprobe_exe()
                    r = subprocess.run(
                        [exe, "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=noprint_wrappers=1:nokey=1", file_path],
                        capture_output=True, text=True, timeout=10
                    )
                    time_offset += float(r.stdout.strip() or 0)
                except Exception:
                    pass
        except Exception as e:
            print(f"  [Transcription] Skipping {file_path}: {e}")

    return all_segments


def format_timestamp(seconds: float) -> str:
    """Format seconds as [MM:SS]"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"[{mins:02d}:{secs:02d}]"


def segments_to_text(segments: List[Dict]) -> str:
    """Convert segment list to readable timestamped text."""
    lines = []
    for seg in segments:
        ts = format_timestamp(seg["start"])
        lines.append(f"{ts} {seg['text']}")
    return "\n".join(lines)
