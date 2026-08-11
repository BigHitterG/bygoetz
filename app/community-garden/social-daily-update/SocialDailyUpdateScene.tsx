"use client";

import { useEffect, useRef, useState } from "react";
import { gridToWorld, renderGarden } from "../game/gardenRenderer";
import type { PlantRecord } from "../lib/roseLifecycle";
import styles from "./social-daily-update.module.css";

const WIDTH = 1080;
const HEIGHT = 1350;

type Metric = { value: number; previousValue: number | null; delta: number | null };
export type SocialDailyUpdate = {
  measuredAt: string;
  comparison: "previous_snapshot";
  communityFlowers: Metric;
  newGardeners: Metric;
  waterings: Metric;
  weedsPulled: Metric;
};

declare global {
  interface Window {
    __BASIL_SOCIAL_DAILY_UPDATE__?: SocialDailyUpdate & { dimensions: { width: number; height: number }; source: "verified-aggregate-stats" };
    __BASIL_SOCIAL_DAILY_UPDATE_CONTROL__?: { loadUpdate: (update: SocialDailyUpdate) => void };
  }
}

function deltaLabel(delta: number | null) {
  if (delta === null) return "No prior snapshot";
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-US")} since prior snapshot`;
}

function validMetric(value: unknown): value is Metric {
  if (!value || typeof value !== "object") return false;
  const metric = value as Record<string, unknown>;
  return typeof metric.value === "number" && Number.isFinite(metric.value)
    && (metric.previousValue === null || (typeof metric.previousValue === "number" && Number.isFinite(metric.previousValue)))
    && (metric.delta === null || (typeof metric.delta === "number" && Number.isFinite(metric.delta)));
}

function validUpdate(value: unknown): value is SocialDailyUpdate {
  if (!value || typeof value !== "object") return false;
  const update = value as Record<string, unknown>;
  return typeof update.measuredAt === "string"
    && update.comparison === "previous_snapshot"
    && validMetric(update.communityFlowers)
    && validMetric(update.newGardeners)
    && validMetric(update.waterings)
    && validMetric(update.weedsPulled);
}

export function SocialDailyUpdateScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [update, setUpdate] = useState<SocialDailyUpdate | null>(null);

  useEffect(() => {
    function loadUpdate(nextUpdate: SocialDailyUpdate) {
      if (!validUpdate(nextUpdate)) throw new Error("The daily update payload is incomplete.");
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const plantedAt = nextUpdate.measuredAt;
      const plants: PlantRecord[] = [
        { id: "daily-rose-1", grid_x: -3, grid_y: -2, plant_type: "rose", planted_at: plantedAt, last_watered_at: plantedAt, created_at: plantedAt, permanent: true },
        { id: "daily-lavender-1", grid_x: 2, grid_y: -2, plant_type: "lavender", planted_at: plantedAt, last_watered_at: plantedAt, created_at: plantedAt, permanent: true },
        { id: "daily-sunflower-1", grid_x: -1, grid_y: 2, plant_type: "sunflower", planted_at: plantedAt, last_watered_at: plantedAt, created_at: plantedAt, permanent: true },
        { id: "daily-rose-2", grid_x: 4, grid_y: 3, plant_type: "rose", planted_at: plantedAt, last_watered_at: plantedAt, created_at: plantedAt, permanent: true },
        { id: "daily-lavender-2", grid_x: -4, grid_y: 4, plant_type: "lavender", planted_at: plantedAt, last_watered_at: plantedAt, created_at: plantedAt, permanent: true },
      ];
      const center = gridToWorld(0, 0);
      renderGarden(context, {
        viewport: { width: WIDTH, height: HEIGHT }, camera: { x: center.x, y: center.y + 70 }, zoom: 5.15,
        mary: gridToWorld(2, 1), duck: gridToWorld(3, 2), plants, weeds: [], selected: null,
        wateringTargets: [], wateringCareReadyPlantIds: new Set(), wateringCareStatusLoaded: false,
        suggestedPlantingCell: null, suggestedWateringCell: null, gardenWorms: [], tutorialDimmed: false,
        effects: [], moving: false, now: Date.parse(plantedAt), mode: "community", reducedMotion: true,
      });
      setUpdate(nextUpdate);
      window.__BASIL_SOCIAL_DAILY_UPDATE__ = { ...nextUpdate, source: "verified-aggregate-stats", dimensions: { width: WIDTH, height: HEIGHT } };
    }
    window.__BASIL_SOCIAL_DAILY_UPDATE_CONTROL__ = { loadUpdate };
    return () => {
      delete window.__BASIL_SOCIAL_DAILY_UPDATE__;
      delete window.__BASIL_SOCIAL_DAILY_UPDATE_CONTROL__;
    };
  }, []);

  const date = update ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" }).format(new Date(update.measuredAt)) : "";
  const metrics = update ? [
    ["Community flowers", update.communityFlowers],
    ["New gardeners", update.newGardeners],
    ["Waterings", update.waterings],
    ["Weeds pulled", update.weedsPulled],
  ] as const : [];

  return (
    <main className={styles.update} data-update-ready={update ? "true" : "false"}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Basil garden with Mary and the current daily statistics" />
      <div className={styles.tint} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.seal} aria-hidden="true"><img src="/community-garden/basil-icon-256.png" alt="" /></div>
        <div><span>BASIL COMMUNITY GARDEN</span><h1>Today in the garden</h1><p>{date} · Compared with the previous Studio snapshot</p></div>
      </header>
      <section className={styles.metrics} aria-label="Daily garden statistics">
        {metrics.map(([label, metric]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{metric.value.toLocaleString("en-US")}</strong>
            <small data-direction={metric.delta === null || metric.delta === 0 ? "flat" : metric.delta > 0 ? "up" : "down"}>{deltaLabel(metric.delta)}</small>
          </article>
        ))}
      </section>
      <footer className={styles.footer}><span>One garden, tended together.</span><strong>basilcommunitygarden.com</strong></footer>
    </main>
  );
}
