import json
import logging
import os

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from utils.audio import load_wav_bytes, save_wav_bytes
from utils.f0 import extract_f0
from utils.model import get_session, run_inference

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "voice_converter.onnx")

app = FastAPI(title="ML Service", version="1.0.0")


@app.on_event("startup")
async def startup():
    logger.info("Loading ONNX model...")
    get_session(MODEL_PATH)
    logger.info("ML service ready on :8001")


@app.get("/health")
def health():
    session = get_session(MODEL_PATH)
    return {
        "status": "ok",
        "providers": session.get_providers(),
        "model": os.path.basename(MODEL_PATH),
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """Extract F0 contour from uploaded WAV file."""
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file.")

    try:
        audio, sr = load_wav_bytes(raw)
    except Exception as e:
        raise HTTPException(422, f"Cannot read WAV: {e}")

    result = extract_f0(audio, sr)
    return result


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    f0: str = Form(...),
    voice_type: str = Form(...),
    age: int = Form(...),
    timbre: str = Form(...),
):
    """Apply ONNX voice conversion model to WAV audio."""
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file.")

    try:
        audio, sr = load_wav_bytes(raw)
    except Exception as e:
        raise HTTPException(422, f"Cannot read WAV: {e}")

    try:
        f0_data = json.loads(f0.lstrip('﻿'))
    except json.JSONDecodeError as e:
        raise HTTPException(422, f"Invalid F0 JSON: {e}")

    session = get_session(MODEL_PATH)

    try:
        processed = run_inference(session, audio)
    except Exception as e:
        logger.error("ONNX inference failed: %s", e)
        raise HTTPException(500, f"Inference error: {e}")

    out_bytes = save_wav_bytes(processed, sr)

    return Response(
        content=out_bytes,
        media_type="audio/wav",
        headers={
            "X-Session-VoiceType": voice_type,
            "X-Session-Age": str(age),
            "X-Session-Timbre": timbre,
        },
    )
