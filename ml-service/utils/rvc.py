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
    hubert_features: np.ndarray,   # [n_frames, hidden_dim] at HuBERT rate (50 fps)
    f0: np.ndarray,                 # [n_frames] Hz, aligned to HuBERT rate
    speaker_id: int,
    rvc_session: ort.InferenceSession,
    noise_scale: float = 0.4,
    rvc_output_sr: int = RVC_OUTPUT_SR,
) -> tuple[np.ndarray, int]:
    """
    Run RVC ONNX decoder.

    RVC internally upsamples features 2x and expects pitch/pitchf at the upsampled
    rate. This function does that 2x interpolation transparently.

    Returns:
        (audio, TARGET_SR) — waveform resampled to 48kHz
    """
    # RVC standard: features and pitch fed at 2x HuBERT rate
    n_orig          = hubert_features.shape[0]
    features_2x     = np.repeat(hubert_features, 2, axis=0)        # nearest-neighbour 2x
    n_frames        = features_2x.shape[0]
    f0_upsampled    = align_f0(f0, n_frames)                        # linear interp 2x
    f0_coarse       = f0_to_coarse(f0_upsampled)

    phone         = features_2x[np.newaxis, :, :]                  # [1, n_frames, hidden]
    phone_lengths = np.array([n_frames], dtype=np.int64)
    pitch         = f0_coarse[np.newaxis, :]                                # [1, n_frames]
    pitchf        = f0_upsampled[np.newaxis, :].astype(np.float32)          # [1, n_frames]
    ds            = np.array([speaker_id], dtype=np.int64)
    rnd           = np.random.randn(1, 192, n_frames).astype(np.float32) * noise_scale

    # Try all known input-name variants; model declares which it uses.
    feed_candidates = {
        "phone":         phone,
        "phone_lengths": phone_lengths,
        "pitch":         pitch,
        "pitchf":        pitchf,   # RVC v1/v2 standard
        "nsff0":         pitchf,   # older alias
        "ds":            ds,       # RVC standard
        "sid":           ds,       # older alias
        "rnd":           rnd,
    }
    model_input_names = {inp.name for inp in rvc_session.get_inputs()}
    feed = {k: v for k, v in feed_candidates.items() if k in model_input_names}

    missing = model_input_names - set(feed.keys())
    if missing:
        raise RuntimeError(f"RVC model expects unknown inputs: {missing}")

    logger.debug("RVC inputs: %s", list(feed.keys()))

    output = rvc_session.run(None, feed)[0]
    # Outputs are usually [1, 1, samples] or [1, samples] or [samples]
    audio = np.asarray(output).squeeze().astype(np.float32)
    if audio.ndim > 1:
        audio = audio.reshape(-1)

    # Resample RVC output to 48kHz
    from math import gcd
    g = gcd(TARGET_SR, rvc_output_sr)
    audio_48k = resample_poly(audio, TARGET_SR // g, rvc_output_sr // g)

    return audio_48k.astype(np.float32), TARGET_SR
