"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  gridToWorld,
  renderGarden,
  type GardenEffect,
  type SelectedCell,
  type WorldPoint,
} from "../game/gardenRenderer";
import type { PlantRecord, PlantType } from "../lib/roseLifecycle";
import recipe from "@/content/basil-social/today.json";
import styles from "./social-capture.module.css";

const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 1920;
const BASE_DATE = Date.parse("2026-07-31T12:00:00.000Z");
const ROUND_SECONDS = 3;
const WATER_START_SECONDS = 1.25;

type TimedWord = { text: string; start: number; end: number };
type CaptionCue = {
  text: string;
  start: number;
  end: number;
  words?: TimedWord[];
};

type WateringRound = {
  station: [number, number];
  targets: Array<[number, number, PlantType]>;
};

const WATERING_ROUNDS: WateringRound[] = [
  { station: [-4, -3], targets: [[-5, -4, "lavender"], [-4, -4, "rose"], [-5, -2, "daisy"]] },
  { station: [1, -4], targets: [[1, -5, "sunflower"], [2, -5, "tulip"], [3, -4, "bee_balm"]] },
  { station: [4, -1], targets: [[5, -2, "rose"], [5, 0, "lavender"], [4, 1, "daisy"]] },
  { station: [3, 4], targets: [[4, 4, "sunflower"], [3, 5, "bee_balm"], [2, 5, "tulip"]] },
  { station: [-2, 5], targets: [[-3, 5, "rose"], [-2, 4, "daisy"], [-1, 5, "lavender"]] },
  { station: [-5, 1], targets: [[-6, 2, "sunflower"], [-6, 0, "tulip"], [-4, 1, "bee_balm"]] },
  { station: [-1, 0], targets: [[-2, -1, "rose"], [0, -1, "lavender"], [0, 1, "daisy"]] },
  { station: [2, 1], targets: [[1, 2, "sunflower"], [2, 2, "tulip"], [3, 1, "bee_balm"]] },
];

const FALLBACK_CAPTIONS: CaptionCue[] = recipe.beats.map((beat) => ({
  start: beat.start,
  end: beat.end,
  text: beat.text,
}));

