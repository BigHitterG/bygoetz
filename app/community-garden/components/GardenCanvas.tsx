"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  gridToWorld,
  renderGarden,
  screenToGrid,
  type GardenEffect,
  type SelectedCell,
  type WorldPoint,
} from "../game/gardenRenderer";
import {
  clampWorldCoordinate,
  GARDEN_CONFIG,
  getChunkKey,
  getGardenBounds,
  getGridFromMapPercentage,
  getLoadedBounds,
  getMapPercentage,
  isWithinGarden,
  type GardenBounds,
} from "../lib/gardenConfig";
import {
  getRoseVisual,
  isRosePlantable,
  type RoseRecord,
} from "../lib/roseLifecycle";
import {
  cleanupExpiredGardenRoses,
  fetchGardenRoseMap,
  fetchGardenRoses,
  type GardenMapRose,
  isGardenConfigured,
  plantGardenRose,
  waterGardenRose,
} from "../lib/supabaseGarden";

export type GardenConnection = "connecting" | "online" | "offline" | "error";
export type GardenAction = "plant" | "water" | null;

export type GardenUiState = {
  action: GardenAction;
  actionLabel: string;
  actionEnabled: boolean;
  connection: GardenConnection;
  message: string;
  mapX: number;
  mapY: number;
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  roseMapPoints: Array<{ x: number; y: number }>;
};

