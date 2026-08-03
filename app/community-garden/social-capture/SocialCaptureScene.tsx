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

export type SocialCaptureRecipe = "garden-status" | "garden-composition" | "watering-how-to" | "builder-mode" | "weed-cleanup" | "habitat-discovery" | "daily-care-bonus" | "flower-lifespans" | "heritage-flower-reveal" | "plant-first-flower" | "garden-worm-discovery";

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
  action: "walk" | "build" | "water";
  mode: "community" | "personal";
  careValues?: number[];
  heritageTargetIndex?: number;
  actorStation?: [number, number];
  actorWaypoints?: Array<[number, number]>;
  gardenWorm?: { gridX: number; gridY: number; surfacedAtSeconds: number };
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

const PLANTING_SCENES: Record<"garden-status" | "garden-composition" | "builder-mode" | "daily-care-bonus" | "flower-lifespans" | "heritage-flower-reveal" | "plant-first-flower" | "garden-worm-discovery", PlantingScene> = {
  "garden-status": {
    targets: [[-6, -3, "sunflower"], [-3, 0, "rose"], [0, 3, "lavender"], [3, 0, "tulip"], [6, -3, "bee_balm"]],
    background: [[-7, 4, "rose"], [-5, 3, "lavender"], [-3, 4, "sunflower"], [-1, 3, "daisy"], [1, 4, "tulip"], [3, 3, "bee_balm"], [5, 4, "lavender"], [7, 3, "rose"], [-7, -5, "tulip"], [-5, -4, "sunflower"], [-3, -5, "rose"], [3, -5, "lavender"], [5, -4, "daisy"], [7, -5, "sunflower"]],
    camera: [0, 0],
    header: "Today's shared garden",
    gameplayLabel: "Garden status",
    progressLabel: "flowers growing",
    action: "walk",
    mode: "community",
  },
  "garden-composition": {
    targets: [[-5, -3, "rose"], [-3, -3, "rose"], [-1, -2, "rose"], [-4, 0, "rose"], [-2, 1, "rose"], [0, 0, "rose"], [2, -2, "lavender"], [4, -1, "lavender"], [3, 2, "lavender"], [0, 4, "sunflower"]],
    background: [],
    camera: [0, 0],
    header: "What is growing now",
    gameplayLabel: "Live garden composition",
    progressLabel: "rose share",
    action: "walk",
    mode: "community",
  },
  "builder-mode": {
    targets: [[-4, 0, "lavender"], [-3, 0, "rose"], [-2, 0, "tulip"], [-1, 0, "daisy"], [0, 0, "sunflower"], [0, 1, "bee_balm"]],
    background: [[-4, 3, "rose"], [-3, 3, "lavender"], [-2, 3, "tulip"]],
    camera: [0, 0],
    header: "My Garden builder mode",
    gameplayLabel: "Layout preview",
    progressLabel: "cells planned",
    action: "build",
    mode: "personal",
  },
  "daily-care-bonus": {
    targets: [[-2, 0, "sunflower"], [2, 0, "rose"]],
    background: [[-7, -4, "lavender"], [-5, -5, "rose"], [-3, -4, "tulip"], [3, 4, "daisy"], [5, 5, "bee_balm"], [7, 4, "sunflower"]],
    camera: [0, 0],
    header: "Today's Care bonus",
    gameplayLabel: "Two helpful actions",
    progressLabel: "Care earned",
    action: "build",
    mode: "community",
    careValues: [4, 1],
  },
  "flower-lifespans": {
    targets: [[-4, 0, "sunflower"], [0, 0, "rose"], [4, 0, "lavender"]],
    background: [[-6, 4, "sunflower"], [-4, 4, "sunflower"], [-2, 4, "rose"], [0, 4, "rose"], [2, 4, "lavender"], [4, 4, "lavender"], [6, 4, "lavender"]],
    camera: [0, 0],
    header: "Flower lifespans",
    gameplayLabel: "Sunflower · rose · lavender",
    progressLabel: "species planted",
    action: "build",
    mode: "community",
  },
  "heritage-flower-reveal": {
    targets: [[0, 0, "rose"]],
    background: [[-2, 0, "lavender"], [-1, -2, "sunflower"], [1, -2, "daisy"], [2, 0, "bee_balm"], [1, 2, "tulip"], [-1, 2, "rose"], [-5, -4, "lavender"], [5, 4, "sunflower"]],
    camera: [0, 0],
    header: "A permanent flower",
    gameplayLabel: "Heritage promotion",
    progressLabel: "Heritage Flower",
    action: "water",
    mode: "community",
    careValues: [1],
    heritageTargetIndex: 0,
    actorStation: [0, 4],
  },
  "plant-first-flower": {
    targets: [[0, 0, "sunflower"]],
    background: [[-7, -5, "lavender"], [7, -4, "rose"], [-6, 5, "daisy"], [6, 5, "bee_balm"]],
    camera: [0, 0],
    header: "Start before signup",
    gameplayLabel: "First community flower",
    progressLabel: "flower planted",
    action: "build",
    mode: "community",
    careValues: [1],
    actorWaypoints: [[-5, 3], [0, 0], [2, 1], [3, 3], [0, 4], [-2, 2], [0, 0]],
  },
  "garden-worm-discovery": {
    targets: [[0, 0, "tulip"]],
    background: [[-6, -4, "sunflower"], [-4, -5, "rose"], [5, -4, "lavender"], [6, 3, "bee_balm"], [-5, 4, "daisy"]],
    camera: [0, 0],
    header: "A lucky soil surprise",
    gameplayLabel: "Garden Worm discovery",
    progressLabel: "bonus Care",
    action: "build",
    mode: "community",
    careValues: [3],
    actorWaypoints: [[-5, -2], [0, 0], [1, 0], [3, 2], [1, 3], [-1, 2], [1, 0]],
    gardenWorm: { gridX: 1, gridY: 0, surfacedAtSeconds: 2.05 },
  },
};