function roundState(seconds: number) {
  const absoluteRound = Math.floor(Math.max(0, seconds) / ROUND_SECONDS);
  return {
    absoluteRound,
    roundIndex: absoluteRound % WATERING_ROUNDS.length,
    phase: Math.max(0, seconds) % ROUND_SECONDS,
    roundStartedAt: absoluteRound * ROUND_SECONDS,
  };
}

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function interpolatePoint(start: WorldPoint, end: WorldPoint, amount: number): WorldPoint {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

function maryAt(seconds: number) {
  const { roundIndex, phase } = roundState(seconds);
  const previousRound = WATERING_ROUNDS[(roundIndex + WATERING_ROUNDS.length - 1) % WATERING_ROUNDS.length];
  const currentRound = WATERING_ROUNDS[roundIndex];
  const previous = gridToWorld(previousRound.station[0], previousRound.station[1]);
  const current = gridToWorld(currentRound.station[0], currentRound.station[1]);
  return interpolatePoint(previous, current, smoothstep(phase / 1.05));
}

function lastWateredAt(roundIndex: number, seconds: number) {
  const completedRounds = Math.floor(Math.max(0, seconds - WATER_START_SECONDS) / ROUND_SECONDS);
  const completedCycle = Math.floor(completedRounds / WATERING_ROUNDS.length);
  const completedIndex = completedRounds % WATERING_ROUNDS.length;
  const wasWatered = completedRounds >= 0 && (roundIndex <= completedIndex || completedCycle > 0);
  return new Date(wasWatered ? BASE_DATE : BASE_DATE - 24 * 60 * 60 * 1000).toISOString();
}

function plantsAt(seconds: number): PlantRecord[] {
  return WATERING_ROUNDS.flatMap((round, roundIndex) =>
    round.targets.map(([gridX, gridY, plantType], targetIndex) => ({
      id: `social-watering-${roundIndex}-${targetIndex}`,
      grid_x: gridX,
      grid_y: gridY,
      plant_type: plantType,
      planted_at: new Date(BASE_DATE - 9 * 24 * 60 * 60 * 1000).toISOString(),
      last_watered_at: lastWateredAt(roundIndex, seconds),
      created_at: new Date(BASE_DATE - 9 * 24 * 60 * 60 * 1000).toISOString(),
      permanent: true,
    })),
  );
}

function selectionAt(seconds: number): {
  selected: SelectedCell;
  wateringTargets: Array<NonNullable<SelectedCell>>;
} {
  const { roundIndex, phase } = roundState(seconds);
  if (phase < 0.82 || phase > 2.45) return { selected: null, wateringTargets: [] };
  const targets = WATERING_ROUNDS[roundIndex].targets.map(([gridX, gridY], targetIndex) => ({
    gridX,
    gridY,
    plantId: `social-watering-${roundIndex}-${targetIndex}`,
  }));
  return { selected: targets[0], wateringTargets: targets };
}

function effectsAt(seconds: number, mary: WorldPoint): GardenEffect[] {
  const { roundIndex, phase, roundStartedAt } = roundState(seconds);
  const targets = WATERING_ROUNDS[roundIndex].targets;
  const effects: GardenEffect[] = [];
  if (phase >= WATER_START_SECONDS && phase <= WATER_START_SECONDS + 0.9) {
    targets.forEach(([gridX, gridY], index) => {
      const delay = index * 0.055;
      effects.push({
        kind: "spray",
        fromX: mary.x,
        fromY: mary.y,
        gridX,
        gridY,
        startedAt: BASE_DATE + (roundStartedAt + WATER_START_SECONDS + delay) * 1000,
      });
      effects.push({
        kind: "water",
        gridX,
        gridY,
        startedAt: BASE_DATE + (roundStartedAt + WATER_START_SECONDS + delay + 0.08) * 1000,
      });
    });
  }
  if (phase >= 2.02 && phase <= 2.92) {
    const target = gridToWorld(targets[1][0], targets[1][1]);
    effects.push({
      kind: "care",
      x: target.x,
      y: target.y,
      value: 3,
      startedAt: BASE_DATE + (roundStartedAt + 2.02) * 1000,
    });
  }
  return effects;
}

declare global {
  interface Window {
    __BASIL_SOCIAL_CAPTURE__?: {
      setTime: (seconds: number) => Promise<void>;
      setCaptionCues: (cues: CaptionCue[]) => Promise<void>;
      dimensions: { width: number; height: number };
    };
  }
}

export function SocialCaptureScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seconds, setSeconds] = useState(0);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>(FALLBACK_CAPTIONS);

  const draw = useCallback((captureSeconds: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const mary = maryAt(captureSeconds);
    const duck = maryAt(Math.max(0, captureSeconds - 0.72));
    const cameraBase = gridToWorld(0, 0);
    const selection = selectionAt(captureSeconds);
    renderGarden(context, {
      viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      camera: { x: cameraBase.x, y: cameraBase.y + 92 },
      zoom: 4.4,
      mary,
      duck: { x: duck.x - 24, y: duck.y + 18 },
      plants: plantsAt(captureSeconds),
      weeds: [],
      selected: selection.selected,
      wateringTargets: selection.wateringTargets,
      wateringCareReadyPlantIds: new Set(plantsAt(captureSeconds).map((plant) => plant.id)),
      wateringCareStatusLoaded: true,
      suggestedPlantingCell: null,
      suggestedWateringCell: null,
      gardenWorms: [],
      tutorialDimmed: false,
      effects: effectsAt(captureSeconds, mary),
      moving: roundState(captureSeconds).phase < 1.05,
      now: BASE_DATE + captureSeconds * 1000,
      mode: "community",
      reducedMotion: false,
    });
  }, []);

  useEffect(() => {
    draw(seconds);
  }, [draw, seconds]);

  useEffect(() => {
    window.__BASIL_SOCIAL_CAPTURE__ = {
      dimensions: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      setTime: async (nextSeconds: number) => {
        setSeconds(nextSeconds);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      setCaptionCues: async (nextCues: CaptionCue[]) => {
        setCaptionCues(nextCues);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
    };
    return () => {
      delete window.__BASIL_SOCIAL_CAPTURE__;
    };
  }, []);

  const cue = captionCues.find((candidate) => seconds >= candidate.start && seconds < candidate.end);
  const activeWordIndex = useMemo(
    () => cue?.words?.findIndex((word) => seconds >= word.start && seconds < word.end) ?? -1,
    [cue, seconds],
  );
  const finalCue = captionCues.at(-1);
  const isClosing = seconds >= (finalCue?.start ?? recipe.durationSeconds - 4);
  const { absoluteRound, phase } = roundState(seconds);
  const wateredFlowers = absoluteRound * 3 + (phase >= WATER_START_SECONDS ? 3 : 0);

  return (
    <main className={styles.capture} data-capture-ready="true" data-time={seconds.toFixed(3)}>
      <canvas ref={canvasRef} width={CAPTURE_WIDTH} height={CAPTURE_HEIGHT} aria-label="Basil watering gameplay" />
      <div className={styles.vignette} aria-hidden="true" />
      <header className={styles.header}>
        <span>{recipe.header}</span>
        <strong>BASIL</strong>
      </header>
      <aside className={styles.gameplayStatus} aria-label="Gameplay task progress">
        <span>{recipe.gameplayLabel}</span>
        <strong>{wateredFlowers} {recipe.gameplayProgressLabel}</strong>
      </aside>
      <section className={`${styles.caption} ${isClosing ? styles.captionClosing : ""}`} aria-live="off">
        <p>
          {cue?.words?.length
            ? cue.words.map((word, index) => (
                <span
                  className={index === activeWordIndex ? styles.activeWord : index < activeWordIndex ? styles.spokenWord : undefined}
                  key={`${word.start}-${word.text}`}
                >
                  {word.text}{index < cue.words!.length - 1 ? " " : ""}
                </span>
              ))
            : cue?.text ?? recipe.hook}
        </p>
      </section>
      <footer className={`${styles.footer} ${isClosing ? styles.footerVisible : ""}`}>
        <span>{recipe.outroLine}</span>
        <strong>{recipe.outroUrl}</strong>
      </footer>
    </main>
  );
}
