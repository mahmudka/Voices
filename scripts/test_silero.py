import traceback
import torch

print("Loading model...")
model, _ = torch.hub.load(
    repo_or_dir="snakers4/silero-models",
    model="silero_tts",
    language="ru",
    speaker="v4_ru",
    trust_repo=True,
)
print("Speakers:", model.speakers)

for text in [
    "Привет это тестовый текст.",
    "Hello world.",
]:
    for speaker in ["aidar", "eugene"]:
        try:
            audio = model.apply_tts(text=text, speaker=speaker, sample_rate=24000)
            print(f"ok  [{speaker}] '{text[:30]}' -> shape={audio.shape}")
        except Exception as e:
            print(f"ERR [{speaker}] '{text[:30]}': {type(e).__name__}: {e}")
            traceback.print_exc()
