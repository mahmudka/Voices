"""
Spectral envelope morphing — Path B voice conversion.

Algorithm:
  1. STFT source audio
  2. Per-frame: estimate spectral envelope via cepstral liftering
  3. Compute ratio: target_profile / source_envelope
  4. Apply ratio to STFT magnitudes, keep phase unchanged
  5. ISTFT → timbre changed, F0/timing intact

Voice profiles are analytical (formant + tilt model), no reference audio needed.
"""

import numpy as np
from scipy.signal import stft, istft

N_FFT    = 2048
HOP      = 512
LIFTER   = 28   # cepstral lifter order — keeps smooth formant envelope

# Each entry: (formants, spectral_tilt_db_per_oct)
# Formant tuple: (center_hz, bandwidth_hz, peak_gain_db)
# Tilt is relative to 1 kHz
_PROFILES: dict[str, tuple[list, float]] = {
    "male_neutral": (
        [(680, 140, 0), (1200, 190, -3), (2500, 280, -8), (3500, 380, -15)],
        -6.0,
    ),
    "male_deep": (
        [(540, 190, 4), (980, 240, 0), (2100, 320, -8), (3100, 420, -16)],
        -9.0,
    ),
    "male_elder": (
        [(730, 165, 0), (1310, 210, -4), (2620, 330, -9), (3600, 410, -15)],
        -7.0,
    ),
    "female_neutral": (
        [(890, 155, 0), (1710, 195, -2), (2820, 245, -6), (3820, 340, -12)],
        -5.0,
    ),
    "female_soft": (
        [(840, 175, 1), (1590, 215, -2), (2700, 270, -7), (3700, 370, -13)],
        -4.5,
    ),
    "child": (
        [(1010, 195, 3), (2210, 235, 0), (3210, 295, -4), (4200, 370, -10)],
        -3.5,
    ),
}


def voice_ids() -> list[str]:
    return list(_PROFILES.keys())


def _build_target(voice_id: str, sr: int, n_bins: int) -> np.ndarray:
    """Analytical spectral profile → linear magnitude, shape (n_bins,)."""
    formants, tilt_db = _PROFILES[voice_id]
    freqs = np.fft.rfftfreq(N_FFT, 1.0 / sr)  # shape (N_FFT//2+1,)

    # Spectral tilt
    ref = 1000.0
    tilt = tilt_db * np.log2(np.maximum(freqs, 10.0) / ref)
    env_db = tilt.copy()

    # Formant peaks (Gaussian in dB)
    for f_c, f_bw, gain in formants:
        peak = gain - 12.0 * ((freqs - f_c) / f_bw) ** 2
        env_db = np.maximum(env_db, peak)

    env_db -= env_db.max()  # normalise peak to 0 dB
    profile = 10.0 ** (env_db / 20.0)  # → linear

    if len(profile) == n_bins:
        return profile

    # Interpolate if n_bins differs (shouldn't happen with N_FFT=2048)
    xs = np.linspace(0, 1, len(profile))
    xq = np.linspace(0, 1, n_bins)
    return np.maximum(np.interp(xq, xs, profile), 1e-8)


def _estimate_envelope(mag_frame: np.ndarray) -> np.ndarray:
    """
    Cepstral liftering envelope estimate for one STFT magnitude frame.
    Keeps quefrency 0..LIFTER → smooth spectral envelope without F0 harmonics.
    F0 harmonics sit at quefrency ~ sr/F0 >> LIFTER (160–480 for 100–300 Hz).
    """
    log_mag = np.log(mag_frame + 1e-8)
    cep = np.fft.irfft(log_mag)          # real cepstrum, len=N_FFT
    win = np.zeros(len(cep))
    win[0] = 1.0
    win[1:LIFTER] = 2.0                  # symmetric lifter
    env = np.exp(np.fft.rfft(cep * win).real)
    return np.maximum(np.abs(env), 1e-8)


def morph_spectrum(
    audio: np.ndarray,
    sr: int,
    voice_id: str,
    strength: float = 0.88,
) -> np.ndarray:
    """
    Transform spectral envelope of `audio` towards `voice_id` profile.

    strength: 0.0 = identity, 1.0 = full profile replacement.
    Returns float32 array, same length as input, same sample rate.
    """
    if voice_id not in _PROFILES:
        return audio

    # ── STFT ─────────────────────────────────────────────────────────────────
    _, _, Zxx = stft(audio, fs=sr, nperseg=N_FFT, noverlap=N_FFT - HOP,
                     window="hann", boundary="zeros", padded=True)
    mag   = np.abs(Zxx)          # (n_bins, n_frames)
    phase = np.angle(Zxx)
    n_bins = mag.shape[0]

    target = _build_target(voice_id, sr, n_bins)  # (n_bins,)

    # ── Per-frame envelope morphing ───────────────────────────────────────────
    morphed_mag = np.empty_like(mag)
    for t in range(mag.shape[1]):
        src_env = _estimate_envelope(mag[:, t])
        ratio   = target / src_env                # spectral ratio
        ratio   = 1.0 + strength * (ratio - 1.0) # blend
        ratio   = np.clip(ratio, 0.05, 20.0)
        morphed_mag[:, t] = np.clip(mag[:, t] * ratio, 0.0, None)

    # ── ISTFT with original phase ─────────────────────────────────────────────
    Zxx_morphed = morphed_mag * np.exp(1j * phase)
    _, out = istft(Zxx_morphed, fs=sr, nperseg=N_FFT, noverlap=N_FFT - HOP,
                   window="hann", boundary=True)

    # Trim / pad to original length
    n = len(audio)
    if len(out) >= n:
        out = out[:n]
    else:
        out = np.pad(out, (0, n - len(out)))

    # Match RMS level to input
    rms_in  = np.sqrt(np.mean(audio ** 2)) + 1e-8
    rms_out = np.sqrt(np.mean(out   ** 2)) + 1e-8
    out    *= rms_in / rms_out

    return out.astype(np.float32)
