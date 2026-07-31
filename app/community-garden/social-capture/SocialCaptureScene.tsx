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
import styles from "./social-capture.module.css";

const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 1920;
const BASE_DATE = Date.parse("2026-07-31T12:00:00.000Z");
const ROUND_SECONDS = 3;
const ACTION_START_SECONDS = 1.25;

export type SocialCaptureRecipe = "water-chain" | "rose-planting" | "pollinator-transformation";

type TimedWord = { text: string; start: number; end: number };
type CaptionCue = { text: string; start: number; end: number; words?: TimedWord[] };
type GardenTarget = [number, number, PlantType];
type WateringRound = { station: [number, number]; targets: GardenTarget[] };
type PlantingScene = {
  targets: GardenTarget[];
  background: GardenTarget[];
  camera: [number, number];
  header: string;
  gameplayLabel: string;
  progressLabel: string;
};

const WATERING_ROUNDS: WateringRound[] = [
  { station: [-4, -3], targets: [[-5, -4, "lavender"], [-4, -4, "rose"], [-5, -2, "daisy"]] },
  { station: [1, -4], targets: [[1, -5, "sunflower"], [2, -5, "tulip"], [3, -4, "bee_balm"]] },
  { station: [4, -1], targets: [[5, -2, "rose"], [5, 0, "lavender"], [4, 1, "daisy"]] },
  { station: [3, 4], targets: [[4, 4, "sunflower"], [3, 5, "bee_balm"], [2, 5, "tulip"]] },
  { station: [-2, 5], targets: [[-3, 5, "rose"], [-2, 4, "daisy"], [-1, 5, "lavender"]] },
  { station: [-5, 1], targets: [[-6, 2, "sunflower"], [-6, 0, "tulip"], [-4, 1, "bee_balm"]] },
];

const PLANTING_SCENES: Record<Exclude<SocialCaptureRecipe, "water-chain">, PlantingScene> = {
  "rose-planting": {
    targets: [[-4, 1, "rose"], [-2, 0, "rose"], [0, 1, "rose"], [2, 0, "rose"], [4, 1, "rose"], [2, 3, "rose"]],
    background: [[-6, -3, "lavender"], [-3, -4, "rose"], [0, -4, "lavender"], [3, -4, "rose"], [6, -3, "lavender"]],
    camera: [0, 0],
    header: "Planting a rose bed",
    gameplayLabel: "Rose planting",
    progressLabel: "roses planted",
  },
  "pollinator-transformation": {
    targets: [[-3, -1, "bee_balm"], [-1, -2, "sunflower"], [1, -1, "lavender"], [3, -2, "daisy"], [2, 1, "bee_balm"], [0, 2, "sunflower"], [-2, 1, "lavender"]],
    background: [[-6, -4, "tulip"], [-5, -2, "daisy"], [-5, 2, "lavender"], [-3, 4, "sunflower"], [0, 5, "bee_balm"], [3, 4, "daisy"], [5, 2, "tulip"], [5, -2, "lavender"], [4, -4, "sunflower"]],
    camera: [0, 0],
    header: "Building a pollinator corner",
    gameplayLabel: "Garden transformation",
    progressLabel: "flowers added",
  },
};

const FALLBACK_CAPTIONS: CaptionCue[] = [{ start: 0, end: 30, text: "Basil Community Garden" }];

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function interpolatePoint(start: WorldPoint, end: WorldPoint, amount: number): WorldPoint {
  return { x: start.x + (end.x - start.x) * amount, y: start.y + (end.y - start.y) * amount };
}

function plantRecord(id: string, [gridX, gridY, plantType]: GardenTarget, plantedAt = BASE_DATE - 9 * 24 * 60 * 60 * 1000): PlantRecord {
  return {
    id,
    grid_x: gridX,
    grid_y: gridY,
    plant_type: plantType,
    planted_at: new Date(plantedAt).toISOString(),
    last_watered_at: new Date(BASE_DATE).toISOString(),
    created_at: new Date(plantedAt).toISOString(),
    permanent: true,
  };
}

function wateringState(seconds: number) {
  const absoluteRound = Math.floor(Math.max(0, seconds) / ROUND_SECONDS);
  return {
    absoluteRound,
    roundIndex: absoluteRound % WATERING_ROUNDS.length,
    phase: Math.max(0, seconds) % ROUND_SECONDS,
    roundStartedAt: absoluteRound * ROUND_SECONDS,
  };
}

function wateringMaryAt(seconds: number) {
  const { roundIndex, phase } = wateringState(seconds);
  const previousRound = WATERING_ROUNDS[(roundIndex + WATERING_ROUNDS.length - 1) % WATERING_ROUNDS.length];
  const currentRound = WATERING_ROUNDS[roundIndex];
  return interpolatePoint(gridToWorld(...previousRound.station), gridToWorld(...currentRound.station), smoothstep(phase / 1.05));
}

