"""
Setup RVC ONNX models for voice conversion.

Downloads:
  1. ContentVec encoder (content-vec-best.onnx) — shared by all voices
  2. Voice-specific RVC models from voices.json (if URL specified)

Sources are tried in order; the first that succeeds wins. If all fail,
prints clear manual instructions.

Usage:
  pixi run python ../scripts/setup_models.py            # download all missing
  pixi run python ../scripts/setup_models.py --check    # only check what's present
  pixi run python ../scripts/setup_models.py --force    # re-download even if present
"""

import argparse
import json
import sys
from pathlib import Path

from huggingface_hub import hf_hub_download, HfApi
from huggingface_hub.utils import EntryNotFoundError, RepositoryNotFoundError

# ── Paths ──────────────────────────────────────────────────────────────────────

ROOT        = Path(__file__).resolve().parent.parent
MODELS_DIR  = ROOT / "shared" / "models"
VOICES_JSON = MODELS_DIR / "voices.json"

# ── Known sources for ContentVec ONNX ──────────────────────────────────────────
# Tried in order; first that downloads successfully wins.
# Format: (repo_id, filename, repo_type)

CONTENTVEC_SOURCES = [
    # ContentVec 768-dim layer 12 is the standard RVC v2 encoder.
    # In some repos it's called content-vec-best.onnx, in others vec-768-layer-12.onnx.
    ("ozada/onnx_rvc",         "vec-768-layer-12.onnx", "model"),
    ("DogManTC/test-rvc-onnx", "vec-768-layer-12.onnx", "model"),
]

CONTENTVEC_FILENAME = "content-vec-best.onnx"  # what our code expects

# ── Helpers ────────────────────────────────────────────────────────────────────

def ok(msg):    print(f"  [OK] {msg}")
def warn(msg):  print(f"  [!]  {msg}")
def fail(msg):  print(f"  [X]  {msg}")
def info(msg):  print(f"  ··   {msg}")


def try_download(repo_id: str, filename: str, dest: Path, repo_type: str = "model") -> Path | None:
    try:
        info(f"trying {repo_id}/{filename}")
        path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            repo_type=repo_type,
            local_dir=str(dest.parent),
        )
        downloaded = Path(path)
        if downloaded != dest:
            downloaded.replace(dest)
        return dest
    except (EntryNotFoundError, RepositoryNotFoundError):
        return None
    except Exception as exc:
        warn(f"{repo_id}: {type(exc).__name__}: {exc}")
        return None


def search_huggingface(query: str, limit: int = 5) -> list[str]:
    """Last-resort search for ContentVec ONNX on HuggingFace Hub."""
    try:
        api = HfApi()
        results = list(api.list_models(search=query, limit=limit))
        return [m.id for m in results]
    except Exception as exc:
        warn(f"HF search failed: {exc}")
        return []


# ── ContentVec ─────────────────────────────────────────────────────────────────

def setup_contentvec(force: bool = False) -> bool:
    print("\n[1/2] ContentVec encoder")
    dest = MODELS_DIR / CONTENTVEC_FILENAME

    if dest.exists() and not force:
        size_mb = dest.stat().st_size / 1024 / 1024
        ok(f"already present: {dest.name} ({size_mb:.1f} MB)")
        return True

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    for repo_id, filename, repo_type in CONTENTVEC_SOURCES:
        result = try_download(repo_id, filename, dest, repo_type)
        if result and result.exists():
            size_mb = result.stat().st_size / 1024 / 1024
            ok(f"downloaded from {repo_id} ({size_mb:.1f} MB)")
            return True

    fail("ContentVec download failed from all known sources")
    print()
    print("  Manual install:")
    print("  1. Search HuggingFace for 'content-vec-best.onnx' (about 190 MB)")
    print(f"  2. Place at: {dest}")
    print()
    hits = search_huggingface("content-vec onnx")
    if hits:
        print("  HF search results:")
        for h in hits:
            print(f"    https://huggingface.co/{h}")
    return False


# ── Voice models ───────────────────────────────────────────────────────────────

def setup_voice_models(force: bool = False) -> dict:
    print("\n[2/2] Voice models (.onnx per voice)")

    if not VOICES_JSON.exists():
        fail(f"voices.json not found: {VOICES_JSON}")
        return {}

    with open(VOICES_JSON, encoding="utf-8") as f:
        catalog = json.load(f)

    status = {}
    for voice in catalog.get("voices", []):
        voice_id   = voice["voiceId"]
        model_file = voice["modelFile"]
        source     = voice.get("source")  # optional: {"repo": "...", "filename": "..."}
        dest       = MODELS_DIR / model_file

        if dest.exists() and not force:
            size_mb = dest.stat().st_size / 1024 / 1024
            ok(f"{voice_id:18s} present ({size_mb:.1f} MB)")
            status[voice_id] = "present"
            continue

        if not source:
            warn(f"{voice_id:18s} no source URL in voices.json — fallback to spectral_morph")
            status[voice_id] = "no-source"
            continue

        repo      = source.get("repo")
        filename  = source.get("filename", model_file)
        repo_type = source.get("type", "model")

        if not repo:
            warn(f"{voice_id:18s} source.repo missing")
            status[voice_id] = "bad-source"
            continue

        result = try_download(repo, filename, dest, repo_type)
        if result and result.exists():
            size_mb = result.stat().st_size / 1024 / 1024
            ok(f"{voice_id:18s} downloaded ({size_mb:.1f} MB)")
            status[voice_id] = "downloaded"
        else:
            fail(f"{voice_id:18s} download failed")
            status[voice_id] = "failed"

    return status


# ── Summary ────────────────────────────────────────────────────────────────────

def print_summary(contentvec_ok: bool, voice_status: dict):
    print("\n" + "=" * 56)
    print("Summary")
    print("=" * 56)

    if contentvec_ok:
        print("ContentVec: READY -> RVC pipeline available")
    else:
        print("ContentVec: MISSING -> falling back to spectral_morph")

    if voice_status:
        n_ready = sum(1 for s in voice_status.values() if s in ("present", "downloaded"))
        n_total = len(voice_status)
        print(f"Voices: {n_ready}/{n_total} ready for RVC")
        if n_ready < n_total:
            print("        Voices without .onnx use spectral_morph fallback automatically")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="only check status, don't download")
    parser.add_argument("--force", action="store_true", help="re-download even if files present")
    args = parser.parse_args()

    print(f"Models directory: {MODELS_DIR}")

    if args.check:
        cv = (MODELS_DIR / CONTENTVEC_FILENAME).exists()
        print(f"\nContentVec: {'present' if cv else 'missing'}")

        if VOICES_JSON.exists():
            with open(VOICES_JSON, encoding="utf-8") as f:
                catalog = json.load(f)
            for v in catalog.get("voices", []):
                p = MODELS_DIR / v["modelFile"]
                mark = "present" if p.exists() else "missing"
                print(f"  {v['voiceId']:18s} {mark}")
        return

    contentvec_ok = setup_contentvec(force=args.force)
    voice_status  = setup_voice_models(force=args.force) if contentvec_ok else {}
    print_summary(contentvec_ok, voice_status)


if __name__ == "__main__":
    main()
