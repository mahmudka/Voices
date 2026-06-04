import io
import wave
import struct

import numpy as np
from scipy.io import wavfile


TARGET_SR = 48000


def load_wav_bytes(data: bytes) -> tuple[np.ndarray, int]:
    """Load WAV from raw bytes. Returns (float32 mono array, sample_rate)."""
    try:
        sr, audio = wavfile.read(io.BytesIO(data))
        audio = _normalize_to_float32(audio)
    except Exception:
        audio, sr = _load_24bit_wav(data)

    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    return audio.astype(np.float32), int(sr)


def save_wav_bytes(audio: np.ndarray, sr: int) -> bytes:
    """Save float32 mono array as 16-bit WAV bytes."""
    clipped = np.clip(audio, -1.0, 1.0)
    pcm16 = (clipped * 32767).astype(np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, sr, pcm16)
    return buf.getvalue()


def _normalize_to_float32(data: np.ndarray) -> np.ndarray:
    if data.dtype in (np.float32, np.float64):
        return data.astype(np.float32)
    if data.dtype == np.int16:
        return data.astype(np.float32) / 32768.0
    if data.dtype == np.int32:
        return data.astype(np.float32) / 2147483648.0
    if data.dtype == np.uint8:
        return (data.astype(np.float32) - 128.0) / 128.0
    return data.astype(np.float32)


def _load_24bit_wav(data: bytes) -> tuple[np.ndarray, int]:
    """Reads 24-bit PCM WAV that scipy doesn't handle."""
    with wave.open(io.BytesIO(data)) as f:
        sr = f.getframerate()
        n_channels = f.getnchannels()
        sampwidth = f.getsampwidth()
        n_frames = f.getnframes()
        raw = f.readframes(n_frames)

    total_samples = n_frames * n_channels

    if sampwidth == 3:
        raw_arr = np.frombuffer(raw, dtype=np.uint8).reshape(total_samples, 3)
        i32 = (raw_arr[:, 0].astype(np.int32)
               | (raw_arr[:, 1].astype(np.int32) << 8)
               | (raw_arr[:, 2].astype(np.int32) << 16))
        i32[i32 >= 0x800000] -= 0x1000000
        audio = i32.astype(np.float32) / 8388608.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    if n_channels > 1:
        audio = audio.reshape(n_frames, n_channels).mean(axis=1)

    return audio.astype(np.float32), sr
