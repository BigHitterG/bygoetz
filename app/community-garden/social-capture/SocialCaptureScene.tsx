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

export type SocialCaptureRecipe = "garden-status" | "watering-how-to" | "builder-mode" | "daily-task-three-varieties" | "rose-life-cycle";

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
  action: "walk" | "build";
  mode: "community" | "personal";
};

type BulletinOverlay = { header?: string; gameplayLabel?: string; progressLabel?: string; progressValue?: string; footer?: string };

const WATERING_ROUNDS: WateringRound[] = [
  { station: [-4, -3], targets: [[-5, -4, "lavender"], [-4, -4, "rose"], [-5, -2, "daisy"]] },
  { station: [1, -4], targets: [[1, -5, "sunflower"], [2, -5, "tulip"], [3, -4, "bee_balm"]] },
  { station: [4, -1], targets: [[5, -2, "rose"], [5, 0, "lavender"], [4, 1, "daisy"]] },
  { station: [3, 4], targets: [[4, 4, "sunflower"], [3, 5, "bee_balm"], [2, 5, "tulip"]] },
  { station: [-2, 5], targets: [[-3, 5, "rose"], [-2, 4, "daisy"], [-1, 5, "lavender"]] },
  { station: [-5, 1], targets: [[-6, 2, "sunflower"], [-6, 0, "tulip"], [-4, 1, "bee_balm"]] },
];

const PLANTING_SCENES: Record<"garden-status" | "builder-mode" | "daily-task-three-varieties", PlantingScene> = {
  "garden-status": {
    targets: [[-6, 2, "rose"], [-3, -1, "lavender"], [0, 2, "sunflower"], [3, -1, "bee_balm"], [6, 2, "tulip"]],
    background: [[-7, -4, "lavender"], [-5, -4, "rose"], [-3, -4, "daisy"], [-1, -4, "sunflower"], [1, -4, "tulip"], [3, -4, "bee_balm"], [5, -4, "rose"], [7, -4, "lavender"], [-7, 5, "sunflower"], [-5, 5, "tulip"], [-3, 5, "bee_balm"], [-1, 5, "rose"], [1, 5, "lavender"], [3, 5, "daisy"], [5, 5, "sunflower"], [7, 5, "tulip"]],
    camera: [0, 0],
    header: "Today's shared garden",
    gameplayLabel: "Garden status",
    progressLabel: "flowers growing",
    action: "walk",
    mode: "community",
  },
  "builder-mode": {
    // Builder Mode extends one orthogonally neighboring cell at a time. This
    // connected path deliberately mirrors that rule instead of jumping across
    // the isometric screen on a diagonal.
    targets: [[-4, -1, "rose"], [-3, -1, "rose"], [-2, -1, "rose"], [-2, 0, "rose"], [-1, 0, "rose"], [0, 0, "rose"]],
    background: [
      [-6, -4, "rose"], [-5, -4, "rose"], [-4, -4, "lavender"], [-3, -4, "rose"], [-2, -4, "rose"],
      [0, -4, "rose"], [1, -4, "lavender"], [2, -4, "rose"], [3, -4, "rose"], [4, -4, "rose"],
      [-6, 3, "rose"], [-5, 3, "rose"], [-4, 3, "sunflower"], [-3, 3, "rose"], [-2, 3, "rose"],
      [0, 3, "rose"], [1, 3, "lavender"], [2, 3, "rose"], [3, 3, "rose"], [4, 3, "rose"],
      [-6, 1, "lavender"], [4, 1, "sunflower"], [-6, -2, "rose"], [4, -2, "rose"],
    ],
    camera: [0, 0],
    header: "My Garden builder mode",
    gameplayLabel: "Layout preview",
    progressLabel: "cells planned",
    action: "build",
    mode: "personal",
  },
  "daily-task-three-varieties": {
    targets: [[-3, 0, "rose"], [0, 0, "lavender"], [3, 0, "sunflower"]],
    background: [
      [-7, -4, "daisy"], [-5, -4, "bee_balm"], [-3, -4, "tulip"], [-1, -4, "daisy"], [1, -4, "bee_balm"], [3, -4, "tulip"], [5, -4, "daisy"], [7, -4, "bee_balm"],
      [-7, 5, "tulip"], [-5, 5, "daisy"], [-3, 5, "bee_balm"], [-1, 5, "tulip"], [1, 5, "daisy"], [3, 5, "bee_balm"], [5, 5, "tulip"], [7, 5, "daisy"],
    ],
    camera: [0, 0],
    header: "Garden Task: A Varied Garden",
    gameplayLabel: "Task progress",
    progressLabel: "different varieties",
    action: "build",
    mode: "community",
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
    if (scene.action === "walk" || seconds >= index * ROUND_SECONDS + ACTION_START_SECONDS) {
      plants.push(plantRecord(`social-planted-${index}`, target));
    }
  });
  return plants;
}