function wateringPlantsAt(seconds: number): PlantRecord[] {
  const completedRounds = Math.floor(Math.max(0, seconds - ACTION_START_SECONDS) / ROUND_SECONDS);
  return WATERING_ROUNDS.flatMap((round, roundIndex) => round.targets.map((target, targetIndex) => {
    const plant = plantRecord(`social-watering-${roundIndex}-${targetIndex}`, target);
    plant.last_watered_at = new Date(roundIndex <= completedRounds ? BASE_DATE : BASE_DATE - 24 * 60 * 60 * 1000).toISOString();
    return plant;
  }));
}

function wateringSelectionAt(seconds: number): { selected: SelectedCell; wateringTargets: Array<NonNullable<SelectedCell>> } {
  const { roundIndex, phase } = wateringState(seconds);
  if (phase < 0.82 || phase > 2.45) return { selected: null, wateringTargets: [] };
  const wateringTargets = WATERING_ROUNDS[roundIndex].targets.map(([gridX, gridY], targetIndex) => ({
    gridX,
    gridY,
    plantId: `social-watering-${roundIndex}-${targetIndex}`,
  }));
  return { selected: wateringTargets[0], wateringTargets };
}

function wateringEffectsAt(seconds: number, mary: WorldPoint): GardenEffect[] {
  const { roundIndex, phase, roundStartedAt } = wateringState(seconds);
  const targets = WATERING_ROUNDS[roundIndex].targets;
  const effects: GardenEffect[] = [];
  if (phase >= ACTION_START_SECONDS && phase <= ACTION_START_SECONDS + 0.9) {
    targets.forEach(([gridX, gridY], index) => {
      const delay = index * 0.055;
      effects.push({ kind: "spray", fromX: mary.x, fromY: mary.y, gridX, gridY, startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS + delay) * 1000 });
      effects.push({ kind: "water", gridX, gridY, startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS + delay + 0.08) * 1000 });
    });
  }
  if (phase >= 2.02 && phase <= 2.92) {
    const target = gridToWorld(targets[1][0], targets[1][1]);
    effects.push({ kind: "care", x: target.x, y: target.y, value: 3, startedAt: BASE_DATE + (roundStartedAt + 2.02) * 1000 });
  }
  return effects;
}

function plantingState(scene: PlantingScene, seconds: number) {
  const cappedSeconds = Math.min(seconds, scene.targets.length * ROUND_SECONDS - 0.01);
  const targetIndex = Math.min(scene.targets.length - 1, Math.floor(cappedSeconds / ROUND_SECONDS));
  return { targetIndex, phase: cappedSeconds % ROUND_SECONDS, target: scene.targets[targetIndex] };
}

function plantingMaryAt(scene: PlantingScene, seconds: number) {
  const { targetIndex, phase } = plantingState(scene, seconds);
  const previousTarget = scene.targets[Math.max(0, targetIndex - 1)];
  const target = scene.targets[targetIndex];
  return interpolatePoint(gridToWorld(previousTarget[0], previousTarget[1]), gridToWorld(target[0], target[1]), smoothstep(phase / 1.05));
}

function plantingPlantsAt(scene: PlantingScene, seconds: number) {
  const plants = scene.background.map((target, index) => plantRecord(`social-background-${index}`, target));
  scene.targets.forEach((target, index) => {
    if (seconds >= index * ROUND_SECONDS + ACTION_START_SECONDS) {
      plants.push(plantRecord(`social-planted-${index}`, target));
    }
  });
  return plants;
}

function plantingSelectionAt(scene: PlantingScene, seconds: number): SelectedCell {
  const { target, phase } = plantingState(scene, seconds);
  return phase >= 0.82 && phase <= 1.9 ? { gridX: target[0], gridY: target[1] } : null;
}

