"""Test Silero with the actual real estate text."""
import torch

model, _ = torch.hub.load(
    repo_or_dir="snakers4/silero-models",
    model="silero_tts",
    language="ru",
    speaker="v4_ru",
    trust_repo=True,
)

# The actual text from the UI
text = (
    "Жилой комплекс "
    "«Атмосфера» — "
    "это пространство."
)
print(f"Text: {text}")

try:
    audio = model.apply_tts(text=text, speaker="eugene", sample_rate=24000)
    print(f"OK shape={audio.shape}")
except Exception as e:
    print(f"FAIL: {type(e).__name__}: '{e}'")

# Test with guillemets removed
text2 = text.replace("«", '"').replace("»", '"').replace("—", "-")
print(f"Text2: {text2}")
try:
    audio2 = model.apply_tts(text=text2, speaker="eugene", sample_rate=24000)
    print(f"OK2 shape={audio2.shape}")
except Exception as e:
    print(f"FAIL2: {type(e).__name__}: '{e}'")
