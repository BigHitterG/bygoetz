"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const AUDIO_SETTINGS_KEY = "basil-audio-settings-v1";
const MUSIC_BPM = 72;

export type GardenSound =
  | "plant"
  | "water"
  | "care"
  | "blossom"
  | "worm"
  | "unlock"
  | "inventory"
  | "select"
  | "builder"
  | "uproot"
  | "path"
  | "element"
  | "expand"
  | "world"
  | "error";

export type GardenAudioSettings = {
  musicEnabled: boolean;
  soundEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
};

export type GardenAudioControls = {
  settings: GardenAudioSettings;
  play: (sound: GardenSound) => void;
  toggleMusic: () => void;
  toggleSound: () => void;
  setMusicVolume: (volume: number) => void;
  setSoundVolume: (volume: number) => void;
  toggleMuteAll: () => void;
};

const DEFAULT_SETTINGS: GardenAudioSettings = {
  musicEnabled: true,
  soundEnabled: true,
  musicVolume: 0.22,
  soundVolume: 0.62,
};

const SOUND_THROTTLES: Partial<Record<GardenSound, number>> = {
  plant: 90,
  water: 80,
  care: 140,
  inventory: 120,
  select: 60,
  unlock: 600,
  error: 300,
};

type SafariWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function clampVolume(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function normalizeSettings(
  value: Partial<GardenAudioSettings> | null | undefined,
): GardenAudioSettings {
  return {
    musicEnabled:
      typeof value?.musicEnabled === "boolean"
        ? value.musicEnabled
        : DEFAULT_SETTINGS.musicEnabled,
    soundEnabled:
      typeof value?.soundEnabled === "boolean"
        ? value.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
    musicVolume: clampVolume(
      typeof value?.musicVolume === "number"
        ? value.musicVolume
        : DEFAULT_SETTINGS.musicVolume,
    ),
    soundVolume: clampVolume(
      typeof value?.soundVolume === "number"
        ? value.soundVolume
        : DEFAULT_SETTINGS.soundVolume,
    ),
  };
}

function readSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    return normalizeSettings(
      JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_KEY) ?? "null") as
        | Partial<GardenAudioSettings>
        | null,
    );
  } catch {
    return DEFAULT_SETTINGS;
  }
}

class BasilAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private soundGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicBar = 0;
  private unlocked = false;
  private settings = DEFAULT_SETTINGS;
  private lastPlayed = new Map<GardenSound, number>();

  configure(settings: GardenAudioSettings) {
    this.settings = normalizeSettings(settings);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          AUDIO_SETTINGS_KEY,
          JSON.stringify(this.settings),
        );
      } catch {
        // Restricted storage should not prevent the current session from playing.
      }
    }
    this.applyVolumes();
    if (this.settings.musicEnabled) this.startMusic();
    else this.stopMusic();
  }

  async unlock() {
    const context = this.ensureContext();
    if (!context) return;
    try {
      if (context.state === "suspended") await context.resume();
      this.unlocked = context.state === "running";
      this.applyVolumes();
      if (this.settings.musicEnabled) this.startMusic();
    } catch {
      // Safari can require another direct gesture; the next gesture retries.
    }
  }

  setHidden(hidden: boolean) {
    if (hidden) {
      this.stopMusic();
    } else if (this.settings.musicEnabled) {
      this.startMusic();
    }
  }

  play(sound: GardenSound) {
    if (!this.settings.soundEnabled || !this.unlocked) return;
    const context = this.context;
    const destination = this.soundGain;
    if (!context || !destination || context.state !== "running") return;

    const nowMs = performance.now();
    const throttle = SOUND_THROTTLES[sound] ?? 40;
    if (nowMs - (this.lastPlayed.get(sound) ?? 0) < throttle) return;
    this.lastPlayed.set(sound, nowMs);

    const now = context.currentTime;
    if (sound === "plant") {
      this.noise(now, 0.11, 0.045, destination);
      this.tone(246.94, now + 0.03, 0.13, 0.075, "triangle", destination, 329.63);
    } else if (sound === "water") {
      this.noise(now, 0.16, 0.035, destination, 1450);
      this.tone(523.25, now, 0.12, 0.036, "sine", destination, 659.25);
    } else if (sound === "care") {
      this.tone(659.25, now, 0.1, 0.07, "triangle", destination);
      this.tone(880, now + 0.075, 0.14, 0.065, "sine", destination);
    } else if (sound === "blossom") {
      [880, 1108.73, 1318.51].forEach((frequency, index) => {
        this.tone(frequency, now + index * 0.09, 0.28, 0.075, "sine", destination);
      });
    } else if (sound === "worm") {
      this.tone(196, now, 0.09, 0.07, "square", destination, 246.94);
      this.tone(293.66, now + 0.09, 0.13, 0.055, "triangle", destination, 220);
    } else if (sound === "unlock") {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        this.tone(frequency, now + index * 0.1, 0.32, 0.07, "triangle", destination);
      });
    } else if (sound === "inventory") {
      this.tone(311.13, now, 0.07, 0.05, "square", destination, 277.18);
      this.noise(now, 0.055, 0.025, destination, 900);
    } else if (sound === "select") {
      this.tone(440, now, 0.055, 0.035, "sine", destination, 493.88);
    } else if (sound === "builder") {
      this.tone(220, now, 0.09, 0.06, "square", destination);
      this.tone(329.63, now + 0.06, 0.14, 0.055, "triangle", destination);
    } else if (sound === "uproot") {
      this.noise(now, 0.13, 0.045, destination, 650);
      this.tone(293.66, now, 0.12, 0.045, "triangle", destination, 196);
    } else if (sound === "path") {
      this.noise(now, 0.08, 0.04, destination, 500);
      this.tone(174.61, now, 0.08, 0.045, "square", destination);
    } else if (sound === "element") {
      this.tone(164.81, now, 0.1, 0.06, "triangle", destination);
      this.tone(246.94, now + 0.055, 0.15, 0.05, "sine", destination);
    } else if (sound === "expand") {
      [261.63, 329.63, 392].forEach((frequency, index) => {
        this.tone(frequency, now + index * 0.09, 0.28, 0.06, "triangle", destination);
      });
    } else if (sound === "world") {
      this.tone(392, now, 0.11, 0.045, "sine", destination);
      this.tone(523.25, now + 0.09, 0.17, 0.04, "sine", destination);
    } else {
      this.tone(196, now, 0.13, 0.055, "sawtooth", destination, 155.56);
    }
  }

  private ensureContext() {
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;
    const AudioContextClass =
      window.AudioContext ?? (window as SafariWindow).webkitAudioContext;
    if (!AudioContextClass) return null;

    const context = new AudioContextClass();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.24;
    const masterGain = context.createGain();
    const soundGain = context.createGain();
    const musicGain = context.createGain();
    soundGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(context.destination);
    this.context = context;
    this.masterGain = masterGain;
    this.soundGain = soundGain;
    this.musicGain = musicGain;
    this.applyVolumes();
    return context;
  }

  private applyVolumes() {
    const now = this.context?.currentTime ?? 0;
    this.masterGain?.gain.setTargetAtTime(0.8, now, 0.02);
    this.soundGain?.gain.setTargetAtTime(
      this.settings.soundEnabled ? this.settings.soundVolume : 0,
      now,
      0.02,
    );
    this.musicGain?.gain.setTargetAtTime(
      this.settings.musicEnabled ? this.settings.musicVolume : 0,
      now,
      0.08,
    );
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    destination: AudioNode,
    endFrequency?: number,
  ) {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        start + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(
    start: number,
    duration: number,
    volume: number,
    destination: AudioNode,
    cutoff = 1000,
  ) {
    const context = this.context;
    if (!context) return;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(start);
  }

  private startMusic() {
    const context = this.context;
    if (
      !this.unlocked ||
      !this.settings.musicEnabled ||
      !context ||
      context.state !== "running" ||
      this.musicTimer !== null ||
      (typeof document !== "undefined" && document.hidden)
    ) {
      return;
    }
    this.scheduleMusicBar();
    const barMs = (60 / MUSIC_BPM) * 4 * 1000;
    this.musicTimer = window.setInterval(() => this.scheduleMusicBar(), barMs);
  }

  private stopMusic() {
    if (this.musicTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.musicTimer);
    }
    this.musicTimer = null;
  }

  private scheduleMusicBar() {
    const context = this.context;
    const destination = this.musicGain;
    if (!context || !destination || !this.settings.musicEnabled) return;
    const beat = 60 / MUSIC_BPM;
    const start = context.currentTime + 0.06;
    const roots = [130.81, 110, 146.83, 98];
    const melodies = [
      [523.25, 659.25, 587.33],
      [440, 523.25, 659.25],
      [587.33, 493.88, 440],
      [392, 440, 523.25],
    ];
    const chordIndex = this.musicBar % roots.length;
    const root = roots[chordIndex];
    this.tone(root, start, beat * 3.8, 0.055, "sine", destination);
    this.tone(root * 1.5, start + 0.03, beat * 3.65, 0.035, "triangle", destination);
    melodies[chordIndex].forEach((frequency, index) => {
      this.tone(
        frequency,
        start + beat * (0.5 + index * 1.05),
        beat * 0.72,
        0.034,
        "triangle",
        destination,
      );
    });
    if (this.musicBar % 4 === 3) {
      this.tone(1046.5, start + beat * 3.35, beat * 0.3, 0.018, "sine", destination, 1318.51);
    }
    this.musicBar += 1;
  }
}

const audioEngine = new BasilAudioEngine();

export function useGardenAudio(): GardenAudioControls {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    audioEngine.configure(settings);
  }, [settings]);

  useEffect(() => {
    const unlock = () => void audioEngine.unlock();
    const visibility = () => audioEngine.setHidden(document.hidden);
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      audioEngine.setHidden(true);
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const update = useCallback(
    (change: Partial<GardenAudioSettings>) => {
      setSettings((current) => {
        const next = normalizeSettings({ ...current, ...change });
        return next;
      });
      void audioEngine.unlock();
    },
    [],
  );

  const play = useCallback((sound: GardenSound) => {
    audioEngine.play(sound);
  }, []);

  return useMemo(
    () => ({
      settings,
      play,
      toggleMusic: () => update({ musicEnabled: !settings.musicEnabled }),
      toggleSound: () => update({ soundEnabled: !settings.soundEnabled }),
      setMusicVolume: (musicVolume: number) => update({ musicVolume }),
      setSoundVolume: (soundVolume: number) => update({ soundVolume }),
      toggleMuteAll: () => {
        const muted = settings.musicEnabled || settings.soundEnabled;
        update({ musicEnabled: !muted, soundEnabled: !muted });
      },
    }),
    [play, settings, update],
  );
}
