import logging
from math import gcd

import numpy as np
import onnxruntime as ort
from scipy.signal import resample_poly

logger = logging.getLogger(__name__)

HUBERT_SR = 16000
HOP_SIZE = 320  # samples at 16kHz → 20 ms per frame


def resample_to_16k(audio: np.ndarray, sr: int) -> np.ndarray:
    if sr == HUBERT_SR:
        return audio
    g = gcd(HUBERT_SR, sr)
    return resample_poly(audio, HUBERT_SR // g, sr // g).astype(np.float32)


def extract_features(
    audio: np.ndarray,
    sr: int,
    session: ort.InferenceSession,
) -> np.ndarray:
    """
    Run ContentVec/HuBERT encoder on audio.

    Returns:
        np.ndarray: shape [n_frames, hidden_dim]  (hidden_dim = 256 or 768)
    """
    audio_16k = resample_to_16k(audio, sr)

    peak = np.abs(audio_16k).max()
    if peak > 0:
        audio_16k = audio_16k / peak

    # [1, samples]
    inp = audio_16k.reshape(1, -1).astype(np.float32)

    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    result = session.run([output_name], {input_name: inp})[0]

    # Normalise to [n_frames, hidden_dim]
    if result.ndim == 3:
        result = result.squeeze(0)

    logger.debug("HuBERT features: %s", result.shape)
    return result.astype(np.float32)
