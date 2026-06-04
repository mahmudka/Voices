import numpy as np
from scipy.signal import correlate

# Диапазон F0 человеческого голоса
F0_MIN_HZ = 65.41   # C2
F0_MAX_HZ = 2093.0  # C7
VOICED_THRESHOLD = 0.35  # порог нормализованной автокорреляции


def extract_f0(audio: np.ndarray, sr: int,
               frame_length: int = 2048,
               hop_length: int = 512) -> dict:
    """Autocorrelation-based F0 extraction (no numba required)."""
    min_lag = max(1, int(sr / F0_MAX_HZ))
    max_lag = int(sr / F0_MIN_HZ)

    n_frames = max(1, (len(audio) - frame_length) // hop_length + 1)
    window = np.hanning(frame_length)

    f0 = np.zeros(n_frames, dtype=np.float32)
    voiced_flag = np.zeros(n_frames, dtype=bool)
    voiced_probs = np.zeros(n_frames, dtype=np.float32)

    for i in range(n_frames):
        start = i * hop_length
        frame = audio[start:start + frame_length]
        if len(frame) < frame_length:
            break

        windowed = frame * window
        ac = correlate(windowed, windowed, mode='full')
        ac = ac[len(ac) // 2:]  # только положительные лаги

        if ac[0] == 0:
            continue

        ac_norm = ac / ac[0]

        search_region = ac_norm[min_lag:max_lag + 1]
        if search_region.size == 0:
            continue

        peak_offset = int(np.argmax(search_region))
        lag = min_lag + peak_offset
        peak_val = float(ac_norm[lag])

        voiced_probs[i] = peak_val
        if peak_val >= VOICED_THRESHOLD and lag > 0:
            f0[i] = sr / lag
            voiced_flag[i] = True

    times = np.arange(n_frames) * hop_length / sr

    voiced_f0 = f0[voiced_flag]
    mean_f0 = float(voiced_f0.mean()) if voiced_f0.size > 0 else 0.0
    median_f0 = float(np.median(voiced_f0)) if voiced_f0.size > 0 else 0.0

    return {
        "f0": f0.tolist(),
        "times": times.tolist(),
        "voiced_flag": voiced_flag.tolist(),
        "voiced_probs": voiced_probs.tolist(),
        "mean_f0": mean_f0,
        "median_f0": median_f0,
        "sample_rate": sr,
        "duration": float(len(audio) / sr),
        "hop_length": hop_length,
    }
