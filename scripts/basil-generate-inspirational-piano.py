"""Generate a short original inspirational piano bed for Basil social video."""

import argparse
import math
import wave
from array import array
from pathlib import Path

SAMPLE_RATE = 44_100
BPM = 76.0
BEAT = 60.0 / BPM


def frequency(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def add_piano(left: array, right: array, start: float, duration: float, note: int, amplitude: float, pan: float) -> None:
    start_frame = max(0, int(start * SAMPLE_RATE))
    frame_count = min(len(left) - start_frame, int(duration * SAMPLE_RATE))
    if frame_count <= 0:
        return
    hz = frequency(note)
    left_gain = math.cos(pan * math.pi / 2.0)
    right_gain = math.sin(pan * math.pi / 2.0)
    for frame in range(frame_count):
        seconds = frame / SAMPLE_RATE
        attack = min(1.0, seconds / 0.009)
        release = min(1.0, max(0.0, (duration - seconds) / 0.22))
        decay = 0.62 * math.exp(-1.55 * seconds) + 0.38 * math.exp(-4.8 * seconds)
        phase = 2.0 * math.pi * hz * seconds
        tone = (
            math.sin(phase)
            + 0.32 * math.sin(2.0 * phase + 0.15)
            + 0.12 * math.sin(3.0 * phase + 0.32)
            + 0.035 * math.sin(5.0 * phase)
        )
        value = amplitude * attack * release * decay * tone
        index = start_frame + frame
        left[index] += value * left_gain
        right[index] += value * right_gain


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    duration = max(1.0, args.duration)
    frames = math.ceil(duration * SAMPLE_RATE)
    left = array("f", [0.0]) * frames
    right = array("f", [0.0]) * frames

    # Original C-major progression and melody written for this lifecycle reel.
    # It is intentionally independent of any platform or commercial recording.
    chords = [
        (48, 55, 60, 64, 67),   # Cmaj
        (45, 52, 57, 60, 64),   # Am7
        (41, 48, 53, 57, 60),   # Fmaj7
        (43, 50, 55, 60, 62),   # Gsus4/add9
    ]
    melody = [
        (72, 0.0, 1.15), (76, 1.5, 0.75), (79, 2.5, 1.1),
        (69, 4.0, 1.0), (72, 5.25, 0.65), (76, 6.1, 1.25),
        (72, 8.0, 0.8), (69, 9.0, 0.8), (65, 10.1, 1.25),
        (67, 12.0, 0.75), (72, 13.0, 0.9), (74, 14.25, 1.4),
    ]
    loop_seconds = 16.0 * BEAT
    loop_start = 0.0
    while loop_start < duration:
        for bar, chord in enumerate(chords):
            bar_start = loop_start + bar * 4.0 * BEAT
            add_piano(left, right, bar_start, 3.7 * BEAT, chord[0], 0.105, 0.42)
            for beat_index, note in enumerate(chord[1:]):
                add_piano(left, right, bar_start + beat_index * BEAT, 1.25 * BEAT, note + 12, 0.075, 0.38 + 0.08 * beat_index)
        for note, beat_offset, beats_long in melody:
            add_piano(left, right, loop_start + beat_offset * BEAT, beats_long * BEAT, note, 0.09, 0.54)
        loop_start += loop_seconds

    # A restrained stereo room echo keeps the bed warm without obscuring the video.
    for delay_seconds, gain in ((0.14, 0.075), (0.29, 0.045)):
        delay = int(delay_seconds * SAMPLE_RATE)
        for index in range(delay, frames):
            dry_left = left[index]
            left[index] += right[index - delay] * gain
            right[index] += dry_left * gain

    fade_frames = min(frames, int(0.8 * SAMPLE_RATE))
    for index in range(fade_frames):
        fade_in = index / max(1, fade_frames)
        fade_out = index / max(1, fade_frames)
        left[index] *= fade_in
        right[index] *= fade_in
        tail = frames - 1 - index
        left[tail] *= fade_out
        right[tail] *= fade_out

    peak = max(max(abs(value) for value in left), max(abs(value) for value in right), 0.001)
    scale = 0.56 / peak
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

