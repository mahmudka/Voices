import asyncio
import edge_tts

LANGS = {"de-DE", "fr-FR", "es-ES", "en-GB", "en-US", "ru-RU", "ro-RO"}

async def main():
    voices = await edge_tts.list_voices()
    for v in sorted(voices, key=lambda x: x["Locale"]):
        if v["Locale"] in LANGS:
            print(v["Locale"], v["ShortName"], v["Gender"])

asyncio.run(main())
