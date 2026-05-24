"""
Image difference utility for screenshot deduplication.
Uses grayscale MSE to detect significant slide changes.
"""
import numpy as np
from PIL import Image
import io


def compute_image_difference(bytes_a: bytes, bytes_b: bytes) -> float:
    """Compare two screenshot images. Returns MSE — higher = more different."""
    try:
        img_a = Image.open(io.BytesIO(bytes_a)).convert('L').resize((64, 64))
        img_b = Image.open(io.BytesIO(bytes_b)).convert('L').resize((64, 64))
        arr_a = np.array(img_a, dtype=float)
        arr_b = np.array(img_b, dtype=float)
        mse = np.mean((arr_a - arr_b) ** 2)
        return mse
    except Exception as e:
        print(f"ERROR: Image diff failed: {e}", flush=True)
        return 99999
