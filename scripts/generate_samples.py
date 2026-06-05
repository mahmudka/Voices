"""Generate short MP3 preview samples for each Edge TTS voice."""
import asyncio
import os

import edge_tts

SAMPLES_DIR = r"C:\Claude\Voices\Voices\frontend\public\samples"

LANG_TEXT = {
    "ru-RU": "Привет! Это голос для озвучки текста.",
    "en-US": "Hello! This is a voice for text narration.",
    "en-GB": "Hello! This is a voice for text narration.",
    "de-DE": "Hallo! Das ist eine Stimme für die Textvertonung.",
    "fr-FR": "Bonjour! C'est une voix pour la narration de texte.",
    "es-ES": "¡Hola! Esta es una voz para la narración de texto.",
    "ro-RO": "Bună! Aceasta este o voce pentru narațiunea textului.",
}

VOICES = [
    # Russian
    ("ru-RU-DmitryNeural",       "ru-RU"),
    ("ru-RU-SvetlanaNeural",     "ru-RU"),
    # English US
    ("en-US-GuyNeural",          "en-US"),
    ("en-US-JennyNeural",        "en-US"),
    ("en-US-AriaNeural",         "en-US"),
    ("en-US-DavisNeural",        "en-US"),
    ("en-US-AmberNeural",        "en-US"),
    ("en-US-ChristopherNeural",  "en-US"),
    # English UK
    ("en-GB-RyanNeural",         "en-GB"),
    ("en-GB-SoniaNeural",        "en-GB"),
    ("en-GB-LibbyNeural",        "en-GB"),
    ("en-GB-OliverNeural",       "en-GB"),
    # German
    ("de-DE-ConradNeural",       "de-DE"),
    ("de-DE-KatjaNeural",        "de-DE"),
    ("de-DE-AmalaNeural",        "de-DE"),
    ("de-DE-BerndNeural",        "de-DE"),
    ("de-DE-ElkeNeural",         "de-DE"),
    # French
    ("fr-FR-HenriNeural",        "fr-FR"),
    ("fr-FR-DeniseNeural",       "fr-FR"),
    ("fr-FR-AlainNeural",        "fr-FR"),
    ("fr-FR-BrigitteNeural",     "fr-FR"),
    ("fr-FR-YvesNeural",         "fr-FR"),
    # Spanish
    ("es-ES-AlvaroNeural",       "es-ES"),
    ("es-ES-ElviraNeural",       "es-ES"),
    ("es-ES-DarioNeural",        "es-ES"),
    ("es-ES-IreneNeural",        "es-ES"),
    ("es-ES-TrianaNeural",       "es-ES"),
    # Romanian
    ("ro-RO-AlinaNeural",        "ro-RO"),
    ("ro-RO-EmilNeural",         "ro-RO"),
]


async def generate_one(voice_id: str, lang: str) -> None:
    out = os.path.join(SAMPLES_DIR, f"{voice_id}.mp3")
    if os.path.exists(out):
        print(f"skip  {voice_id}")
        return
    text = LANG_TEXT[lang]
    try:
        await edge_tts.Communicate(text, voice_id).save(out)
        size = os.path.getsize(out)
        print(f"ok    {voice_id}  ({size} bytes)")
    except Exception as exc:
        print(f"ERROR {voice_id}: {exc}")


async def main() -> None:
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    await asyncio.gather(*[generate_one(vid, lang) for vid, lang in VOICES])
    print(f"\nDone — {len(VOICES)} voices processed.")


asyncio.run(main())
