"""Generate Basil narration audio and exact word timings with Edge TTS."""

import argparse
import asyncio
import json
import os
from pathlib import Path

import edge_tts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipe", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--timings", required=True)
    return parser.parse_args()


async def synthesize(args: argparse.Namespace) -> None:
    recipe = json.loads(Path(args.recipe).read_text(encoding="utf-8"))
    narration = recipe.get("narration")
    if not isinstance(narration, str) or not narration.strip():
        raise ValueError("The Basil social recipe has no narration.")

    audio_path = Path(args.audio)
    timing_path = Path(args.timings)
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    timing_path.parent.mkdir(parents=True, exist_ok=True)

    voice = os.environ.get("BASIL_SOCIAL_TTS_VOICE", "en-US-AvaNeural")
    rate = os.environ.get("BASIL_SOCIAL_TTS_RATE", "+0%")
    pitch = os.environ.get("BASIL_SOCIAL_TTS_PITCH", "+0Hz")
    volume = os.environ.get("BASIL_SOCIAL_TTS_VOLUME", "+0%")
    communicator = edge_tts.Communicate(
        narration,
        voice,
        rate=rate,
        pitch=pitch,
        volume=volume,
        boundary="WordBoundary",
    )

    timings = []
    audio_bytes = 0
    with audio_path.open("wb") as audio_file:
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
                audio_bytes += len(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start_ms = chunk["offset"] / 10_000
                end_ms = (chunk["offset"] + chunk["duration"]) / 10_000
                timings.append({
                    "text": chunk["text"],
                    "start": start_ms,
                    "end": end_ms,
                })

    if audio_bytes < 10_000:
        raise RuntimeError("Neural narration audio was unexpectedly empty.")
    if not timings:
        raise RuntimeError("Edge TTS returned no word-boundary timing data.")
    timing_path.write_text(json.dumps(timings, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(synthesize(parse_args()))
