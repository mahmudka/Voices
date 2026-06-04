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
PLACEHOLDER_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "voice_converter.onnx")

_sessions: dict[str, ort.InferenceSession] = {}
_voice_catalog: dict[str, dict] | None = None


def _load_catalog() -> dict[str, dict]:
    global _voice_catalog
    if _voice_catalog is None:
        if os.path.exists(VOICES_JSON):
            with open(VOICES_JSON, encoding="utf-8") as f:
                data = json.load(f)
            _voice_catalog = {v["voiceId"]: v for v in data.get("voices", [])}
        else:
            _voice_catalog = {}
    return _voice_catalog


def _model_path_for(voice_id: str | None) -> str:
    if voice_id:
        catalog = _load_catalog()
        entry = catalog.get(voice_id)
        if entry:
            candidate = os.path.join(MODELS_DIR, entry["modelFile"])
            if os.path.exists(candidate):
                return candidate
            logger.warning("Model file not found for voice '%s': %s", voice_id, candidate)
    return PLACEHOLDER_PATH


def get_session(voice_id: str | None = None) -> ort.InferenceSession:
    key = voice_id or "__placeholder__"
    if key not in _sessions:
        path = _model_path_for(voice_id)
        _sessions[key] = _load_session(path)
    return _sessions[key]


def run_inference(session: ort.InferenceSession, audio: np.ndarray) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    result = session.run([output_name], {input_name: audio.reshape(1, -1)})[0]
    return result.reshape(-1)


def _load_session(model_path: str) -> ort.InferenceSession:
    if not os.path.exists(model_path):
        logger.info("ONNX model not found — creating placeholder: %s", model_path)
        _create_placeholder_model(model_path)

    available = ort.get_available_providers()
    providers = [p for p in ("DmlExecutionProvider", "CPUExecutionProvider") if p in available]
    logger.info("Loading ONNX model from %s with providers: %s", model_path, providers)
    session = ort.InferenceSession(model_path, providers=providers)
    logger.info("ONNX model loaded. Provider: %s", session.get_providers())
    return session


def _create_placeholder_model(path: str) -> None:
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