const WEED_TARGETS = [[-4, -2], [-1, -1], [2, 0], [4, 2], [1, 4], [-3, 3]] as const;
const WEED_FLOWERS: GardenTarget[] = [
  [-6, -4, "lavender"], [-4, -4, "rose"], [-2, -4, "sunflower"], [0, -4, "rose"], [2, -4, "lavender"], [4, -4, "sunflower"], [6, -4, "rose"],
  [-6, 5, "sunflower"], [-4, 5, "rose"], [-2, 5, "lavender"], [0, 5, "sunflower"], [2, 5, "rose"], [4, 5, "lavender"], [6, 5, "sunflower"],
];
const HABITAT_FLOWERS: GardenTarget[] = [[-2, 1, "lavender"], [0, 2, "daisy"], [2, 1, "sunflower"]];

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
  if (scene.actorWaypoints && scene.actorWaypoints.length >= 2) {
    const approachSeconds = 1.05;
    if (seconds < approachSeconds) {
      return interpolatePoint(
        gridToWorld(...scene.actorWaypoints[0]),
        gridToWorld(...scene.actorWaypoints[1]),
        smoothstep(seconds / approachSeconds),
      );
    }
    const patrol = scene.actorWaypoints.slice(1);
    const legSeconds = 1.55;
    const elapsed = Math.max(0, seconds - approachSeconds);
    const legIndex = Math.floor(elapsed / legSeconds) % patrol.length;
    const from = patrol[legIndex];
    const to = patrol[(legIndex + 1) % patrol.length];
    return interpolatePoint(gridToWorld(...from), gridToWorld(...to), smoothstep((elapsed % legSeconds) / legSeconds));
  }
  const { targetIndex, phase } = plantingState(scene, seconds);
  if (scene.actorStation) {
    return interpolatePoint(gridToWorld(-4, 4), gridToWorld(scene.actorStation[0], scene.actorStation[1]), smoothstep(phase / 1.05));
  }
  const previousTarget = scene.targets[Math.max(0, targetIndex - 1)];
  const target = scene.targets[targetIndex];
  return interpolatePoint(gridToWorld(previousTarget[0], previousTarget[1]), gridToWorld(target[0], target[1]), smoothstep(phase / 1.05));
}

