"""Generate an original, deterministic relaxing piano bed for Basil videos."""

import argparse
import math
import wave
from array import array
from pathlib import Path


SAMPLE_RATE = 32_000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def frequency(midi_note: int) -> float:
    return 440.0 * (2.0 ** ((midi_note - 69) / 12.0))


def add_note(left: array, right: array, start: float, duration: float, midi_note: int, amplitude: float, pan: float) -> None:
    start_frame = max(0, int(start * SAMPLE_RATE))
    note_frames = min(len(left) - start_frame, int(duration * SAMPLE_RATE))
    if note_frames <= 0:
        return
    hz = frequency(midi_note)
    left_gain = math.cos(pan * math.pi / 2.0)
    right_gain = math.sin(pan * math.pi / 2.0)
    for frame in range(note_frames):
        seconds = frame / SAMPLE_RATE
        attack = min(1.0, seconds / 0.018)
        decay = math.exp(-1.05 * seconds) * (0.76 + 0.24 * math.exp(-6.0 * seconds))
        release = min(1.0, max(0.0, (duration - seconds) / 0.32))
        phase = 2.0 * math.pi * hz * seconds
        tone = (
            math.sin(phase)
            + 0.34 * math.sin(2.0 * phase + 0.08)
            + 0.13 * math.sin(3.0 * phase + 0.16)
            + 0.045 * math.sin(4.0 * phase + 0.24)
        )
        value = amplitude * attack * decay * release * tone
        index = start_frame + frame
        left[index] += value * left_gain
        right[index] += value * right_gain


def main() -> None:
    args = parse_args()
    duration = max(1.0, args.duration)
    frame_count = math.ceil(duration * SAMPLE_RATE)
    left = array("f", [0.0]) * frame_count
    right = array("f", [0.0]) * frame_count

    # Cmaj7, Am7, Fmaj7, G6: a slow, original four-bar garden progression.
    progression = [
        (48, 55, 59, 64),
        (45, 52, 55, 60),
        (41, 48, 52, 57),
        (43, 50, 52, 59),
    ]
    bar = 0
    while bar * 4.0 < duration:
        started_at = bar * 4.0
        chord = progression[bar % len(progression)]
        add_note(left, right, started_at, 3.8, chord[0], 0.20, 0.35)
        add_note(left, right, started_at + 0.08, 3.4, chord[1], 0.10, 0.67)
        for step, note in enumerate((chord[1] + 12, chord[2] + 12, chord[3] + 12, chord[2] + 12)):
            add_note(left, right, started_at + 0.28 + step * 0.92, 2.7, note, 0.082, 0.42 + (step % 2) * 0.18)
        bar += 1

    # A pair of short, quiet room reflections keeps the synthesized piano soft.
    for delay_seconds, gain in ((0.17, 0.12), (0.31, 0.07)):
        delay = int(delay_seconds * SAMPLE_RATE)
        for index in range(delay, frame_count):
            left[index] += right[index - delay] * gain
            right[index] += left[index - delay] * gain

    fade_in_frames = min(frame_count, int(1.2 * SAMPLE_RATE))
    fade_out_frames = min(frame_count, int(1.8 * SAMPLE_RATE))
    for index in range(fade_in_frames):
        gain = index / max(1, fade_in_frames)
        left[index] *= gain
        right[index] *= gain
    for offset in range(fade_out_frames):
        gain = (fade_out_frames - offset) / max(1, fade_out_frames)
        index = frame_count - fade_out_frames + offset
        left[index] *= gain
        right[index] *= gain

    peak = max(max(abs(value) for value in left), max(abs(value) for value in right), 0.001)
    scale = 0.70 / peak
    pcm = array("h")
    for left_value, right_value in zip(left, right):
        pcm.append(int(max(-1.0, min(1.0, left_value * scale)) * 32767))
        pcm.append(int(max(-1.0, min(1.0, right_value * scale)) * 32767))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as audio_file:
        audio_file.setnchannels(2)
        audio_file.setsampwidth(2)
        audio_file.setframerate(SAMPLE_RATE)
        audio_file.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main()