function plantingSelectionAt(scene: PlantingScene, seconds: number): SelectedCell {
  if (scene.action === "walk") return null;
  const { target, phase } = plantingState(scene, seconds);
  return phase >= 0.82 && phase <= 1.9 ? { gridX: target[0], gridY: target[1] } : null;
}

function plantingEffectsAt(scene: PlantingScene, seconds: number): GardenEffect[] {
  if (scene.action === "walk") return [];
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
      setBulletinOverlay: (overlay: BulletinOverlay) => Promise<void>;
      dimensions: { width: number; height: number };
    };
  }
}

export function SocialCaptureScene({ scene: requestedScene }: { scene: string }) {
  const scene: SocialCaptureRecipe = requestedScene === "garden-status" || requestedScene === "builder-mode" || requestedScene === "daily-task-three-varieties" || requestedScene === "rose-life-cycle"
    ? requestedScene
    : "watering-how-to";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lifecycleImageRef = useRef<HTMLImageElement>(null);
  const [seconds, setSeconds] = useState(0);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>(FALLBACK_CAPTIONS);
  const [overlay, setOverlay] = useState<BulletinOverlay>({});
  const [lifecycleReady, setLifecycleReady] = useState(false);
  const plantingScene = scene === "garden-status" || scene === "builder-mode" || scene === "daily-task-three-varieties" ? PLANTING_SCENES[scene] : null;

  const draw = useCallback((captureSeconds: number) => {
    if (scene === "rose-life-cycle") return;
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
      zoom: scene === "garden-status" ? 3.9 : scene === "builder-mode" ? 4.65 : scene === "daily-task-three-varieties" ? 4.25 : 4.5,
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
      mode: plantingScene?.mode ?? "community",
      personalGarden: plantingScene?.mode === "personal" ? {
        minX: -7, minY: -6, width: 15, height: 13, maxWidth: 15, maxHeight: 13,
        elements: [], paths: [{ gridX: -5, gridY: 0 }, { gridX: -4, gridY: 0 }, { gridX: -3, gridY: 0 }],
        nextExpansion: null,
      } : undefined,
      builderPreview: plantingScene?.action === "build" ? {
        mode: "place",
        cells: plantingScene.targets.slice(0, Math.max(1, Math.floor(captureSeconds / ROUND_SECONDS) + 1)).map(([gridX, gridY]) => ({ gridX, gridY })),
        invalidCell: null,
      } : undefined,
      reducedMotion: false,
    });
  }, [plantingScene, scene]);

  useEffect(() => draw(seconds), [draw, seconds]);
  useEffect(() => {
    if (scene !== "rose-life-cycle") return;
    const image = lifecycleImageRef.current;
    if (!image) return;
    if (image.complete && image.naturalWidth > 0) {
      setLifecycleReady(true);
      return;
    }
    const markReady = () => setLifecycleReady(true);
    image.addEventListener("load", markReady, { once: true });
    return () => image.removeEventListener("load", markReady);
  }, [scene]);
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
      setBulletinOverlay: async (nextOverlay) => {
        setOverlay(nextOverlay);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
    };
    return () => { delete window.__BASIL_SOCIAL_CAPTURE__; };
  }, []);

  const cue = captionCues.find((candidate) => seconds >= candidate.start && seconds < candidate.end);
  const activeWordIndex = useMemo(() => cue?.words?.findIndex((word) => seconds >= word.start && seconds < word.end) ?? -1, [cue, seconds]);
  const finalCue = captionCues.at(-1);
  const isClosing = seconds >= (finalCue?.start ?? 18);
  const lifecycleStages = ["Dormant seed", "New seedling", "Flower bud", "First bloom"];
  const lifecycleStageIndex = Math.min(lifecycleStages.length - 1, Math.floor(seconds / 4.2));
  const progress = plantingScene
    ? Math.min(plantingScene.targets.length, Math.max(0, Math.floor((seconds - ACTION_START_SECONDS) / ROUND_SECONDS) + 1))
    : wateringState(seconds).absoluteRound * 3 + (wateringState(seconds).phase >= ACTION_START_SECONDS ? 3 : 0);
  const header = overlay.header ?? plantingScene?.header ?? "How watering works";
  const gameplayLabel = overlay.gameplayLabel ?? plantingScene?.gameplayLabel ?? "Two-tap watering";
  const progressLabel = overlay.progressLabel ?? plantingScene?.progressLabel ?? "flowers watered";
  const progressValue = scene === "rose-life-cycle" ? lifecycleStages[lifecycleStageIndex] : overlay.progressValue ?? String(progress);
  const lifecycleTransform = ["translate(0, 0)", "translate(-50%, 0)", "translate(0, -50%)", "translate(-50%, -50%)"][lifecycleStageIndex];

  return (
    <main className={styles.capture} data-capture-ready={scene === "rose-life-cycle" ? (lifecycleReady ? "true" : "false") : "true"} data-time={seconds.toFixed(3)} data-scene={scene}>
      {scene === "rose-life-cycle" ? (
        <div className={styles.lifecycleVisual} aria-label="AI-generated botanical sequence showing a rose from seed to first bloom">
          {/* The source is a documented AI-generated educational plate, never gameplay. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={lifecycleImageRef}
            src="/basil-social/rose-first-bloom-v1.png"
            alt="Four realistic botanical stages of a rose reaching its first bloom"
            onLoad={() => setLifecycleReady(true)}
            style={{ transform: lifecycleTransform }}
          />
        </div>
      ) : (
        <canvas ref={canvasRef} width={CAPTURE_WIDTH} height={CAPTURE_HEIGHT} aria-label={`Basil ${gameplayLabel.toLowerCase()} gameplay`} />
      )}
      <div className={styles.vignette} aria-hidden="true" />
      <header className={styles.header}><span>{header}</span><strong>{scene === "rose-life-cycle" ? "ROSE Â· 4 STAGES" : "BASIL"}</strong></header>
      <aside className={styles.gameplayStatus} aria-label="Story progress"><span>{gameplayLabel}</span><strong>{scene === "rose-life-cycle" ? progressValue : `${progressValue} ${progressLabel}`}</strong></aside>
      <section className={`${styles.caption} ${isClosing ? styles.captionClosing : ""}`} aria-live="off">
        <p>{cue?.words?.length
          ? cue.words.map((word, index) => <span className={index === activeWordIndex ? styles.activeWord : index < activeWordIndex ? styles.spokenWord : undefined} key={`${word.start}-${word.text}`}>{word.text}{index < cue.words!.length - 1 ? " " : ""}</span>)
          : cue?.text ?? "Basil Community Garden"}</p>
      </section>
      <footer className={`${styles.footer} ${isClosing ? styles.footerVisible : ""}`}><span>{overlay.footer ?? "Play free in your browser."}</span><strong>basilcommunitygarden.com</strong></footer>
    </main>
  );
}