function plantingPlantsAt(scene: PlantingScene, seconds: number) {
  const plants = scene.background.map((target, index) => plantRecord(`social-background-${index}`, target));
  scene.targets.forEach((target, index) => {
    if (scene.action === "walk" || scene.action === "water" || seconds >= index * ROUND_SECONDS + ACTION_START_SECONDS) {
      const plant = plantRecord(`social-planted-${index}`, target);
      if (scene.heritageTargetIndex === index && seconds >= index * ROUND_SECONDS + ACTION_START_SECONDS + 0.75) {
        plant.heritage_at = new Date(BASE_DATE + (index * ROUND_SECONDS + ACTION_START_SECONDS + 0.75) * 1000).toISOString();
      }
      plants.push(plant);
    }
  });
  return plants;
}

function plantingSelectionAt(scene: PlantingScene, seconds: number): SelectedCell {
  if (scene.action === "walk") return null;
  const { targetIndex, target, phase } = plantingState(scene, seconds);
  return phase >= 0.82 && phase <= 1.9 ? {
    gridX: target[0],
    gridY: target[1],
    ...(scene.action === "water" ? { plantId: `social-planted-${targetIndex}` } : {}),
  } : null;
}

function plantingEffectsAt(scene: PlantingScene, seconds: number, mary: WorldPoint): GardenEffect[] {
  if (scene.action === "walk") return [];
  const { targetIndex, target, phase } = plantingState(scene, seconds);
  const roundStartedAt = targetIndex * ROUND_SECONDS;
  const effects: GardenEffect[] = [];
  if (phase >= ACTION_START_SECONDS && phase <= ACTION_START_SECONDS + 0.9) {
    if (scene.action === "water") {
      effects.push({ kind: "spray", fromX: mary.x, fromY: mary.y, gridX: target[0], gridY: target[1], startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS) * 1000 });
      effects.push({ kind: "water", gridX: target[0], gridY: target[1], startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS + 0.08) * 1000 });
    } else {
      effects.push({ kind: "plant", gridX: target[0], gridY: target[1], startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS) * 1000 });
    }
  }
  if (phase >= 2.05 && phase <= 2.9) {
    const point = gridToWorld(target[0], target[1]);
    effects.push({ kind: "care", x: point.x, y: point.y, value: scene.careValues?.[targetIndex] ?? 1, startedAt: BASE_DATE + (roundStartedAt + 2.05) * 1000 });
  }
  return effects;
}

function weedState(seconds: number) {
  const capped = Math.min(seconds, WEED_TARGETS.length * ROUND_SECONDS - 0.01);
  const targetIndex = Math.min(WEED_TARGETS.length - 1, Math.floor(capped / ROUND_SECONDS));
  return { targetIndex, phase: capped % ROUND_SECONDS, target: WEED_TARGETS[targetIndex] };
}

function weedMaryAt(seconds: number) {
  const { targetIndex, phase, target } = weedState(seconds);
  const previous = WEED_TARGETS[Math.max(0, targetIndex - 1)];
  return interpolatePoint(gridToWorld(previous[0], previous[1]), gridToWorld(target[0], target[1]), smoothstep(phase / 1.05));
}

function weedsAt(seconds: number) {
  const completed = Math.max(0, Math.floor((seconds - ACTION_START_SECONDS) / ROUND_SECONDS) + 1);
  return WEED_TARGETS.slice(completed).map(([gridX, gridY], index) => ({
    id: `social-weed-${completed + index}`,
    grid_x: gridX,
    grid_y: gridY,
    spawned_at: new Date(BASE_DATE - 4 * 60 * 60 * 1000).toISOString(),
  }));
}

function weedSelectionAt(seconds: number): SelectedCell {
  const { targetIndex, target, phase } = weedState(seconds);
  return phase >= 0.82 && phase <= 1.9 ? { gridX: target[0], gridY: target[1], weedId: `social-weed-${targetIndex}` } : null;
}

