import logging
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from utils.audio import load_wav_bytes, save_wav_bytes
from utils.edge_tts_gen import generate as tts_generate, list_voices as tts_voices

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Service", version="3.0.0")


@app.get("/health")
def health():
    return {"status": "ok", "pipeline": "tts+prosody"}


@app.get("/voices")
def list_voices():
    return tts_voices()


@app.post("/generate")
async def generate(
    text:      str                    = Query(...),
    voice_id:  str                    = Query(default="ru-RU-DmitryNeural"),
    reference: Optional[UploadFile]   = File(default=None),
):
    """
    Generate speech from text using Edge TTS.
    text and voice_id are query parameters (URL-encoded UTF-8).
    reference is an optional uploaded WAV file.
    """
    if not text.strip():
        raise HTTPException(400, "text is empty")

    logger.info("generate: voice=%s text_len=%d", voice_id, len(text))

    try:
        tts_audio, tts_sr = await tts_generate(text, voice_id)
    except Exception as e:
        logger.error("TTS failed: %s", e)
        raise HTTPException(500, f"TTS error: {e}")

    if reference is not None:
        raw = await reference.read()
        if raw:
            try:
                ref_audio, ref_sr = load_wav_bytes(raw)
                from utils.prosody_transfer import apply as transfer_prosody
                tts_audio, tts_sr = transfer_prosody(tts_audio, tts_sr, ref_audio, ref_sr)
            except Exception as e:
                logger.warning("Prosody transfer failed (%s) — returning plain TTS", e)

    return Response(
        content=save_wav_bytes(tts_audio, tts_sr),
        media_type="audio/wav",
    )
