import logging

import numpy as np
import onnxruntime as ort
from scipy.signal import resample_poly

logger = logging.getLogger(__name__)

F0_BIN = 256
F0_MAX = 1100.0
F0_MIN = 50.0
_F0_MEL_MIN = 1127 * np.log(1 + F0_MIN / 700)
_F0_MEL_MAX = 1127 * np.log(1 + F0_MAX / 700)

RVC_OUTPUT_SR = 40000  # default RVC output sample rate
TARGET_SR = 48000


def f0_to_coarse(f0: np.ndarray) -> np.ndarray:
    """Convert F0 Hz → quantised int64 in [0, F0_BIN-1]."""
    f0_mel = np.where(f0 > 0, 1127 * np.log(1 + f0 / 700), 0.0)
    coarse = np.where(
        f0_mel > 0,
        np.clip(
            (f0_mel - _F0_MEL_MIN) * (F0_BIN - 2) / (_F0_MEL_MAX - _F0_MEL_MIN) + 1,
            1, F0_BIN - 1,
        ),
        0.0,
    )
    return coarse.astype(np.int64)


def align_f0(f0: np.ndarray, n_target_frames: int) -> np.ndarray:
    """Linearly resample F0 to match HuBERT frame count."""
    if len(f0) == n_target_frames:
        return f0
    idx = np.linspace(0, len(f0) - 1, n_target_frames)
    return np.interp(idx, np.arange(len(f0)), f0).astype(np.float32)


def infer(
    hubert_features: np.ndarray,   # [n_frames, hidden_dim]
    f0: np.ndarray,                 # [n_frames] Hz, already aligned
    speaker_id: int,
    rvc_session: ort.InferenceSession,
    noise_scale: float = 0.4,
    rvc_output_sr: int = RVC_OUTPUT_SR,
) -> tuple[np.ndarray, int]:
    """
    Run RVC v2 ONNX decoder.

    Returns:
        (audio, sample_rate)  — waveform at rvc_output_sr, resampled to TARGET_SR
    """
    n_frames = hubert_features.shape[0]

    f0_coarse = f0_to_coarse(f0)

    phone = hubert_features[np.newaxis, :, :]           # [1, n_frames, hidden_dim]
    phone_lengths = np.array([n_frames], dtype=np.int64)
    pitch = f0_coarse[np.newaxis, :]                    # [1, n_frames]
    nsff0 = f0[np.newaxis, :].astype(np.float32)       # [1, n_frames]
    sid = np.array([speaker_id], dtype=np.int64)
    rnd = np.random.randn(1, 192, n_frames).astype(np.float32) * noise_scale

    feed_candidates = {
        "phone":         phone,
        "phone_lengths": phone_lengths,
        "pitch":         pitch,
        "nsff0":         nsff0,
        "sid":           sid,
        "rnd":           rnd,
    }

    model_input_names = {inp.name for inp in rvc_session.get_inputs()}
    feed = {k: v for k, v in feed_candidates.items() if k in model_input_names}

    logger.debug("RVC inputs: %s", list(feed.keys()))

    output = rvc_session.run(None, feed)[0]
    audio = output.squeeze().astype(np.float32)

    # Resample RVC output to 48kHz
    from math import gcd
    g = gcd(TARGET_SR, rvc_output_sr)
    audio_48k = resample_poly(audio, TARGET_SR // g, rvc_output_sr // g)

    return audio_48k.astype(np.float32), TARGET_SR