export type GardenCanvasHandle = {
  performAction: () => Promise<void>;
  goToMapPosition: (mapX: number, mapY: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type Runtime = {
  mary: WorldPoint;
  duck: WorldPoint;
  camera: WorldPoint;
  zoom: number;
  target: WorldPoint | null;
  selected: SelectedCell;
  roses: Map<string, RoseRecord>;
  mapRoses: Map<string, GardenMapRose>;
  effects: GardenEffect[];
  path: WorldPoint[];
  lastFrame: number;
  loadedChunkKey: string;
  chunkCache: Map<string, RoseRecord[]>;
  cacheOrder: string[];
  requestId: number;
  actionBusy: boolean;
  hasMoved: boolean;
  moving: boolean;
  reducedMotion: boolean;
  configured: boolean;
  connection: GardenConnection;
  statusMessage: string;
};

type GardenCanvasProps = {
  onStateChange: (state: GardenUiState) => void;
};

function roseKey(gridX: number, gridY: number) {
  return `${gridX}:${gridY}`;
}

function clampZoom(value: number) {
  return Math.min(
    GARDEN_CONFIG.maxCameraZoom,
    Math.max(GARDEN_CONFIG.minCameraZoom, value),
  );
}

function getRoseAt(runtime: Runtime, gridX: number, gridY: number) {
  return runtime.roses.get(roseKey(gridX, gridY));
}

function getDistanceToCell(runtime: Runtime, selected: NonNullable<SelectedCell>) {
  const point = gridToWorld(selected.gridX, selected.gridY);
  return Math.hypot(runtime.mary.x - point.x, runtime.mary.y - point.y);
}

function getActionState(runtime: Runtime) {
  if (!runtime.selected) {
    return { action: null as GardenAction, label: "Choose a spot", enabled: false };
  }

  const rose = getRoseAt(runtime, runtime.selected.gridX, runtime.selected.gridY);
  const visual = rose ? getRoseVisual(rose) : null;
  const nearby = getDistanceToCell(runtime, runtime.selected) <= GARDEN_CONFIG.tileSize * 1.8;

  if (rose && visual && visual.state !== "expired") {
    if (visual.state === "dead") {
      return { action: null as GardenAction, label: "This spot is resting", enabled: false };
    }
    return {
      action: "water" as GardenAction,
      label: "Water Rose",
      enabled: nearby && !runtime.actionBusy,
    };
  }

  return {
    action: "plant" as GardenAction,
    label: "Plant Rose",
    enabled: nearby && !runtime.actionBusy,
  };
}

function getAdjacentTarget(mary: WorldPoint, gridX: number, gridY: number) {
  const center = gridToWorld(gridX, gridY);
  const dx = mary.x - center.x;
  const dy = mary.y - center.y;
  const offset = GARDEN_CONFIG.tileSize;

  if (Math.abs(dx) > Math.abs(dy)) {
    center.x += dx >= 0 ? offset : -offset;
  } else {
    center.y += dy >= 0 ? offset : -offset;
  }

  return {
    x: clampWorldCoordinate(center.x),
    y: clampWorldCoordinate(center.y),
  };
}

function makeLocalRose(gridX: number, gridY: number): RoseRecord {
  const now = new Date().toISOString();
  return {
    id: `local-${gridX}-${gridY}-${Date.now()}`,
    grid_x: gridX,
    grid_y: gridY,
    planted_at: now,
    last_watered_at: now,
    created_at: now,
  };
}

function seedLocalRoses() {
  const now = Date.now();
  const create = (id: string, gridX: number, gridY: number, ageHours: number): RoseRecord => ({
    id,
    grid_x: gridX,
    grid_y: gridY,
    planted_at: new Date(now - ageHours * 60 * 60 * 1000).toISOString(),
    last_watered_at: new Date(now - ageHours * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now - ageHours * 60 * 60 * 1000).toISOString(),
  });

  return [
    create("local-welcome-1", 2, -1, 32),
    create("local-welcome-2", -2, 1, 8),
    create("local-welcome-3", 3, 2, 76),
  ];
}

export const GardenCanvas = forwardRef<GardenCanvasHandle, GardenCanvasProps>(
  function GardenCanvas({ onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onStateChangeRef = useRef(onStateChange);
    const loadRosesRef = useRef<() => Promise<void>>(async () => undefined);
    const lastUiKeyRef = useRef("");
    const start = gridToWorld(0, 0);
    const runtimeRef = useRef<Runtime>({
      mary: { ...start },
      duck: { x: start.x - 18, y: start.y + 10 },
      camera: { ...start },
      zoom: GARDEN_CONFIG.defaultCameraZoom,
      target: null,
      selected: null,
      roses: new Map(),
      mapRoses: new Map(),
      effects: [],
      path: [{ ...start }],
      lastFrame: 0,
      loadedChunkKey: "",
      chunkCache: new Map(),
      cacheOrder: [],
      requestId: 0,
      actionBusy: false,
      hasMoved: false,
      moving: false,
      reducedMotion: false,
      configured: isGardenConfigured(),
      connection: isGardenConfigured() ? "connecting" : "offline",
      statusMessage: isGardenConfigured()
        ? "Connecting to the shared garden..."
        : "Preview mode: shared planting is not connected.",
    });

    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    const publishUi = useCallback(() => {
      const runtime = runtimeRef.current;
      const action = getActionState(runtime);
      const gridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const gridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      const roseMapPoints = Array.from(runtime.mapRoses.values()).map((rose) => ({
        x: getMapPercentage(rose.grid_x),
        y: getMapPercentage(rose.grid_y),
      }));
      const state: GardenUiState = {
        action: action.action,
        actionLabel: action.label,
        actionEnabled: action.enabled,
        connection: runtime.connection,
        message: runtime.statusMessage,
        mapX: getMapPercentage(gridX),
        mapY: getMapPercentage(gridY),
        zoom: runtime.zoom,
        canZoomIn: runtime.zoom < GARDEN_CONFIG.maxCameraZoom,
        canZoomOut: runtime.zoom > GARDEN_CONFIG.minCameraZoom,
        roseMapPoints,
      };
      const key = JSON.stringify(state);
      if (key === lastUiKeyRef.current) return;
      lastUiKeyRef.current = key;
      onStateChangeRef.current(state);
    }, []);

    const loadRoses = useCallback(async () => {
      const runtime = runtimeRef.current;
      const gridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const gridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      const chunkKey = getChunkKey(gridX, gridY);
      const bounds = getLoadedBounds(gridX, gridY);
      const cleanupBounds = getLoadedBounds(
        gridX,
        gridY,
        GARDEN_CONFIG.cleanupChunkLoadRadius,
      );
      const cached = runtime.chunkCache.get(chunkKey);
      if (cached) {
        runtime.roses = new Map(cached.map((rose) => [roseKey(rose.grid_x, rose.grid_y), rose]));
      }

      if (!runtime.configured) {
        if (runtime.roses.size === 0) {
          const localRoses = seedLocalRoses();
          runtime.roses = new Map(
            localRoses.map((rose) => [roseKey(rose.grid_x, rose.grid_y), rose]),
          );
          runtime.mapRoses = new Map(
            localRoses.map((rose) => [roseKey(rose.grid_x, rose.grid_y), rose]),
          );
        }
        publishUi();
        return;
      }

      const requestId = ++runtime.requestId;
      try {
        await cleanupExpiredGardenRoses(cleanupBounds);
        const [roses, mapRoses] = await Promise.all([
          fetchGardenRoses(bounds),
          fetchGardenRoseMap(getGardenBounds()),
        ]);
        if (requestId !== runtime.requestId) return;

        runtime.roses = new Map(
          roses
            .filter((rose) => getRoseVisual(rose).state !== "expired")
            .map((rose) => [roseKey(rose.grid_x, rose.grid_y), rose]),
        );
        runtime.mapRoses = new Map(
          mapRoses.map((rose) => [roseKey(rose.grid_x, rose.grid_y), rose]),
        );
        runtime.chunkCache.set(chunkKey, roses);
        runtime.cacheOrder = runtime.cacheOrder.filter((key) => key !== chunkKey);
        runtime.cacheOrder.push(chunkKey);
        while (runtime.cacheOrder.length > 6) {
          const oldest = runtime.cacheOrder.shift();
          if (oldest) runtime.chunkCache.delete(oldest);
        }
        runtime.connection = "online";
        runtime.statusMessage = "The shared garden is connected.";
      } catch (error) {
        runtime.connection = "error";
        runtime.statusMessage =
          error instanceof Error ? error.message : "The garden could not refresh.";
      }
      publishUi();
    }, [publishUi]);

    useEffect(() => {
      loadRosesRef.current = loadRoses;
    }, [loadRoses]);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn() {
          const runtime = runtimeRef.current;
          runtime.zoom = clampZoom(runtime.zoom + GARDEN_CONFIG.cameraZoomStep);
          runtime.statusMessage = "Zoomed in for a closer garden view.";
          publishUi();
        },
        zoomOut() {
          const runtime = runtimeRef.current;
          runtime.zoom = clampZoom(runtime.zoom - GARDEN_CONFIG.cameraZoomStep);
          runtime.statusMessage = "Zoomed out to see more of the garden.";
          publishUi();
        },
        goToMapPosition(mapX, mapY) {
          const runtime = runtimeRef.current;
          const gridX = getGridFromMapPercentage(mapX);
          const gridY = getGridFromMapPercentage(mapY);
          const destination = gridToWorld(gridX, gridY);
          runtime.selected = null;
          runtime.target = null;
          runtime.mary = { ...destination };
          runtime.camera = { ...destination };
          runtime.duck = {
            x: clampWorldCoordinate(destination.x - 18),
            y: clampWorldCoordinate(destination.y + 10),
          };
          runtime.path = [{ ...destination }];
          runtime.loadedChunkKey = "";
          runtime.hasMoved = true;
          runtime.statusMessage = "Exploring a new part of the garden.";
          publishUi();
        },
        async performAction() {
          const runtime = runtimeRef.current;
          const selected = runtime.selected;
          const actionState = getActionState(runtime);
          if (!selected || !actionState.enabled || !actionState.action) return;

          runtime.actionBusy = true;
          runtime.requestId += 1;
          runtime.statusMessage =
            actionState.action === "plant" ? "Planting a rose..." : "Watering the rose...";
          publishUi();

          try {
            if (actionState.action === "plant") {
              const existing = getRoseAt(runtime, selected.gridX, selected.gridY);
              if (!isRosePlantable(existing)) throw new Error("Another rose is already here.");
              const rose = runtime.configured
                ? await plantGardenRose(selected.gridX, selected.gridY)
                : makeLocalRose(selected.gridX, selected.gridY);
              runtime.roses.set(roseKey(rose.grid_x, rose.grid_y), rose);
              runtime.mapRoses.set(roseKey(rose.grid_x, rose.grid_y), rose);
              runtime.selected = { ...selected, roseId: rose.id };
              runtime.effects.push({
                kind: "plant",
                gridX: rose.grid_x,
                gridY: rose.grid_y,
                startedAt: performance.now(),
              });
              runtime.statusMessage = "A new rose has taken root.";
            } else {
              const current = getRoseAt(runtime, selected.gridX, selected.gridY);
              if (!current) throw new Error("That rose is no longer here.");
              const rose = runtime.configured
                ? await waterGardenRose(current.id)
                : { ...current, last_watered_at: new Date().toISOString() };
              runtime.roses.set(roseKey(rose.grid_x, rose.grid_y), rose);
              runtime.effects.push({
                kind: "water",
                gridX: rose.grid_x,
                gridY: rose.grid_y,
                startedAt: performance.now(),
              });
              runtime.statusMessage = "The rose looks brighter already.";
            }
            runtime.connection = runtime.configured ? "online" : "offline";
          } catch (error) {
            runtime.statusMessage =
              error instanceof Error ? error.message : "That did not work. Please try again.";
          } finally {
            runtime.actionBusy = false;
            publishUi();
          }
        },
      }),
      [publishUi],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const resizeCanvas = () => {
        const bounds = canvas.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const responsiveWidth = Math.round(
          GARDEN_CONFIG.logicalHeight * (bounds.width / bounds.height),
        );
        canvas.width = Math.min(
          GARDEN_CONFIG.maxLogicalWidth,
          Math.max(GARDEN_CONFIG.minLogicalWidth, responsiveWidth),
        );
        canvas.height = GARDEN_CONFIG.logicalHeight;
      };
      resizeCanvas();
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas);
      runtimeRef.current.reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      publishUi();

      let frameId = 0;
      const tick = (now: number) => {
        const runtime = runtimeRef.current;
        const deltaSeconds = Math.min(
          0.05,
          runtime.lastFrame ? (now - runtime.lastFrame) / 1000 : 0,
        );
        runtime.lastFrame = now;
        runtime.moving = false;

        if (runtime.target) {
          const dx = runtime.target.x - runtime.mary.x;
          const dy = runtime.target.y - runtime.mary.y;
          const distance = Math.hypot(dx, dy);
          const step = GARDEN_CONFIG.moveSpeed * deltaSeconds;
          if (distance <= Math.max(1, step)) {
            runtime.mary = {
              x: clampWorldCoordinate(runtime.target.x),
              y: clampWorldCoordinate(runtime.target.y),
            };
            runtime.target = null;
          } else {
            runtime.mary.x = clampWorldCoordinate(runtime.mary.x + (dx / distance) * step);
            runtime.mary.y = clampWorldCoordinate(runtime.mary.y + (dy / distance) * step);
            runtime.moving = true;
            runtime.hasMoved = true;
          }

          const lastPath = runtime.path[runtime.path.length - 1];
          if (
            !lastPath ||
            Math.hypot(runtime.mary.x - lastPath.x, runtime.mary.y - lastPath.y) >= 2
          ) {
            runtime.path.push({ ...runtime.mary });
            if (runtime.path.length > 120) runtime.path.shift();
          }
        }

        const duckTarget = runtime.path[Math.max(0, runtime.path.length - 18)] ?? runtime.mary;
        const duckDx = duckTarget.x - runtime.duck.x;
        const duckDy = duckTarget.y - runtime.duck.y;
        const duckDistance = Math.hypot(duckDx, duckDy);
        if (duckDistance > 0.5) {
          const duckStep = Math.min(duckDistance, GARDEN_CONFIG.moveSpeed * 1.15 * deltaSeconds);
          runtime.duck.x += (duckDx / duckDistance) * duckStep;
          runtime.duck.y += (duckDy / duckDistance) * duckStep;
        }

        const cameraEase = runtime.reducedMotion ? 1 : Math.min(1, deltaSeconds * 7);
        runtime.camera.x += (runtime.mary.x - runtime.camera.x) * cameraEase;
        runtime.camera.y += (runtime.mary.y - runtime.camera.y) * cameraEase;
        runtime.effects = runtime.effects.filter((effect) => now - effect.startedAt < 900);

        const gridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
        const gridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
        const chunkKey = getChunkKey(gridX, gridY);
        if (chunkKey !== runtime.loadedChunkKey) {
          runtime.loadedChunkKey = chunkKey;
          void loadRosesRef.current();
        }

        renderGarden(ctx, {
          viewport: { width: canvas.width, height: canvas.height },
          camera: runtime.camera,
          zoom: runtime.zoom,
          mary: runtime.mary,
          duck: runtime.duck,
          roses: Array.from(runtime.roses.values()),
          selected: runtime.selected,
          effects: runtime.reducedMotion ? [] : runtime.effects,
          moving: runtime.reducedMotion ? false : runtime.moving,
          now: Date.now(),
        });
        publishUi();
        frameId = requestAnimationFrame(tick);
      };

      frameId = requestAnimationFrame(tick);
      const pollId = window.setInterval(() => {
        void loadRosesRef.current();
      }, GARDEN_CONFIG.pollIntervalMs);

      return () => {
        cancelAnimationFrame(frameId);
        window.clearInterval(pollId);
        resizeObserver.disconnect();
      };
    }, [publishUi]);

    function selectCell(gridX: number, gridY: number) {
      const runtime = runtimeRef.current;
      if (!isWithinGarden(gridX, gridY)) {
        runtime.statusMessage = "You have reached the garden edge.";
        publishUi();
        return;
      }

      const maryGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const maryGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      if (maryGridX === gridX && maryGridY === gridY) {
        runtime.statusMessage = "Mary is standing there. Choose a nearby spot.";
        publishUi();
        return;
      }

      const rose = getRoseAt(runtime, gridX, gridY);
      runtime.selected = { gridX, gridY, roseId: rose?.id };
      runtime.target = getAdjacentTarget(runtime.mary, gridX, gridY);
      runtime.statusMessage = rose ? "Walking over to the rose..." : "Walking to that spot...";
      publishUi();
    }

    function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const screenX = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
      const screenY = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
      const cell = screenToGrid(
        screenX,
        screenY,
        runtimeRef.current.camera,
        { width: canvas.width, height: canvas.height },
        runtimeRef.current.zoom,
      );
      selectCell(cell.gridX, cell.gridY);
      canvas.focus({ preventScroll: true });
    }

    function onKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        w: [0, -1],
        W: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
        S: [0, 1],
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        A: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
        D: [1, 0],
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      const runtime = runtimeRef.current;
      const currentGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const currentGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      const nextGridX = currentGridX + direction[0];
      const nextGridY = currentGridY + direction[1];
      if (!isWithinGarden(nextGridX, nextGridY)) {
        runtime.target = null;
        runtime.statusMessage = "You have reached the garden edge.";
        publishUi();
        return;
      }
      runtime.selected = null;
      runtime.target = gridToWorld(nextGridX, nextGridY);
      runtime.statusMessage = "Exploring the garden...";
      publishUi();
    }

    return (
      <canvas
        ref={canvasRef}
        className="cg-canvas"
        role="application"
        aria-label="Community Garden. Tap a location to walk, plant, or water a rose."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  },
);

