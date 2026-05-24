"""
Centralized path and directory configuration.
All path references should come from this module.
"""
import os

# Project root: backend/
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Bot-service recordings directory
RECORDINGS_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "..", "bot-service", "recordings"))
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# Cleaned audio directory
CLEANED_DIR = os.path.join(RECORDINGS_DIR, "cleaned")
os.makedirs(CLEANED_DIR, exist_ok=True)
