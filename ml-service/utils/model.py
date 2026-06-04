import json
import logging
import os

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "shared", "models")
)
VOICES_JSON = os.path.join(MODELS_DIR, "voices.json")

# RVC has two ContentVec encoder variants:
#   v2 (768-dim) → most modern models
#   v1 (256-dim) → older models
HUBERT_PATHS = {
    768: os.path.join(MODELS_DIR, "content-vec-best.onnx"),
    256: os.path.join(MODELS_DIR, "content-vec-256.onnx"),
}
HUBERT_PATH = HUBERT_PATHS[768]  # back-compat default

PLACEHOLDER_PATH = os.path.join(
    os.path.dirname(__file__), "..", "models", "voice_converter.onnx"
)

_sessions: dict[str, ort.InferenceSession] = {}
_voice_catalog: dict[str, dict] | None = None


# ---------------------------------------------------------------------------
# Voice catalog
# ---------------------------------------------------------------------------

def _load_catalog() -> dict[str, dict]:
    global _voice_catalog
    if _voice_catalog is None:
        if os.path.exists(VOICES_JSON):
            with open(VOICES_JSON, encoding="utf-8") as f:
                data = json.load(f)
            _voice_catalog = {v["voiceId"]: v for v in data.get("voices", [])}
            logger.info("Voice catalog loaded: %d voices", len(_voice_catalog))
        else:
            logger.warning("voices.json not found: %s", VOICES_JSON)
            _voice_catalog = {}
    return _voice_catalog


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

def _providers() -> list[str]:
    available = ort.get_available_providers()
    return [p for p in ("DmlExecutionProvider", "CPUExecutionProvider") if p in available]


def _open_session(path: str) -> ort.InferenceSession:
    providers = _providers()
    logger.info("Loading ONNX: %s  providers=%s", path, providers)
    session = ort.InferenceSession(path, providers=providers)
    logger.info("Loaded. Active provider: %s", session.get_providers())
    return session


# ---------------------------------------------------------------------------
# HuBERT / ContentVec session
# ---------------------------------------------------------------------------

def get_hubert_session(dim: int = 768) -> ort.InferenceSession | None:
    """
    Return ContentVec encoder session for the requested embedding dimension.
    dim=768 → RVC v2 (content-vec-best.onnx)
    dim=256 → RVC v1 (content-vec-256.onnx)
    """
    path = HUBERT_PATHS.get(dim)
    if path is None:
        return None
    key = f"__hubert_{dim}__"
    if key not in _sessions:
        if not os.path.exists(path):
            logger.warning("HuBERT %d-dim not found: %s", dim, path)
            _sessions[key] = None  # type: ignore[assignment]
        else:
            _sessions[key] = _open_session(path)
    return _sessions.get(key)


def get_voice_encoder_dim(rvc_session: ort.InferenceSession) -> int:
    """Read embedding dim required by the voice model (256 or 768)."""
    return rvc_session.get_inputs()[0].shape[-1]


# ---------------------------------------------------------------------------
# RVC decoder session (voice-specific)
# ---------------------------------------------------------------------------

def get_rvc_session(voice_id: str) -> ort.InferenceSession | None:
    """Return RVC decoder session for the given voice_id, or None if missing."""
    catalog = _load_catalog()
    entry = catalog.get(voice_id)
    if entry is None:
        return None

    key = f"rvc_{voice_id}"
    if key not in _sessions:
        path = os.path.join(MODELS_DIR, entry["modelFile"])
        if not os.path.exists(path):
            logger.warning("RVC model not found for '%s': %s", voice_id, path)
            _sessions[key] = None  # type: ignore[assignment]
        else:
            _sessions[key] = _open_session(path)
    return _sessions.get(key)


# ---------------------------------------------------------------------------
# Placeholder session (fallback)
# ---------------------------------------------------------------------------

def get_placeholder_session() -> ort.InferenceSession:
    key = "__placeholder__"
    if key not in _sessions:
        if not os.path.exists(PLACEHOLDER_PATH):
            _create_placeholder(PLACEHOLDER_PATH)
        _sessions[key] = _open_session(PLACEHOLDER_PATH)
    return _sessions[key]


def run_placeholder(session: ort.InferenceSession, audio: np.ndarray) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    result = session.run([output_name], {input_name: audio.reshape(1, -1)})[0]
    return result.reshape(-1)


# ---------------------------------------------------------------------------
# Placeholder model creation
# ---------------------------------------------------------------------------

def _create_placeholder(path: str) -> None:
    audio_in = helper.make_tensor_value_info("audio_in", TensorProto.FLOAT, [1, None])
    audio_out = helper.make_tensor_value_info("audio_out", TensorProto.FLOAT, [1, None])
    gain_data = np.array([[1.0]], dtype=np.float32)
    gain_init = helper.make_tensor(
        "gain", TensorProto.FLOAT, gain_data.shape, gain_data.flatten().tolist()
    )
    node = helper.make_node("Mul", inputs=["audio_in", "gain"], outputs=["audio_out"])
    graph = helper.make_graph(
        [node], "placeholder", [audio_in], [audio_out], initializer=[gain_init]
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    onnx.checker.check_model(model)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    onnx.save(model, path)
    logger.info("Placeholder model saved: %s", path)
