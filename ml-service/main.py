import json
import logging
import os

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from utils.audio import load_wav_bytes, save_wav_bytes
from utils.f0 import extract_f0
from utils.model import (
    get_hubert_session,
    get_placeholder_session,
    get_rvc_session,
    run_placeholder,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Service", version="2.0.0")


@app.on_event("startup")
async def startup():
    get_placeholder_session()

    hubert = get_hubert_session()
    if hubert:
        logger.info("HuBERT/ContentVec encoder ready.")
    else:
        logger.warning(
            "HuBERT model not found — RVC pipeline unavailable. "
            "Place content-vec-best.onnx in shared/models/ to enable."
        )
    logger.info("ML service ready on :8001")


@app.get("/health")
def health():
    hubert_ok = get_hubert_session() is not None
    return {
        "status": "ok",
        "hubert": hubert_ok,
        "rvc_pipeline": hubert_ok,
        "providers": get_placeholder_session().get_providers(),
    }


@app.get("/voices")
def list_voices():
    """Return available voice_ids that have RVC models on disk."""
    from utils.model import _load_catalog, MODELS_DIR
    import os

    catalog = _load_catalog()
    result = []
    for vid, entry in catalog.items():
        path = os.path.join(MODELS_DIR, entry["modelFile"])
        result.append({
            "voiceId": vid,
            "name": entry["name"],
            "modelReady": os.path.exists(path),
        })
    return result


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

    return extract_f0(audio, sr)


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    f0: str = Form(...),
    voice_id: str | None = Form(default=None),
    voice_type: str = Form(...),
    age: int = Form(...),
    timbre: str = Form(...),
):
    """Voice conversion: RVC pipeline when models present, identity fallback otherwise."""
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file.")

    try:
        audio, sr = load_wav_bytes(raw)
    except Exception as e:
        raise HTTPException(422, f"Cannot read WAV: {e}")

    try:
        f0_data = json.loads(f0.lstrip("﻿"))
    except json.JSONDecodeError as e:
        raise HTTPException(422, f"Invalid F0 JSON: {e}")

    processed, out_sr = await _run_conversion(audio, sr, f0_data, voice_id)

    return Response(
        content=save_wav_bytes(processed, out_sr),
        media_type="audio/wav",
        headers={
            "X-Session-VoiceId":   voice_id or "",
            "X-Session-VoiceType": voice_type,
            "X-Session-Age":       str(age),
            "X-Session-Timbre":    timbre,
            "X-Pipeline":          "rvc" if _rvc_available(voice_id) else "placeholder",
        },
    )


# ---------------------------------------------------------------------------
# Conversion routing
# ---------------------------------------------------------------------------

def _rvc_available(voice_id: str | None) -> bool:
    if not voice_id:
        return False
    hubert = get_hubert_session()
    rvc = get_rvc_session(voice_id) if voice_id else None
    return hubert is not None and rvc is not None


async def _run_conversion(
    audio: np.ndarray,
    sr: int,
    f0_data: dict,
    voice_id: str | None,
) -> tuple[np.ndarray, int]:
    """Route to RVC pipeline or placeholder."""

    hubert_session = get_hubert_session()
    rvc_session = get_rvc_session(voice_id) if voice_id else None

    if hubert_session is not None and rvc_session is not None:
        return _run_rvc(audio, sr, f0_data, rvc_session, hubert_session)

    # Fallback: identity transform — WORLD will do the voice shaping
    placeholder = get_placeholder_session()
    return run_placeholder(placeholder, audio), sr


def _run_rvc(
    audio: np.ndarray,
    sr: int,
    f0_data: dict,
    rvc_session,
    hubert_session,
) -> tuple[np.ndarray, int]:
    from utils.hubert import extract_features
    from utils.rvc import align_f0, infer

    # Extract HuBERT features
    features = extract_features(audio, sr, hubert_session)
    n_frames = features.shape[0]

    # Align F0 to HuBERT frame count
    f0_array = np.array(f0_data.get("f0", []), dtype=np.float32)
    f0_aligned = align_f0(f0_array, n_frames)

    try:
        audio_out, out_sr = infer(features, f0_aligned, 0, rvc_session)
        return audio_out, out_sr
    except Exception as exc:
        logger.error("RVC inference failed: %s — falling back to placeholder", exc)
        placeholder = get_placeholder_session()
        return run_placeholder(placeholder, audio), sr
