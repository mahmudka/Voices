import logging
import os

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper

logger = logging.getLogger(__name__)

_session: ort.InferenceSession | None = None


def get_session(model_path: str) -> ort.InferenceSession:
    global _session
    if _session is None:
        _session = _load_or_create(model_path)
    return _session


def run_inference(session: ort.InferenceSession, audio: np.ndarray) -> np.ndarray:
    """Run ONNX model on float32 audio samples."""
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    result = session.run([output_name], {input_name: audio.reshape(1, -1)})[0]
    return result.reshape(-1)


def _load_or_create(model_path: str) -> ort.InferenceSession:
    if not os.path.exists(model_path):
        logger.info("ONNX model not found at %s — creating placeholder.", model_path)
        _create_placeholder_model(model_path)

    available = ort.get_available_providers()
    providers = [p for p in ("DmlExecutionProvider", "CPUExecutionProvider") if p in available]

    logger.info("Loading ONNX model from %s with providers: %s", model_path, providers)
    session = ort.InferenceSession(model_path, providers=providers)
    logger.info("ONNX model loaded. Provider in use: %s", session.get_providers())
    return session


def _create_placeholder_model(path: str) -> None:
    """Minimal ONNX graph: audio_out = audio_in * gain (gain=1.0, identity)."""
    audio_in = helper.make_tensor_value_info("audio_in", TensorProto.FLOAT, [1, None])
    audio_out = helper.make_tensor_value_info("audio_out", TensorProto.FLOAT, [1, None])

    gain_data = np.array([[1.0]], dtype=np.float32)
    gain_init = helper.make_tensor(
        "gain", TensorProto.FLOAT, gain_data.shape, gain_data.flatten().tolist()
    )

    node = helper.make_node("Mul", inputs=["audio_in", "gain"], outputs=["audio_out"])

    graph = helper.make_graph(
        [node], "voice_converter_placeholder", [audio_in], [audio_out],
        initializer=[gain_init]
    )
    model = helper.make_model(
        graph, opset_imports=[helper.make_opsetid("", 17)]
    )
    onnx.checker.check_model(model)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    onnx.save(model, path)
    logger.info("Placeholder ONNX model saved to %s", path)
