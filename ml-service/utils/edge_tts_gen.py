import logging
import os
import tempfile

import librosa
import numpy as np

logger = logging.getLogger(__name__)

# Curated voice list — subset of Edge TTS voices with best quality.
# Full list available via: asyncio.run(list_voices())
PRESET_VOICES = [
    # Russian
    {"voiceId": "ru-RU-DmitryNeural",   "name": "Дмитрий",   "language": "ru-RU", "gender": "male"},
    {"voiceId": "ru-RU-SvetlanaNeural", "name": "Светлана",  "language": "ru-RU", "gender": "female"},
    # English
    {"voiceId": "en-US-GuyNeural",      "name": "Guy",        "language": "en-US", "gender": "male"},
    {"voiceId": "en-US-JennyNeural",    "name": "Jenny",      "language": "en-US", "gender": "female"},
    {"voiceId": "en-GB-RyanNeural",     "name": "Ryan (UK)",  "language": "en-GB", "gender": "male"},
    {"voiceId": "en-GB-SoniaNeural",    "name": "Sonia (UK)", "language": "en-GB", "gender": "female"},
    # German
    {"voiceId": "de-DE-ConradNeural",   "name": "Conrad",     "language": "de-DE", "gender": "male"},
    {"voiceId": "de-DE-KatjaNeural",    "name": "Katja",      "language": "de-DE", "gender": "female"},
    # French
    {"voiceId": "fr-FR-HenriNeural",    "name": "Henri",      "language": "fr-FR", "gender": "male"},
    {"voiceId": "fr-FR-DeniseNeural",   "name": "Denise",     "language": "fr-FR", "gender": "female"},
    # Spanish
    {"voiceId": "es-ES-AlvaroNeural",   "name": "Álvaro",     "language": "es-ES", "gender": "male"},
    {"voiceId": "es-ES-ElviraNeural",   "name": "Elvira",     "language": "es-ES", "gender": "female"},
]


async def _generate_async(text: str, voice_id: str, rate: str, pitch: str) -> tuple[np.ndarray, int]:
    import edge_tts

    comm = edge_tts.Communicate(text, voice_id, rate=rate, pitch=pitch)

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(tmp_fd)
    try:
        await comm.save(tmp_path)
        audio, sr = librosa.load(tmp_path, sr=None, mono=True)
        logger.info("Edge TTS: voice=%s samples=%d sr=%d", voice_id, len(audio), sr)
        return audio.astype(np.float32), int(sr)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def generate(
    text: str,
    voice_id: str = "ru-RU-DmitryNeural",
    rate: str = "+0%",
    pitch: str = "+0Hz",
) -> tuple[np.ndarray, int]:
    """Generate TTS audio. Returns (float32 mono array, sample_rate)."""
    return await _generate_async(text, voice_id, rate, pitch)


def list_voices() -> list[dict]:
    return PRESET_VOICES
