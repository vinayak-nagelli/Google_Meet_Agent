"""
Audio Recorder — captures system audio via loopback device.
Saves 30-second WAV chunks at 16kHz mono for Groq Whisper.
"""
import os
import time
import threading
import soundcard as sc
import soundfile as sf

from config import RECORDINGS_DIR, AUDIO_SAMPLE_RATE, AUDIO_CHUNK_SECONDS
from status_logger import log_status


class AudioRecorder:
    def __init__(self, bot_id: str):
        self.bot_id = bot_id
        self.is_recording = False
        self.thread = None

    def start(self):
        self.is_recording = True
        self.thread = threading.Thread(target=self._record_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_recording = False
        if self.thread:
            self.thread.join(timeout=2)

    def _record_loop(self):
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        chunk_index = 1

        try:
            # Get first available loopback (captures system speaker output)
            loopbacks = [m for m in sc.all_microphones(include_loopback=True) if m.isloopback]
            if not loopbacks:
                raise RuntimeError("No loopback device found. Cannot record system audio.")
            mic = loopbacks[0]

            with mic.recorder(samplerate=AUDIO_SAMPLE_RATE, channels=1) as recorder:
                while self.is_recording:
                    filename = os.path.join(
                        RECORDINGS_DIR,
                        f"{self.bot_id}_{int(time.time())}_part{chunk_index}.wav"
                    )
                    log_status(f"recording_started|{filename}")

                    frames_recorded = 0
                    frames_per_chunk = AUDIO_SAMPLE_RATE * AUDIO_CHUNK_SECONDS

                    with sf.SoundFile(filename, mode='w', samplerate=AUDIO_SAMPLE_RATE, channels=1) as file:
                        while self.is_recording and frames_recorded < frames_per_chunk:
                            frames_to_record = int(AUDIO_SAMPLE_RATE * 0.5)
                            data = recorder.record(numframes=frames_to_record)
                            file.write(data)
                            frames_recorded += frames_to_record

                    log_status(f"chunk_saved|{filename}")
                    chunk_index += 1

        except Exception as e:
            log_status(f"recording_failed|{e}")
        finally:
            log_status("recording_stopped")
