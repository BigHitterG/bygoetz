
"use client";

import { useEffect, useRef, useState } from "react";
import { gridToWorld, renderGarden, worldToScreen, type WorldPoint } from "../game/gardenRenderer";
import type { GardenSnapshot } from "../lib/supabaseGarden";
import type { PlantRecord, PlantType } from "../lib/roseLifecycle";
import styles from "./social-diagram.module.css";

const WIDTH = 1080;
const HEIGHT = 1350;
const ZOOM = 4.15;
type PlantCounts = Record<"rose" | "lavender" | "sunflower", number>;

declare global {
  interface Window {
    __BASIL_SOCIAL_DIAGRAM__?: {
      source: "live-community-snapshot";
      generatedAt: string;
      plantCount: number;
      counts: PlantCounts;
      center: { gridX: number; gridY: number };
      dimensions: { width: number; height: number };
    };
    __BASIL_SOCIAL_DIAGRAM_CONTROL__?: {
      loadSnapshot: (snapshot: GardenSnapshot) => Promise<void>;
    };
  }
}

function findDiverseCenter(plants: PlantRecord[]) {
  let best = { gridX: 0, gridY: 0, types: -1, count: -1 };
  for (const anchor of plants) {
    const nearby = plants.filter((plant) => Math.abs(plant.grid_x - anchor.grid_x) <= 8 && Math.abs(plant.grid_y - anchor.grid_y) <= 6);
    const types = new Set(nearby.map((plant) => plant.plant_type)).size;
    if (types > best.types || (types === best.types && nearby.length > best.count)) {
      best = { gridX: anchor.grid_x, gridY: anchor.grid_y, types, count: nearby.length };
    }
  }
  return best;
}

function findOpenCell(plants: PlantRecord[], center: { gridX: number; gridY: number }) {
  const occupied = new Set(plants.map((plant) => `${plant.grid_x}:${plant.grid_y}`));
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let y = center.gridY - radius; y <= center.gridY + radius; y += 1) {
      for (let x = center.gridX - radius; x <= center.gridX + radius; x += 1) {
        if (!occupied.has(`${x}:${y}`)) return { gridX: x, gridY: y };
      }
    }
  }
  return center;
}

function nearestPlant(plants: PlantRecord[], plantType: PlantType, target: { gridX: number; gridY: number }) {
  return plants.filter((plant) => plant.plant_type === plantType).sort((left, right) =>
    Math.hypot(left.grid_x - target.gridX, left.grid_y - target.gridY)
    - Math.hypot(right.grid_x - target.gridX, right.grid_y - target.gridY))[0];
}

function anchorForPlant(plant: PlantRecord | undefined, camera: WorldPoint) {
  if (!plant) return { x: WIDTH / 2, y: HEIGHT / 2 };
  return worldToScreen(gridToWorld(plant.grid_x, plant.grid_y), camera, { width: WIDTH, height: HEIGHT }, ZOOM);
}

