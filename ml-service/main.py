import logging

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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
    """Return available TTS voices."""
    return tts_voices()


@app.post("/generate")
async def generate(
    text:      str        = Form(...),
    voice_id:  str        = Form(default="ru-RU-DmitryNeural"),
    reference: UploadFile = File(default=None),
):
    """
    Generate speech from text using Edge TTS.
    If reference audio is provided, transfer its F0 prosody onto the TTS output.
    """
    if not text.strip():
        raise HTTPException(400, "text is empty")

    # Step 1: TTS generation
    try:
        tts_audio, tts_sr = tts_generate(text, voice_id)
    except Exception as e:
        logger.error("TTS failed: %s", e)
        raise HTTPException(500, f"TTS error: {e}")

    # Step 2: prosody transfer (if reference provided)
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