function weedEffectsAt(seconds: number): GardenEffect[] {
  const { targetIndex, target, phase } = weedState(seconds);
  const roundStartedAt = targetIndex * ROUND_SECONDS;
  if (phase >= ACTION_START_SECONDS && phase <= ACTION_START_SECONDS + 0.9) {
    return [{ kind: "uproot", gridX: target[0], gridY: target[1], startedAt: BASE_DATE + (roundStartedAt + ACTION_START_SECONDS) * 1000 }];
  }
  if (phase >= 2.05 && phase <= 2.9) {
    const point = gridToWorld(target[0], target[1]);
    return [{ kind: "care", x: point.x, y: point.y, value: 1, startedAt: BASE_DATE + (roundStartedAt + 2.05) * 1000 }];
  }
  return [];
}

function habitatMaryAt(seconds: number) {
  return interpolatePoint(gridToWorld(-4, 2), gridToWorld(2, 1), smoothstep(Math.min(1, seconds / 3.2)));
}

function habitatPlantsAt(seconds: number) {
  return HABITAT_FLOWERS.slice(0, seconds >= ACTION_START_SECONDS ? 3 : 2).map((target, index) => plantRecord(`social-habitat-${index}`, target));
}

function habitatEffectsAt(seconds: number): GardenEffect[] {
  if (seconds >= ACTION_START_SECONDS && seconds <= ACTION_START_SECONDS + 0.9) {
    return [{ kind: "plant", gridX: 2, gridY: 1, startedAt: BASE_DATE + ACTION_START_SECONDS * 1000 }];
  }
  return [];
}

declare global {
  interface Window {
    __BASIL_SOCIAL_CAPTURE__?: {
      setTime: (seconds: number) => Promise<void>;
      setCaptionCues: (cues: CaptionCue[]) => Promise<void>;
      setBulletinOverlay: (overlay: BulletinOverlay) => Promise<void>;
      dimensions: { width: number; height: number };
      captureMode?: "deterministic" | "realtime";
      startPlayback?: () => void;
    };
  }
}