export function SocialDiagramScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState<PlantCounts>({ rose: 0, lavender: 0, sunflower: 0 });
  const [anchors, setAnchors] = useState({ rose: { x: 400, y: 650 }, lavender: { x: 680, y: 660 }, sunflower: { x: 550, y: 850 } });

  useEffect(() => {
    let cancelled = false;
    async function drawLiveGarden(snapshot: GardenSnapshot) {
      if (cancelled || snapshot.plants.length === 0) throw new Error("The live community garden snapshot is empty.");
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const center = findDiverseCenter(snapshot.plants);
      const openCell = findOpenCell(snapshot.plants, center);
      const cameraBase = gridToWorld(center.gridX, center.gridY);
      const camera = { x: cameraBase.x, y: cameraBase.y + 68 };
      const mary = gridToWorld(openCell.gridX, openCell.gridY);
      const duck = gridToWorld(openCell.gridX + 1, openCell.gridY + 1);
      const nextCounts: PlantCounts = { rose: 0, lavender: 0, sunflower: 0 };
      for (const plant of snapshot.plants) {
        if (plant.plant_type in nextCounts) nextCounts[plant.plant_type as keyof PlantCounts] += 1;
      }
      renderGarden(context, {
        viewport: { width: WIDTH, height: HEIGHT },
        camera,
        zoom: ZOOM,
        mary,
        duck,
        plants: snapshot.plants,
        weeds: snapshot.weeds,
        selected: null,
        wateringTargets: [],
        wateringCareReadyPlantIds: new Set(),
        wateringCareStatusLoaded: false,
        suggestedPlantingCell: null,
        suggestedWateringCell: null,
        gardenWorms: [],
        tutorialDimmed: false,
        effects: [],
        moving: false,
        now: Date.parse(snapshot.generatedAt),
        mode: "community",
        reducedMotion: true,
      });
      const visible = snapshot.plants.filter((plant) => Math.abs(plant.grid_x - center.gridX) <= 8 && Math.abs(plant.grid_y - center.gridY) <= 6);
      setCounts(nextCounts);
      setAnchors({
        rose: anchorForPlant(nearestPlant(visible, "rose", { gridX: center.gridX - 4, gridY: center.gridY - 1 }), camera),
        lavender: anchorForPlant(nearestPlant(visible, "lavender", { gridX: center.gridX + 4, gridY: center.gridY - 1 }), camera),
        sunflower: anchorForPlant(nearestPlant(visible, "sunflower", { gridX: center.gridX, gridY: center.gridY + 4 }), camera),
      });
      window.__BASIL_SOCIAL_DIAGRAM__ = {
        source: "live-community-snapshot",
        generatedAt: snapshot.generatedAt,
        plantCount: snapshot.plantCount,
        counts: nextCounts,
        center: { gridX: center.gridX, gridY: center.gridY },
        dimensions: { width: WIDTH, height: HEIGHT },
      };
      requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    }
    window.__BASIL_SOCIAL_DIAGRAM_CONTROL__ = { loadSnapshot: drawLiveGarden };
    return () => {
      cancelled = true;
      delete window.__BASIL_SOCIAL_DIAGRAM__;
      delete window.__BASIL_SOCIAL_DIAGRAM_CONTROL__;
    };
  }, []);

  const total = counts.rose + counts.lavender + counts.sunflower;
  return (
    <main className={styles.diagram} data-diagram-ready={ready ? "true" : "false"}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Live Basil shared community garden planting diversity map" />
      <div className={styles.tint} aria-hidden="true" />
      <header className={styles.title}>
        <span>LIVE COMMUNITY GARDEN</span>
        <h1>{total.toLocaleString()} flowers.<br />One shared garden.</h1>
        <p>Three flower types are shaping todayâ€™s map.</p>
      </header>
      <svg className={styles.leaders} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        <path d={`M 238 565 C 300 590, ${anchors.rose.x - 40} ${anchors.rose.y - 20}, ${anchors.rose.x} ${anchors.rose.y}`} />
        <circle cx={anchors.rose.x} cy={anchors.rose.y} r="9" />
        <path d={`M 842 565 C 780 590, ${anchors.lavender.x + 40} ${anchors.lavender.y - 20}, ${anchors.lavender.x} ${anchors.lavender.y}`} />
        <circle cx={anchors.lavender.x} cy={anchors.lavender.y} r="9" />
        <path d={`M 540 1015 C 540 950, ${anchors.sunflower.x} ${anchors.sunflower.y + 60}, ${anchors.sunflower.x} ${anchors.sunflower.y}`} />
        <circle cx={anchors.sunflower.x} cy={anchors.sunflower.y} r="9" />
      </svg>
      <section className={`${styles.callout} ${styles.rose}`}><strong>{counts.rose.toLocaleString()}</strong><span>ROSES</span></section>
      <section className={`${styles.callout} ${styles.lavender}`}><strong>{counts.lavender.toLocaleString()}</strong><span>LAVENDER</span></section>
      <section className={`${styles.callout} ${styles.sunflower}`}><strong>{counts.sunflower.toLocaleString()}</strong><span>SUNFLOWERS</span></section>
      <footer className={styles.footer}><span>WHERE WOULD YOU PLANT NEXT?</span><strong>basilcommunitygarden.com</strong></footer>
    </main>
  );
}

