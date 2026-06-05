"""
Prosody transfer: take F0 contour from a reference recording and apply it
to a TTS-generated audio via WORLD vocoder re-synthesis.

Pipeline:
  1. Extract F0 from reference and TTS audio
  2. Linear-resample reference F0 to TTS frame count
  3. Pitch-normalize: scale so median F0 of reference maps to median F0 of TTS
     (keeps the relative shape but avoids gross octave jumps)
  4. POST to world-service /resynthesize → WAV with new F0
"""

import logging

import numpy as np
import requests
from scipy.interpolate import interp1d

from utils.audio import load_wav_bytes, save_wav_bytes
from utils.f0 import extract_f0

logger = logging.getLogger(__name__)

WORLD_URL = "http://localhost:8002"


def _align_f0(f0_ref: np.ndarray, n_target: int) -> np.ndarray:
    """Linear resample f0_ref to n_target frames."""
    if len(f0_ref) == n_target:
        return f0_ref.copy()
    if len(f0_ref) < 2:
        return np.full(n_target, f0_ref[0] if len(f0_ref) == 1 else 0.0, dtype=np.float32)
    x_src = np.linspace(0.0, 1.0, len(f0_ref))
    x_dst = np.linspace(0.0, 1.0, n_target)
    return interp1d(x_src, f0_ref, kind="linear")(x_dst).astype(np.float32)


def _pitch_normalize(f0_aligned: np.ndarray, f0_tts: np.ndarray) -> np.ndarray:
    """
    Scale f0_aligned so its median voiced pitch matches the TTS median voiced pitch.
    This maps the user's intonation shape onto the TTS voice's natural range.
    """
    ref_voiced = f0_aligned[f0_aligned > 0]
    tts_voiced = f0_tts[f0_tts > 0]

    if ref_voiced.size == 0 or tts_voiced.size == 0:
        return f0_aligned

    scale = np.median(tts_voiced) / np.median(ref_voiced)
    return np.where(f0_aligned > 0, f0_aligned * scale, 0.0).astype(np.float32)


def apply(
    tts_audio: np.ndarray,
    tts_sr: int,
    ref_audio: np.ndarray,
    ref_sr: int,
) -> tuple[np.ndarray, int]:
    """
    Transfer prosody from ref_audio to tts_audio.
    Returns (output_audio, sample_rate).
    """
    # Extract F0 from reference
    ref_f0_data = extract_f0(ref_audio, ref_sr)
    f0_ref = np.array(ref_f0_data["f0"], dtype=np.float32)

    # Extract F0 from TTS (to know frame count and pitch range)
    tts_f0_data = extract_f0(tts_audio, tts_sr)
    f0_tts = np.array(tts_f0_data["f0"], dtype=np.float32)

    n_frames = len(f0_tts)
    logger.info("Prosody transfer: ref_frames=%d tts_frames=%d", len(f0_ref), n_frames)

    # Align and normalize
    f0_aligned    = _align_f0(f0_ref, n_frames)
    f0_normalized = _pitch_normalize(f0_aligned, f0_tts)

    # Send to world-service for re-synthesis
    tts_wav = save_wav_bytes(tts_audio, tts_sr)
    f0_str  = " ".join(f"{v:.4f}" for v in f0_normalized.tolist())

    resp = requests.post(
        f"{WORLD_URL}/resynthesize",
        files={"file": ("tts.wav", tts_wav, "audio/wav")},
        data={"f0": f0_str},
        timeout=120,
    )
    resp.raise_for_status()

    audio_out, sr_out = load_wav_bytes(resp.content)
    logger.info("Prosody transfer done: output samples=%d sr=%d", len(audio_out), sr_out)
    return audio_out, sr_out