export function SocialCaptureScene({ scene: requestedScene }: { scene: string }) {
  const scene: SocialCaptureRecipe = requestedScene === "garden-status" || requestedScene === "garden-composition" || requestedScene === "builder-mode" || requestedScene === "weed-cleanup" || requestedScene === "habitat-discovery" || requestedScene === "daily-care-bonus" || requestedScene === "flower-lifespans" || requestedScene === "heritage-flower-reveal" || requestedScene === "plant-first-flower" || requestedScene === "garden-worm-discovery"
    ? requestedScene
    : "watering-how-to";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seconds, setSeconds] = useState(0);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>(FALLBACK_CAPTIONS);
  const [overlay, setOverlay] = useState<BulletinOverlay>({});
  const plantingScene = scene === "garden-status" || scene === "garden-composition" || scene === "builder-mode" || scene === "daily-care-bonus" || scene === "flower-lifespans" || scene === "heritage-flower-reveal" || scene === "plant-first-flower" || scene === "garden-worm-discovery" ? PLANTING_SCENES[scene] : null;

  const draw = useCallback((captureSeconds: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const mary = plantingScene
      ? plantingMaryAt(plantingScene, captureSeconds)
      : scene === "weed-cleanup"
        ? weedMaryAt(captureSeconds)
        : scene === "habitat-discovery"
          ? habitatMaryAt(captureSeconds)
          : wateringMaryAt(captureSeconds);
    const duck = scene === "weed-cleanup"
      ? weedMaryAt(Math.max(0, captureSeconds - 0.72))
      : scene === "habitat-discovery"
        ? habitatMaryAt(Math.max(0, captureSeconds - 0.72))
        : plantingScene
          ? plantingMaryAt(plantingScene, Math.max(0, captureSeconds - 0.72))
          : wateringMaryAt(Math.max(0, captureSeconds - 0.72));
    const selection = plantingScene
      ? (() => {
          const selected = plantingSelectionAt(plantingScene, captureSeconds);
          return { selected, wateringTargets: plantingScene.action === "water" && selected ? [selected] : [] };
        })()
      : scene === "weed-cleanup"
        ? { selected: weedSelectionAt(captureSeconds), wateringTargets: [] }
        : scene === "habitat-discovery"
          ? { selected: captureSeconds < ACTION_START_SECONDS + 0.8 ? { gridX: 2, gridY: 1 } : null, wateringTargets: [] }
          : wateringSelectionAt(captureSeconds);
    const cameraCell = plantingScene?.camera ?? [0, 0];
    const cameraBase = gridToWorld(cameraCell[0], cameraCell[1]);
    const plants = plantingScene
      ? plantingPlantsAt(plantingScene, captureSeconds)
      : scene === "weed-cleanup"
        ? WEED_FLOWERS.map((target, index) => plantRecord(`social-weed-flower-${index}`, target))
        : scene === "habitat-discovery"
          ? habitatPlantsAt(captureSeconds)
          : wateringPlantsAt(captureSeconds);
    renderGarden(context, {
      viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      camera: { x: cameraBase.x, y: cameraBase.y + 92 },
      zoom: scene === "garden-status" ? 3.9 : scene === "garden-composition" ? 4.35 : scene === "plant-first-flower" ? 4.9 : scene === "garden-worm-discovery" ? 5.1 : scene === "builder-mode" ? 4.65 : scene === "weed-cleanup" ? 4.15 : scene === "heritage-flower-reveal" ? 5.05 : scene === "flower-lifespans" ? 4.2 : 4.5,
      mary,
      actorAppearance: "wren",
      duck: { x: duck.x - 24, y: duck.y + 18 },
      plants,
      weeds: scene === "weed-cleanup" ? weedsAt(captureSeconds) : [],
      selected: selection.selected,
      wateringTargets: selection.wateringTargets,
      wateringCareReadyPlantIds: new Set(plants.map((plant) => plant.id)),
      wateringCareStatusLoaded: true,
      suggestedPlantingCell: plantingScene && selection.selected ? selection.selected : null,
      suggestedWateringCell: null,
      gardenWorms: plantingScene?.gardenWorm && captureSeconds >= plantingScene.gardenWorm.surfacedAtSeconds
        ? [{ gridX: plantingScene.gardenWorm.gridX, gridY: plantingScene.gardenWorm.gridY, surfacedAt: BASE_DATE + plantingScene.gardenWorm.surfacedAtSeconds * 1000 }]
        : [],
      tutorialDimmed: false,
      effects: plantingScene
        ? plantingEffectsAt(plantingScene, captureSeconds, mary)
        : scene === "weed-cleanup"
          ? weedEffectsAt(captureSeconds)
          : scene === "habitat-discovery"
            ? habitatEffectsAt(captureSeconds)
            : wateringEffectsAt(captureSeconds, mary),
      moving: plantingScene
        ? plantingState(plantingScene, captureSeconds).phase < 1.05
        : scene === "weed-cleanup"
          ? weedState(captureSeconds).phase < 1.05
          : scene === "habitat-discovery"
            ? captureSeconds < 3.2
            : wateringState(captureSeconds).phase < 1.05,
      now: BASE_DATE + captureSeconds * 1000,
      mode: plantingScene?.mode ?? (scene === "habitat-discovery" ? "personal" : "community"),
      personalGarden: plantingScene?.mode === "personal" || scene === "habitat-discovery" ? {
        minX: -7, minY: -6, width: 15, height: 13, maxWidth: 15, maxHeight: 13,
        elements: scene === "habitat-discovery" ? [{ id: "social-birdhouse", gridX: 0, gridY: 0, elementType: "birdhouse", careCost: 0 }] : [],
        paths: [{ gridX: -5, gridY: 0 }, { gridX: -4, gridY: 0 }, { gridX: -3, gridY: 0 }],
        livingHabitats: scene === "habitat-discovery" && captureSeconds >= ACTION_START_SECONDS + 1.1
          ? [{ key: "garden_sparrow", gridX: 0, gridY: 0, signature: "garden_sparrow:0:0" }]
          : [],
        nextExpansion: null,
      } : undefined,
      builderPreview: plantingScene?.action === "build" && scene === "builder-mode" ? {
        mode: "place",
        cells: plantingScene.targets.slice(0, Math.max(1, Math.floor(captureSeconds / ROUND_SECONDS) + 1)).map(([gridX, gridY]) => ({ gridX, gridY })),
        invalidCell: null,
      } : undefined,
      reducedMotion: false,
    });
  }, [plantingScene, scene]);

  useEffect(() => draw(seconds), [draw, seconds]);
  useEffect(() => {
    window.__BASIL_SOCIAL_CAPTURE__ = {
      dimensions: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      captureMode: "deterministic",
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
  const progress = plantingScene
    ? scene === "daily-care-bonus"
      ? plantingScene.careValues!.slice(0, Math.min(plantingScene.targets.length, Math.max(0, Math.floor((seconds - ACTION_START_SECONDS) / ROUND_SECONDS) + 1))).reduce((sum, value) => sum + value, 0)
      : Math.min(plantingScene.targets.length, Math.max(0, Math.floor((seconds - ACTION_START_SECONDS) / ROUND_SECONDS) + 1))
    : scene === "weed-cleanup"
      ? Math.min(WEED_TARGETS.length, Math.max(0, Math.floor((seconds - ACTION_START_SECONDS) / ROUND_SECONDS) + 1))
      : scene === "habitat-discovery"
        ? (seconds >= ACTION_START_SECONDS + 1.1 ? 1 : 0)
        : wateringState(seconds).absoluteRound * 3 + (wateringState(seconds).phase >= ACTION_START_SECONDS ? 3 : 0);
  const header = overlay.header ?? plantingScene?.header ?? (scene === "weed-cleanup" ? "Weeds and busy patches" : scene === "habitat-discovery" ? "A habitat comes alive" : "How watering works");
  const gameplayLabel = overlay.gameplayLabel ?? plantingScene?.gameplayLabel ?? (scene === "weed-cleanup" ? "Weed cleanup" : scene === "habitat-discovery" ? "Garden sparrow" : "Two-tap watering");
  const progressLabel = overlay.progressLabel ?? plantingScene?.progressLabel ?? (scene === "weed-cleanup" ? "weeds pulled" : scene === "habitat-discovery" ? "habitat discovered" : "flowers watered");
  const progressValue = overlay.progressValue ?? String(progress);

  return (
    <main className={styles.capture} data-capture-ready="true" data-time={seconds.toFixed(3)} data-scene={scene}>
      <canvas ref={canvasRef} width={CAPTURE_WIDTH} height={CAPTURE_HEIGHT} aria-label={`Basil ${gameplayLabel.toLowerCase()} gameplay`} />
      <div className={styles.vignette} aria-hidden="true" />
      <header className={styles.header}><span>{header}</span><strong>BASIL</strong></header>
      <aside className={styles.gameplayStatus} aria-label="Gameplay task progress"><span>{gameplayLabel}</span><strong>{progressValue} {progressLabel}</strong></aside>
      <section className={`${styles.caption} ${isClosing ? styles.captionClosing : ""}`} aria-live="off">
        <p>{cue?.words?.length
          ? cue.words.map((word, index) => <span className={index === activeWordIndex ? styles.activeWord : index < activeWordIndex ? styles.spokenWord : undefined} key={`${word.start}-${word.text}`}>{word.text}{index < cue.words!.length - 1 ? " " : ""}</span>)
          : cue?.text ?? "Basil Community Garden"}</p>
      </section>
      <footer className={`${styles.footer} ${isClosing ? styles.footerVisible : ""}`}><span>{overlay.footer ?? "Play free in your browser."}</span><strong>basilcommunitygarden.com</strong></footer>
    </main>
  );
}
