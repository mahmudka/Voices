import logging
import os
import tempfile

import librosa
import numpy as np

logger = logging.getLogger(__name__)

PRESET_VOICES = [
    # Russian (2 available)
    {"voiceId": "ru-RU-DmitryNeural",              "name": "Дмитрий",   "language": "ru-RU", "gender": "male"},
    {"voiceId": "ru-RU-SvetlanaNeural",            "name": "Светлана",  "language": "ru-RU", "gender": "female"},
    # English US
    {"voiceId": "en-US-AvaNeural",                 "name": "Ava",       "language": "en-US", "gender": "female"},
    {"voiceId": "en-US-AndrewNeural",              "name": "Andrew",    "language": "en-US", "gender": "male"},
    {"voiceId": "en-US-EmmaNeural",                "name": "Emma",      "language": "en-US", "gender": "female"},
    {"voiceId": "en-US-BrianNeural",               "name": "Brian",     "language": "en-US", "gender": "male"},
    {"voiceId": "en-US-GuyNeural",                 "name": "Guy",       "language": "en-US", "gender": "male"},
    {"voiceId": "en-US-JennyNeural",               "name": "Jenny",     "language": "en-US", "gender": "female"},
    # English UK
    {"voiceId": "en-GB-RyanNeural",                "name": "Ryan",      "language": "en-GB", "gender": "male"},
    {"voiceId": "en-GB-SoniaNeural",               "name": "Sonia",     "language": "en-GB", "gender": "female"},
    {"voiceId": "en-GB-LibbyNeural",               "name": "Libby",     "language": "en-GB", "gender": "female"},
    {"voiceId": "en-GB-ThomasNeural",              "name": "Thomas",    "language": "en-GB", "gender": "male"},
    {"voiceId": "en-GB-MaisieNeural",              "name": "Maisie",    "language": "en-GB", "gender": "female"},
    # German
    {"voiceId": "de-DE-SeraphinaMultilingualNeural","name": "Seraphina","language": "de-DE", "gender": "female"},
    {"voiceId": "de-DE-FlorianMultilingualNeural", "name": "Florian",   "language": "de-DE", "gender": "male"},
    {"voiceId": "de-DE-AmalaNeural",               "name": "Amala",     "language": "de-DE", "gender": "female"},
    {"voiceId": "de-DE-ConradNeural",              "name": "Conrad",    "language": "de-DE", "gender": "male"},
    {"voiceId": "de-DE-KatjaNeural",               "name": "Katja",     "language": "de-DE", "gender": "female"},
    {"voiceId": "de-DE-KillianNeural",             "name": "Killian",   "language": "de-DE", "gender": "male"},
    # French
    {"voiceId": "fr-FR-VivienneMultilingualNeural","name": "Vivienne",  "language": "fr-FR", "gender": "female"},
    {"voiceId": "fr-FR-RemyMultilingualNeural",    "name": "Rémy",      "language": "fr-FR", "gender": "male"},
    {"voiceId": "fr-FR-DeniseNeural",              "name": "Denise",    "language": "fr-FR", "gender": "female"},
    {"voiceId": "fr-FR-EloiseNeural",              "name": "Éloïse",    "language": "fr-FR", "gender": "female"},
    {"voiceId": "fr-FR-HenriNeural",               "name": "Henri",     "language": "fr-FR", "gender": "male"},
    # Spanish (3 available)
    {"voiceId": "es-ES-XimenaNeural",              "name": "Ximena",    "language": "es-ES", "gender": "female"},
    {"voiceId": "es-ES-AlvaroNeural",              "name": "Álvaro",    "language": "es-ES", "gender": "male"},
    {"voiceId": "es-ES-ElviraNeural",              "name": "Elvira",    "language": "es-ES", "gender": "female"},
    # Romanian (2 available)
    {"voiceId": "ro-RO-AlinaNeural",               "name": "Alina",     "language": "ro-RO", "gender": "female"},
    {"voiceId": "ro-RO-EmilNeural",                "name": "Emil",      "language": "ro-RO", "gender": "male"},
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