function plantingEffectsAt(scene: PlantingScene, seconds: number): GardenEffect[] {
  const { targetIndex, target, phase } = plantingState(scene, seconds);
  const roundStartedAt = targetIndex * ROUND_SECONDS;
  const effects: GardenEffect[] = [];
  if (phase >= ACTION_START_SECONDS && phase <= ACTION_START_SECONDS + 0.9) {
    effects.push({ kind: "plant", gridX: target[0], gridY: target[1], startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS) * 1000 });
  }
  if (phase >= 2.05 && phase <= 2.9) {
    const point = gridToWorld(target[0], target[1]);
    effects.push({ kind: "care", x: point.x, y: point.y, value: 1, startedAt: BASE_DATE + (roundStartedAt + 2.05) * 1000 });
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

export function SocialCaptureScene({ scene: requestedScene }: { scene: string }) {
  const scene: SocialCaptureRecipe = requestedScene === "rose-planting" || requestedScene === "pollinator-transformation"
    ? requestedScene
    : "water-chain";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seconds, setSeconds] = useState(0);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>(FALLBACK_CAPTIONS);
  const plantingScene = scene === "water-chain" ? null : PLANTING_SCENES[scene];

  const draw = useCallback((captureSeconds: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const mary = plantingScene ? plantingMaryAt(plantingScene, captureSeconds) : wateringMaryAt(captureSeconds);
    const duck = plantingScene ? plantingMaryAt(plantingScene, Math.max(0, captureSeconds - 0.72)) : wateringMaryAt(Math.max(0, captureSeconds - 0.72));
    const selection = plantingScene ? { selected: plantingSelectionAt(plantingScene, captureSeconds), wateringTargets: [] } : wateringSelectionAt(captureSeconds);
    const cameraCell = plantingScene?.camera ?? [0, 0];
    const cameraBase = gridToWorld(cameraCell[0], cameraCell[1]);
    const plants = plantingScene ? plantingPlantsAt(plantingScene, captureSeconds) : wateringPlantsAt(captureSeconds);
    renderGarden(context, {
      viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      camera: { x: cameraBase.x, y: cameraBase.y + 92 },
      zoom: scene === "rose-planting" ? 4.7 : scene === "pollinator-transformation" ? 4.25 : 4.4,
      mary,
      duck: { x: duck.x - 24, y: duck.y + 18 },
      plants,
      weeds: [],
      selected: selection.selected,
      wateringTargets: selection.wateringTargets,
      wateringCareReadyPlantIds: new Set(plants.map((plant) => plant.id)),
      wateringCareStatusLoaded: true,
      suggestedPlantingCell: plantingScene && selection.selected ? selection.selected : null,
      suggestedWateringCell: null,
      gardenWorms: [],
      tutorialDimmed: false,
      effects: plantingScene ? plantingEffectsAt(plantingScene, captureSeconds) : wateringEffectsAt(captureSeconds, mary),
      moving: plantingScene ? plantingState(plantingScene, captureSeconds).phase < 1.05 : wateringState(captureSeconds).phase < 1.05,
      now: BASE_DATE + captureSeconds * 1000,
      mode: "community",
      reducedMotion: false,
    });
  }, [plantingScene, scene]);

  useEffect(() => draw(seconds), [draw, seconds]);
  useEffect(() => {
    window.__BASIL_SOCIAL_CAPTURE__ = {
      dimensions: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      setTime: async (nextSeconds) => {
        setSeconds(nextSeconds);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      setCaptionCues: async (nextCues) => {
        setCaptionCues(nextCues);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
    };
    return () => { delete window.__BASIL_SOCIAL_CAPTURE__; };
  }, []);

  const cue = captionCues.find((candidate) => seconds >= candidate.start && seconds < candidate.end);
  const activeWordIndex = useMemo(() => cue?.words?.findIndex((word) => seconds >= word.start && seconds < word.end) ?? -1, [cue, seconds]);
  const finalCue = captionCues.at(-1);
  const isClosing = seconds >= (finalCue?.start ?? 18);
  const progress = plantingScene
    ? Math.min(plantingScene.targets.length, Math.max(0, Math.floor((seconds - ACTION_START_SECONDS) / ROUND_SECONDS) + 1))
    : wateringState(seconds).absoluteRound * 3 + (wateringState(seconds).phase >= ACTION_START_SECONDS ? 3 : 0);
  const header = plantingScene?.header ?? "Shared garden care";
  const gameplayLabel = plantingScene?.gameplayLabel ?? "Watering chain";
  const progressLabel = plantingScene?.progressLabel ?? "flowers watered";

  return (
    <main className={styles.capture} data-capture-ready="true" data-time={seconds.toFixed(3)} data-scene={scene}>
      <canvas ref={canvasRef} width={CAPTURE_WIDTH} height={CAPTURE_HEIGHT} aria-label={`Basil ${gameplayLabel.toLowerCase()} gameplay`} />
      <div className={styles.vignette} aria-hidden="true" />
      <header className={styles.header}><span>{header}</span><strong>BASIL</strong></header>
      <aside className={styles.gameplayStatus} aria-label="Gameplay task progress"><span>{gameplayLabel}</span><strong>{progress} {progressLabel}</strong></aside>
      <section className={`${styles.caption} ${isClosing ? styles.captionClosing : ""}`} aria-live="off">
        <p>{cue?.words?.length
          ? cue.words.map((word, index) => <span className={index === activeWordIndex ? styles.activeWord : index < activeWordIndex ? styles.spokenWord : undefined} key={`${word.start}-${word.text}`}>{word.text}{index < cue.words!.length - 1 ? " " : ""}</span>)
          : cue?.text ?? "Basil Community Garden"}</p>
      </section>
      <footer className={`${styles.footer} ${isClosing ? styles.footerVisible : ""}`}><span>Plant something for the next person.</span><strong>basilcommunitygarden.com</strong></footer>
    </main>
  );
}
