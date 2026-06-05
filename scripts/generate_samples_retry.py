"""Retry generation for missing samples — sequential with delay to avoid throttle."""
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
    ("de-DE-BerndNeural",    "de-DE"),
    ("de-DE-ElkeNeural",     "de-DE"),
    ("en-GB-OliverNeural",   "en-GB"),
    ("en-US-AmberNeural",    "en-US"),
    ("en-US-DavisNeural",    "en-US"),
    ("es-ES-DarioNeural",    "es-ES"),
    ("es-ES-IreneNeural",    "es-ES"),
    ("es-ES-TrianaNeural",   "es-ES"),
    ("fr-FR-AlainNeural",    "fr-FR"),
    ("fr-FR-BrigitteNeural", "fr-FR"),
    ("fr-FR-YvesNeural",     "fr-FR"),
]


async def generate_one(voice_id: str, lang: str) -> bool:
    out = os.path.join(SAMPLES_DIR, f"{voice_id}.mp3")
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print(f"skip  {voice_id}")
        return True
    text = LANG_TEXT[lang]
    try:
        await edge_tts.Communicate(text, voice_id).save(out)
        size = os.path.getsize(out)
        if size == 0:
            os.unlink(out)
            print(f"EMPTY {voice_id}")
            return False
        print(f"ok    {voice_id}  ({size} bytes)")
        return True
    except Exception as exc:
        print(f"ERROR {voice_id}: {exc}")
        return False


async def main() -> None:
    for voice_id, lang in VOICES:
        ok = await generate_one(voice_id, lang)
        if not ok:
            await asyncio.sleep(2)
        else:
            await asyncio.sleep(0.5)
    print("\nDone.")


asyncio.run(main())
