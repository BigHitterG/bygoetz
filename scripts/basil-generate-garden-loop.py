"""Generate Basil's original deterministic upbeat woodland-game music loop."""

import argparse
import math
import wave
from array import array
from pathlib import Path

SAMPLE_RATE = 32_000
BPM = 112.0
BEAT = 60.0 / BPM


def frequency(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def add_voice(left: array, right: array, start: float, duration: float, note: int, amplitude: float, pan: float, voice: str) -> None:
    start_frame = max(0, int(start * SAMPLE_RATE))
    frames = min(len(left) - start_frame, int(duration * SAMPLE_RATE))
    if frames <= 0:
        return
    hz = frequency(note)
    left_gain = math.cos(pan * math.pi / 2.0)
    right_gain = math.sin(pan * math.pi / 2.0)
    for frame in range(frames):
        seconds = frame / SAMPLE_RATE
        attack = min(1.0, seconds / (0.012 if voice == "pluck" else 0.045))
        release = min(1.0, max(0.0, (duration - seconds) / 0.12))
        phase = 2.0 * math.pi * hz * seconds
        if voice == "flute":
            tone = math.sin(phase + 0.012 * math.sin(2 * math.pi * 5.1 * seconds)) + 0.13 * math.sin(2 * phase)
            envelope = attack * release * (0.92 + 0.08 * math.sin(math.pi * min(1.0, seconds / duration)))
        else:
            tone = math.sin(phase) + 0.28 * math.sin(2 * phase) + 0.09 * math.sin(3 * phase)
            envelope = attack * release * math.exp(-3.0 * seconds)
        value = amplitude * tone * envelope
        index = start_frame + frame
        left[index] += value * left_gain
        right[index] += value * right_gain


def add_shaker(left: array, right: array, start: float, amplitude: float) -> None:
    start_frame = int(start * SAMPLE_RATE)
    frames = min(len(left) - start_frame, int(0.055 * SAMPLE_RATE))
    seed = 0xB4511
    for frame in range(max(0, frames)):
        seed = (1664525 * seed + 1013904223) & 0xFFFFFFFF
        noise = ((seed / 0xFFFFFFFF) * 2.0 - 1.0) * math.exp(-58.0 * frame / SAMPLE_RATE)
        left[start_frame + frame] += noise * amplitude
        right[start_frame + frame] += noise * amplitude * 0.82


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    duration = max(1.0, args.duration)
    frames = math.ceil(duration * SAMPLE_RATE)
    left = array("f", [0.0]) * frames
    right = array("f", [0.0]) * frames

    # Original four-bar garden loop: bright suspended harmony and an asymmetrical motif.
    chords = [(50, 57, 62, 66), (55, 62, 66, 69), (47, 54, 59, 62), (45, 52, 57, 62)]
    motif = [(74, 0.0, 0.65), (78, 0.75, 0.35), (76, 1.25, 0.5), (71, 2.0, 0.4), (73, 2.5, 0.75), (69, 3.5, 0.4), (71, 4.0, 0.7), (74, 4.9, 0.55), (69, 5.65, 0.75), (66, 6.65, 0.55)]
    loop_seconds = 16 * BEAT
    loop_start = 0.0
    while loop_start < duration:
        for bar, chord in enumerate(chords):
            bar_start = loop_start + bar * 4 * BEAT
            for beat_index in range(4):
                note = chord[(beat_index * 2 + bar) % len(chord)] + 12
                add_voice(left, right, bar_start + beat_index * BEAT, 0.42, note, 0.085, 0.3 + 0.12 * (beat_index % 3), "pluck")
                add_shaker(left, right, bar_start + beat_index * BEAT, 0.018)
            add_voice(left, right, bar_start, 1.4, chord[0], 0.075, 0.38, "pluck")
        for note, beat_offset, beats_long in motif:
            add_voice(left, right, loop_start + beat_offset * BEAT, beats_long * BEAT, note, 0.082, 0.62, "flute")
        loop_start += loop_seconds

    for delay_seconds, gain in ((0.105, 0.09), (0.235, 0.055)):
        delay = int(delay_seconds * SAMPLE_RATE)
        for index in range(delay, frames):
            old_left = left[index]
            left[index] += right[index - delay] * gain
            right[index] += old_left * gain

    fade_frames = min(frames, int(0.7 * SAMPLE_RATE))
    for index in range(fade_frames):
        left[index] *= index / max(1, fade_frames)
        right[index] *= index / max(1, fade_frames)
        tail = frames - 1 - index
        left[tail] *= index / max(1, fade_frames)
        right[tail] *= index / max(1, fade_frames)

    peak = max(max(abs(value) for value in left), max(abs(value) for value in right), 0.001)
    scale = 0.68 / peak
    pcm = array("h")
    for left_value, right_value in zip(left, right):
        pcm.append(int(max(-1.0, min(1.0, left_value * scale)) * 32767))
        pcm.append(int(max(-1.0, min(1.0, right_value * scale)) * 32767))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(SAMPLE_RATE)
        audio.writeframes(pcm.tobytes())


if __name__ == "__main__":
    main()
