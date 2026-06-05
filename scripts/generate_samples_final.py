"""Generate missing samples only — skip existing ones."""
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
    "es-ES": "Hola! Esta es una voz para la narración de texto.",
    "ro-RO": "Buna! Aceasta este o voce pentru naratiunea textului.",
}

VOICES = [
    # New / previously missing
    ("en-US-AvaNeural",                  "en-US"),
    ("en-US-AndrewNeural",               "en-US"),
    ("en-US-EmmaNeural",                 "en-US"),
    ("en-US-BrianNeural",                "en-US"),
    ("en-GB-ThomasNeural",               "en-GB"),
    ("en-GB-MaisieNeural",               "en-GB"),
    ("de-DE-SeraphinaMultilingualNeural","de-DE"),
    ("de-DE-FlorianMultilingualNeural",  "de-DE"),
    ("de-DE-KillianNeural",              "de-DE"),
    ("fr-FR-VivienneMultilingualNeural", "fr-FR"),
    ("fr-FR-RemyMultilingualNeural",     "fr-FR"),
    ("fr-FR-EloiseNeural",               "fr-FR"),
    ("es-ES-XimenaNeural",               "es-ES"),
]


async def generate_one(voice_id: str, lang: str) -> None:
    out = os.path.join(SAMPLES_DIR, f"{voice_id}.mp3")
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print(f"skip  {voice_id}")
        return
    text = LANG_TEXT[lang]
    try:
        await edge_tts.Communicate(text, voice_id).save(out)
        size = os.path.getsize(out)
        if size == 0:
            os.unlink(out)
            print(f"EMPTY {voice_id}")
        else:
            print(f"ok    {voice_id}  ({size} bytes)")
    except Exception as exc:
        print(f"ERROR {voice_id}: {exc}")
    await asyncio.sleep(0.3)


async def main() -> None:
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    for voice_id, lang in VOICES:
        await generate_one(voice_id, lang)
    print("\nDone.")


asyncio.run(main())
