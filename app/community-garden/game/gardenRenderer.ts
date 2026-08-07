import { GARDEN_CONFIG, isWithinGarden } from "../lib/gardenConfig";
import {
  gridToWorld,
  worldToScreen,
  type GardenViewport,
  type WorldPoint,
} from "../lib/cameraProjection";
import {
  getMyGardenElement,
  type MyGardenElementType,
} from "../lib/myGardenCatalog";
import {
  canEarnWateringCare,
  getPlantVisual,
  isSpecialWateringFlower,
  type PlantRecord,
} from "../lib/roseLifecycle";
import {
  HERITAGE_GOLD_DARK,
  HERITAGE_GOLD_LIGHT,
} from "../lib/heritageDiscovery";
import {
  buildHeritageAuraField,
  findHeritageAuraAnchor,
  getHeritageAuraFieldMultiplier,
  getHeritageGrowthProfile,
  type HeritageAuraMultiplier,
  type HeritageGrowthPhase,
} from "../lib/heritageAura";
import { getTerrainTile, terrainNoise } from "./terrainGenerator";
import {
  getLivingGardenDefinition,
  type LivingGardenDefinition,
  type LivingGardenHabitat,
} from "../lib/livingGarden";

export {
  getWorldScreenOrigin,
  gridToWorld,
  screenToGrid,
  worldToScreen,
} from "../lib/cameraProjection";
export type { GardenViewport, WorldPoint } from "../lib/cameraProjection";
export type GardenWorldMode = "community" | "personal";
export type SelectedCell = {
  gridX: number;
  gridY: number;
  plantId?: string;
  weedId?: string;
} | null;
export type GardenEffect =
  | {
      kind: "plant" | "water" | "uproot" | "path" | "worm";
      gridX: number;
      gridY: number;
      startedAt: number;
    }
  | {
      kind: "care";
      x: number;
      y: number;
      value: number;
      dailyBonus?: boolean;
      startedAt: number;
    }
  | {
      kind: "spray";
      fromX: number;
      fromY: number;
      gridX: number;
      gridY: number;
      startedAt: number;
    };

export type RenderGardenState = {
  viewport: GardenViewport;
  camera: WorldPoint;
  zoom: number;
  mary: WorldPoint;
  duck: WorldPoint;
  plants: PlantRecord[];
  weeds: Array<{ id: string; grid_x: number; grid_y: number; spawned_at: string }>;
  selected: SelectedCell;
  wateringTargets: Array<NonNullable<SelectedCell>>;
  wateringCareReadyPlantIds?: ReadonlySet<string>;
  wateringCareStatusLoaded?: boolean;
  suggestedPlantingCell: SelectedCell;
  suggestedWateringCell: SelectedCell;
  gardenWorms: Array<{ gridX: number; gridY: number; surfacedAt: number }>;
  tutorialDimmed: boolean;
  effects: GardenEffect[];
  moving: boolean;
  now: number;
  mode: GardenWorldMode;
  communityRegions?: Array<{
    regionX: number;
    regionY: number;
    isOpen: boolean;
    publicStage: "garden" | "edge" | "growing" | "ready" | "new" | "resting" | "wild";
    guidanceZone: "garden" | "heart" | "growth-ring" | null;
  }>;
  personalCommunityFlowers?: Array<{
    gridX: number;
    gridY: number;
    plantId?: string;
  }>;
  shareOnly?: boolean;
  reducedMotion?: boolean;
  personalGarden?: {
    minX: number;
    minY: number;
    width: number;
    height: number;
    maxWidth: number;
    maxHeight: number;
    elements: Array<{
      id: string;
      gridX: number;
      gridY: number;
      elementType: MyGardenElementType;
      careCost: number;
    }>;
    paths: Array<{ gridX: number; gridY: number }>;
    livingHabitats?: LivingGardenHabitat[];
    gardenJournalEnabled?: boolean;
    gardenJournalUnreadCount?: number;
    unlockedParcels?: Array<{
      minX: number;
      minY: number;
      width: number;
      height: number;
    }>;
    expansionCandidates?: Array<{
      minX: number;
      minY: number;
      width: number;
      height: number;
      careCost: number;
      source?: "starter" | "legacy" | "classic" | "freeform";
    }>;
    selectedParcel?: {
      minX: number;
      minY: number;
      width: number;
      height: number;
    };
    nextExpansion: null | {
      minX: number;
      minY: number;
      width: number;
      height: number;
      careCost: number;
    };
  };
  builderPreview?: {
    mode: "place" | "remove";
    cells: Array<{ gridX: number; gridY: number }>;
    invalidCell: { gridX: number; gridY: number } | null;
  };
};

function livingGardenHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function drawLivingGardenVisitorGlyph(
  ctx: CanvasRenderingContext2D,
  definition: LivingGardenDefinition,
) {
  const { pixels, palette } = definition.sprite;
  const pixelSize = 1.45;
  const width = (pixels[0]?.length ?? 1) * pixelSize;
  const height = pixels.length * pixelSize;
  const startX = -width / 2;
  const startY = -height / 2;

  pixels.forEach((row, y) => {
    Array.from(row).forEach((colorKey, x) => {
      const color = palette[colorKey];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(
        startX + x * pixelSize,
        startY + y * pixelSize,
        pixelSize + 0.08,
        pixelSize + 0.08,
      );
    });
  });
}

function drawLivingGardenHabitats(
  ctx: CanvasRenderingContext2D,
  habitats: readonly LivingGardenHabitat[],
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  now: number,
  reducedMotion: boolean,
) {
  const visible = [...habitats]
    .sort((left, right) => {
      const leftWorld = gridToWorld(left.gridX, left.gridY);
      const rightWorld = gridToWorld(right.gridX, right.gridY);
      return (
        Math.hypot(leftWorld.x - camera.x, leftWorld.y - camera.y) -
        Math.hypot(rightWorld.x - camera.x, rightWorld.y - camera.y)
      );
    })
    .slice(0, 5);

  for (const habitat of visible) {
    const definition = getLivingGardenDefinition(habitat.key);
    const hash = livingGardenHash(habitat.signature);
    const phase = reducedMotion ? 0 : now / (1_700 + (hash % 1_100)) + hash;
    const orbit = definition.visitorKind === "seedlings" || definition.visitorKind === "canopy" ? 3 : 10;
    const world = gridToWorld(habitat.gridX, habitat.gridY);
    const screen = worldToScreen(
      {
        x: world.x + Math.cos(phase) * orbit,
        y: world.y + Math.sin(phase * 1.3) * (orbit * 0.55),
      },
      camera,
      viewport,
      zoom,
    );
    screen.y -= (16 + (hash % 7)) * zoom;
    if (!isVisible(screen, viewport, 30)) continue;
    ctx.save();
    ctx.translate(Math.round(screen.x), Math.round(screen.y));
    ctx.scale(Math.max(0.7, zoom), Math.max(0.7, zoom));
    ctx.globalAlpha = 0.9;
    drawLivingGardenVisitorGlyph(ctx, definition);
    ctx.restore();
  }
}

type TerrainLayer = "base" | "soil" | "green";

let baseLayer: HTMLCanvasElement | null = null;
let soilLayer: HTMLCanvasElement | null = null;
let greenLayer: HTMLCanvasElement | null = null;
let maskLayer: HTMLCanvasElement | null = null;

function terrainCellKey(gridX: number, gridY: number) {
  return `${gridX}:${gridY}`;
}

function ensureLayer(current: HTMLCanvasElement | null, viewport: GardenViewport) {
  const canvas = current ?? document.createElement("canvas");
  if (canvas.width !== viewport.width) canvas.width = viewport.width;
  if (canvas.height !== viewport.height) canvas.height = viewport.height;
  return canvas;
}

function getMaryScreenY(viewport: GardenViewport) {
  return viewport.height * GARDEN_CONFIG.maryScreenYRatio;
}

function getVisibleGridBounds(
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const yScale = tileScreenHeight / tileSize;
  const halfWorldWidth = viewport.width / (2 * zoom);
  const minWorldY = camera.y - getMaryScreenY(viewport) / (yScale * zoom);
  const maxWorldY = camera.y + (viewport.height - getMaryScreenY(viewport)) / (yScale * zoom);
  return {
    minGridX: Math.floor((camera.x - halfWorldWidth) / tileSize) - 2,
    maxGridX: Math.ceil((camera.x + halfWorldWidth) / tileSize) + 2,
    minGridY: Math.floor(minWorldY / tileSize) - 2,
    maxGridY: Math.ceil(maxWorldY / tileSize) + 2,
  };
}

function drawGroundMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 3 * scale, y + 7 * scale, 3 * scale, scale);
  ctx.fillRect(x + 7 * scale, y + 6 * scale, 2 * scale, scale);
  ctx.fillRect(x + 10 * scale, y + 8 * scale, 3 * scale, scale);
}

function drawWeed(
  ctx: CanvasRenderingContext2D,
  weed: { grid_x: number; grid_y: number },
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const point = worldToScreen(
    gridToWorld(weed.grid_x, weed.grid_y),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);
  ctx.fillStyle = "#756448";
  ctx.fillRect(-5, 3, 10, 2);
  ctx.fillStyle = "#56734e";
  ctx.fillRect(-1, -5, 2, 9);
  ctx.fillRect(-5, -2, 4, 2);
  ctx.fillRect(1, -1, 5, 2);
  ctx.fillStyle = "#7f9a61";
  ctx.fillRect(-4, -4, 3, 2);
  ctx.fillRect(2, -5, 3, 2);
  ctx.fillStyle = "#eee7cf";
  ctx.fillRect(-1, -7, 2, 2);
  ctx.restore();
}

function drawGardenWorm(
  ctx: CanvasRenderingContext2D,
  worm: { gridX: number; gridY: number; surfacedAt: number },
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  const point = worldToScreen(
    gridToWorld(worm.gridX, worm.gridY),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  const wiggle = Math.sin((now - worm.surfacedAt) / 260) * 1.5;
  ctx.save();
  ctx.translate(Math.round(point.x + wiggle), Math.round(point.y + 2));
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#d88a72";
  ctx.fillRect(-6, -2, 4, 3);
  ctx.fillStyle = "#c46f5f";
  ctx.fillRect(-2, -3, 4, 3);
  ctx.fillStyle = "#a9514c";
  ctx.fillRect(2, -2, 5, 3);
  ctx.fillStyle = "#34231f";
  ctx.fillRect(5, -1, 1, 1);
  ctx.fillStyle = "rgba(255, 250, 224, 0.72)";
  ctx.fillRect(-8, 3, 16, 1);
  ctx.restore();
}

function getSuggestedPlantingScreen(
  cell: NonNullable<SelectedCell>,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  return worldToScreen(
    gridToWorld(cell.gridX, cell.gridY),
    camera,
    viewport,
    zoom,
  );
}

function drawSuggestedPlantingHighlight(
  ctx: CanvasRenderingContext2D,
  cell: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  if (!cell) return;
  const screen = getSuggestedPlantingScreen(cell, camera, viewport, zoom);
  const pulse = 0.84 + Math.sin(now / 180) * 0.12;
  const width = GARDEN_CONFIG.tileSize * zoom;
  const height = GARDEN_CONFIG.tileScreenHeight * zoom * 1.06;
  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y));
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(255, 217, 91, 0.42)";
  ctx.strokeStyle = "#b83136";
  ctx.lineWidth = Math.max(3, Math.round(3 * zoom));
  ctx.setLineDash([Math.max(5, 6 * zoom), Math.max(3, 4 * zoom)]);
  ctx.beginPath();
  ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSuggestedWateringHighlight(
  ctx: CanvasRenderingContext2D,
  cell: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  if (!cell) return;
  const screen = getSuggestedPlantingScreen(cell, camera, viewport, zoom);
  const pulse = 0.78 + Math.sin(now / 170) * 0.18;
  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y));
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(142, 216, 238, 0.32)";
  ctx.strokeStyle = "#8ed8ee";
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 3]);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff4df";
  ctx.fillRect(-2, -18, 4, 7);
  ctx.fillRect(-4, -15, 8, 6);
  ctx.fillStyle = "#5aaac8";
  ctx.fillRect(-1, -17, 2, 5);
  ctx.restore();
}

function drawPersonalCommunityFlowerMarkers(
  ctx: CanvasRenderingContext2D,
  flowers: NonNullable<RenderGardenState["personalCommunityFlowers"]>,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const markerSize = Math.max(8, GARDEN_CONFIG.tileSize * zoom * 0.72);
  for (const flower of flowers) {
    const screen = worldToScreen(
      gridToWorld(flower.gridX, flower.gridY),
      camera,
      viewport,
      zoom,
    );
    if (!isVisible(screen, viewport, markerSize)) continue;
    ctx.save();
    ctx.translate(Math.round(screen.x), Math.round(screen.y));
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = "#c6f4e4";
    ctx.lineWidth = Math.max(2, Math.round(2 * zoom));
    ctx.setLineDash([Math.max(3, 4 * zoom), Math.max(2, 3 * zoom)]);
    ctx.strokeRect(
      -markerSize / 2,
      -markerSize / 2,
      markerSize,
      markerSize,
    );
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff4df";
    ctx.fillRect(-markerSize / 2, -markerSize / 2, 4, 4);
    ctx.restore();
  }
}

function drawTutorialDimmer(
  ctx: CanvasRenderingContext2D,
  viewport: GardenViewport,
  mary: WorldPoint,
  camera: WorldPoint,
  zoom: number,
) {
  const maryScreen = worldToScreen(mary, camera, viewport, zoom);
  const innerRadius = Math.max(30, 38 * zoom);
  const outerRadius = Math.max(viewport.width, viewport.height) * 0.82;
  const vignette = ctx.createRadialGradient(
    maryScreen.x,
    maryScreen.y,
    innerRadius,
    maryScreen.x,
    maryScreen.y,
    outerRadius,
  );
  vignette.addColorStop(0, "rgba(52, 35, 31, 0.05)");
  vignette.addColorStop(0.2, "rgba(52, 35, 31, 0.13)");
  vignette.addColorStop(0.56, "rgba(52, 35, 31, 0.36)");
  vignette.addColorStop(1, "rgba(52, 35, 31, 0.5)");
  ctx.save();
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.restore();
}

function rectanglesOverlap(
  first: { left: number; top: number; right: number; bottom: number },
  second: { left: number; top: number; right: number; bottom: number },
) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function drawSuggestedPlantingLabel(
  ctx: CanvasRenderingContext2D,
  cell: SelectedCell,
  mary: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  if (!cell) return;
  const screen = getSuggestedPlantingScreen(cell, camera, viewport, zoom);
  const maryScreen = worldToScreen(mary, camera, viewport, zoom);
  const width = GARDEN_CONFIG.tileSize * zoom;
  const height = GARDEN_CONFIG.tileScreenHeight * zoom * 1.06;
  const labelWidth = Math.max(54, Math.round(62 * zoom));
  const labelHeight = Math.max(18, Math.round(19 * zoom));
  const gap = Math.max(16, Math.round(18 * zoom));
  const candidates = [
    { x: 0, y: -height / 2 - labelHeight - gap },
    { x: width / 2 + labelWidth / 2 + gap, y: -labelHeight / 2 },
    { x: -width / 2 - labelWidth / 2 - gap, y: -labelHeight / 2 },
    { x: 0, y: height / 2 + gap },
  ];
  const playerBounds = {
    left: maryScreen.x - screeÛ5âÚ$z{-®éÜj×‚ç&÷VæB‡ö–çBç‚ÒF–ÆUv–GF‚ò"’À¢ÖF‚ç&÷VæB‡ö–çBç’ÒF–ÆT†V–v‡Bò"’À¢ÖF‚ç&÷VæB‡F–ÆUv–GF‚’À¢ÖF‚ç&÷VæB‡F–ÆT†V–v‡B’À¢“°¢7G‚æf–ÆÅ7G–ÆRÒ"6ffc†Sr#°¢7G‚æföçBÒ“G´ÖF‚æÖ‚ƒÂÖF‚ç&÷VæBƒ¢¦ööÒ’—×‚$6÷W&–W"æWr"ÂÖöæ÷76V°¢7G‚çFW‡DÆ–vâÒ&6VçFW"#°¢7G‚çFW‡D&6VÆ–æRÒ&Ö–FFÆR#°¢7G‚æf–ÆÅFW‡B…7G&–ær†–æFW‚²’Âö–çBç‚Âö–çBç’“°¢Ò“° ¢–b‡&Wf–Wræ–çfÆ–D6VÆÂ’°¢6öç7Bö–çBÒv÷&ÆEFõ67&VVâ€¢w&–EFõv÷&ÆB‡&Wf–Wræ–çfÆ–D6VÆÂæw&–E‚Â&Wf–Wræ–çfÆ–D6VÆÂæw&–E’’À¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢7G‚ç7G&ö¶U7G–ÆRÒ"6SCCsCr#°¢7G‚æÆ–æUv–GF‚ÒÖF‚æÖ‚ƒ2ÂB¢¦ööÒ“°¢7G‚ç7G&ö¶U&V7B€¢ÖF‚ç&÷VæB‡ö–çBç‚ÒF–ÆUv–GF‚ò"’À¢ÖF‚ç&÷VæB‡ö–çBç’ÒF–ÆT†V–v‡Bò"’À¢ÖF‚ç&÷VæB‡F–ÆUv–GF‚’À¢ÖF‚ç&÷VæB‡F–ÆT†V–v‡B’À¢“°¢Ğ¢7G‚ç&W7F÷&R‚“°§Ğ ¦gVæ7F–öâG&tGV6²€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢ö–çC¢v÷&ÆEö–çBÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢Ö÷f–æs¢&ööÆVâÀ¢æ÷s¢çVÖ&W"À¢¦ööÓ¢çVÖ&W"À¢’°¢6öç7B67&VVâÒv÷&ÆEFõ67&VVâ‡ö–çBÂ6ÖW&Âf–Ww÷'BÂ¦ööÒ“°¢6öç7BvFFÆRÒÖ÷f–ærbbÖF‚æfÆö÷"†æ÷ròS’R"ÓÓÒò¢Ó°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡67&VVâç‚’²vFFÆR¢¦ööÒÂÖF‚ç&÷VæB‡67&VVâç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢7G‚æf–ÆÅ7G–ÆRÒ"6cVcFb#°¢7G‚æf–ÆÅ&V7B‚ÓRÂÓ‚ÂÂ‚“°¢7G‚æf–ÆÅ&V7B‚Ó2ÂÓ"ÂrÂb“°¢7G‚æf–ÆÅ7G–ÆRÒ"3&c33#°¢7G‚æf–ÆÅ&V7Bƒ"ÂÓÂÂ“°¢7G‚æf–ÆÅ7G–ÆRÒ"6Cf6"#°¢7G‚æf–ÆÅ&V7BƒBÂÓ’ÂBÂ"“°¢7G‚æf–ÆÅ&V7B‚ÓBÂÂ2Â“°¢7G‚æf–ÆÅ&V7Bƒ"ÂÂ2Â“°¢7G‚ç&W7F÷&R‚“°§Ğ ¦gVæ7F–öâG&tVffV7G2€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢VffV7G3¢v&FVäVffV7EµÒÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢æ÷s¢çVÖ&W"À¢¦ööÓ¢çVÖ&W"À¢’°¢f÷"†6öç7BVffV7BöbVffV7G2’°¢6öç7BvRÒæ÷rÒVffV7Bç7F'FVDC°¢6öç7BGW&F–öâĞ¢VffV7Bæ¶–æBÓÓÒ&6&R"ò¢VffV7Bæ¶–æBÓÓÒ'v÷&Ò"òƒ¢“°¢–b†vRÂÇÂvRâGW&F–öâ’6öçF–çVS°¢6öç7B&öw&W72ÒvRòGW&F–öã°¢–b†VffV7Bæ¶–æBÓÓÒ'7&’"’°¢6öç7Bg&öÒÒv÷&ÆEFõ67&VVâ€¢²ƒ¢VffV7Bæg&öÕ‚Â“¢VffV7Bæg&öÕ’Ò‚ÒÀ¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢6öç7BF&vWEv÷&ÆBÒw&–EFõv÷&ÆB†VffV7Bæw&–E‚ÂVffV7Bæw&–E’“°¢6öç7BF—&V7F–öå‚ÒF&vWEv÷&ÆBç‚ÒVffV7Bæg&öÕƒ°¢6öç7BF—&V7F–öå’ÒF&vWEv÷&ÆBç’ÒVffV7Bæg&öÕ“°¢6öç7BF—&V7F–öäÆVæwF‚ÒÖF‚æÖ‚ƒÂÖF‚æ‡—÷B†F—&V7F–öå‚ÂF—&V7F–öå’’“°¢6öç7BW‡FVæFVEF&vWBÒ°¢ƒ¢F&vWEv÷&ÆBç‚²†F—&V7F–öå‚òF—&V7F–öäÆVæwF‚’¢3"À¢“¢F&vWEv÷&ÆBç’²†F—&V7F–öå’òF—&V7F–öäÆVæwF‚’¢3"À¢Ó°¢6öç7BFòÒv÷&ÆEFõ67&VVâ€¢W‡FVæFVEF&vWBÀ¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢7G‚ç6fR‚“°¢7G‚ævÆö&ÄÇ†ÒÖF‚ç6–â‡&öw&W72¢ÖF‚å’’¢ãsC°¢7G‚æf–ÆÅ7G–ÆRÒ"3sV#v6b#°¢f÷"†ÆWB–æFW‚Ò²–æFW‚ÃÒ#²–æFW‚³Ò’°¢6öç7BBÒ–æFW‚ò3°¢6öç7B&2ÒÖF‚ç6–â‡B¢ÖF‚å’’¢‚¢¦ööÓ°¢7G‚æf–ÆÅ&V7B€¢ÖF‚ç&÷VæB†g&öÒç‚²‡Fòç‚Òg&öÒç‚’¢B’À¢ÖF‚ç&÷VæB†g&öÒç’²‡Fòç’Òg&öÒç’’¢BÒ&2’À¢ÖF‚æÖ‚ƒÂÖF‚ç&÷VæBƒ"¢¦ööÒ’’À¢ÖF‚æÖ‚ƒÂÖF‚ç&÷VæBƒ"¢¦ööÒ’’À¢“°¢Ğ¢7G‚ç&W7F÷&R‚“°¢6öçF–çVS°¢Ğ¢6öç7Bö–çBĞ¢VffV7Bæ¶–æBÓÓÒ&6&R ¢òv÷&ÆEFõ67&VVâ‡²ƒ¢VffV7Bç‚Â“¢VffV7Bç’ÒÂ6ÖW&Âf–Ww÷'BÂ¦ööÒ¢¢v÷&ÆEFõ67&VVâ€¢w&–EFõv÷&ÆB†VffV7Bæw&–E‚ÂVffV7Bæw&–E’’À¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡ö–çBç‚’ÂÖF‚ç&÷VæB‡ö–çBç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢–b†VffV7Bæ¶–æBÓÓÒ&6&R"’°¢6öç7BfFT–âÒÖF‚æÖ–âƒÂ&öw&W72òã"“°¢6öç7BfFT÷WBÒÖF‚æÖ–âƒÂƒÒ&öw&W72’òã#‚“°¢7G‚ævÆö&ÄÇ†ÒÖF‚æÖ–â†fFT–âÂfFT÷WB“°¢7G‚çG&ç6ÆFRƒÂÓ3Ò&öw&W72¢‚“°¢7G‚çFW‡DÆ–vâÒ&6VçFW"#°¢7G‚çFW‡D&6VÆ–æRÒ&Ö–FFÆR#°¢7G‚æföçBÒs“G‚$6÷W&–W"æWr"ÂÖöæ÷76Rs°¢7G‚æÆ–æUv–GF‚Ò3°¢7G‚ç7G&ö¶U7G–ÆRÒ'&v&ƒ#SRÂ#CBÂ##2Âã“"’#°¢7G‚æf–ÆÅ7G–ÆRÒVffV7BæF–Ç”&öçW2ò"3SsƒcV"¢"63“FcF2#°¢6öç7BÆ&VÂÒ²G¶VffV7BçfÇVWÖ°¢7G‚ç7G&ö¶UFW‡B†Æ&VÂÂÂ“°¢7G‚æf–ÆÅFW‡B†Æ&VÂÂÂ“°¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'vFW""’°¢7G‚æf–ÆÅ7G–ÆRÒ"3sV#v6b#°¢f÷"†ÆWB–æFW‚Ò²–æFW‚ÂC²–æFW‚³Ò’°¢6öç7Böfg6WBÒ–æFW‚¢BÒc°¢7G‚æf–ÆÅ&V7B†öfg6WBÂÓ#²&öw&W72¢b²†–æFW‚R"’¢2Â"Â2“°¢Ğ¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'v÷&Ò"’°¢6öç7Bv–vvÆRÒÖF‚ç6–â‡&öw&W72¢ÖF‚å’¢b’¢3°¢7G‚ævÆö&ÄÇ†ÒÖF‚ç6–â‡&öw&W72¢ÖF‚å’“°¢7G‚çG&ç6ÆFR‡v–vvÆRÂÓ"Ò&öw&W72¢"“°¢7G‚æf–ÆÅ7G–ÆRÒ"6Cƒ†s"#°¢7G‚æf–ÆÅ&V7B‚ÓrÂÓ"ÂRÂB“°¢7G‚æf–ÆÅ7G–ÆRÒ"63CfcVb#°¢7G‚æf–ÆÅ&V7B‚Ó"ÂÓBÂRÂB“°¢7G‚æf–ÆÅ7G–ÆRÒ"6“SF2#°¢7G‚æf–ÆÅ&V7Bƒ2ÂÓ"ÂRÂB“°¢7G‚æf–ÆÅ7G–ÆRÒ"33C#3b#°¢7G‚æf–ÆÅ&V7BƒbÂÓÂÂ“°¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'ÆçB"’°¢7G‚æf–ÆÅ7G–ÆRÒ"3ƒscCCB#°¢7G‚æf–ÆÅ&V7B‚ÓrÒ&öw&W72¢BÂÓ2Â2Â"“°¢7G‚æf–ÆÅ&V7BƒB²&öw&W72¢BÂÓRÂ2Â"“°¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'F‚"’°¢7G‚æf–ÆÅ7G–ÆRÒ"6S3C“R#°¢7G‚æf–ÆÅ&V7B‚Ó‚Ò&öw&W72¢"ÂÓrÒ&öw&W72¢2Â2Â"“°¢7G‚æf–ÆÅ&V7BƒR²&öw&W72¢"ÂÓRÒ&öw&W72¢BÂ2Â"“°¢ÒVÇ6R°¢7G‚æf–ÆÅ7G–ÆRÒ"6c&C†2#°¢7G‚æf–ÆÅ&V7B‚ÓbÒ&öw&W72¢RÂÓÒ&öw&W72¢bÂ2Â2“°¢7G‚æf–ÆÅ&V7Bƒ2²&öw&W72¢RÂÓrÒ&öw&W72¢‚Â2Â2“°¢Ğ¢7G‚ç&W7F÷&R‚“°¢Ğ§Ğ ¦W‡÷'BgVæ7F–öâ&VæFW$v&FVâ†7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÂ7FFS¢&VæFW$v&FVå7FFR’°¢–b‡7FFRæÖöFRÓÓÒ'W'6öæÂ"bb7FFRçW'6öæÄv&FVâ’°¢6öç7Bf—6–&ÆUÆçG2Ò7FFRçÆçG2æf–ÇFW"€¢‡ÆçB’ÓâvWEÆçEf—7VÂ‡ÆçBÂ7FFRææ÷r’ç7FFRÓÒ&W‡—&VB"À¢“°¢7G‚æ–ÖvU6Öö÷F†–ætVæ&ÆVBÒfÇ6S°¢7G‚æ6ÆV%&V7BƒÂÂ7FFRçf–Ww÷'Bçv–GF‚Â7FFRçf–Ww÷'Bæ†V–v‡B“°¢G&uW'6öæÅFW'&–â€¢7G‚À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRçW'6öæÄv&FVâæÖ–å‚À¢7FFRçW'6öæÄv&FVâæÖ–å’À¢7FFRçW'6öæÄv&FVâçv–GF‚À¢7FFRçW'6öæÄv&FVâæ†V–v‡BÀ¢7FFRçW'6öæÄv&FVâææW‡DW‡ç6–öâÀ¢7FFRçW'6öæÄv&FVâçVæÆö6¶VE&6VÇ2À¢7FFRçW'6öæÄv&FVâæW‡ç6–öä6æF–FFW2À¢7FFRç6†&TöæÇ’À¢“°¢G&uW'6öæÅF‡2€¢7G‚À¢7FFRçW'6öæÄv&FVâçF‡2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢G&uW'6öæÄFV6÷&F–öç2€¢7G‚À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRçW'6öæÄv&FVâæÖ–å‚À¢7FFRçW'6öæÄv&FVâæÖ–å’À¢7FFRçW'6öæÄv&FVâçv–GF‚À¢7FFRçW'6öæÄv&FVâæ†V–v‡BÀ¢7FFRçW'6öæÄv&FVâææW‡DW‡ç6–öâÀ¢7FFRçW'6öæÄv&FVâçVæÆö6¶VE&6VÇ2À¢7FFRçW'6öæÄv&FVâæW‡ç6–öä6æF–FFW2À¢“°¢G&u6VÆV7FVEW'6öæÅ&6VÂ€¢7G‚À¢7FFRçW'6öæÄv&FVâç6VÆV7FVE&6VÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&uW'6öæÅ6ö–ÅF6†W2€¢7G‚À¢f—6–&ÆUÆçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢G&tF×6ö–Â†7G‚Âf—6–&ÆUÆçG2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&uW'6öæÄFWF„ö&¦V7G2€¢7G‚À¢f—6–&ÆUÆçG2À¢7FFRçW'6öæÄv&FVâæVÆVÖVçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tÆ—f–ætv&FVä†&—FG2€¢7G‚À¢7FFRçW'6öæÄv&FVâæÆ—f–æt†&—FG2óòµÒÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRææ÷rÀ¢&ööÆVâ‡7FFRç&VGV6VDÖ÷F–öâ’À¢“°¢òòF†R†÷W6R—2f—†VBf÷&Vw&÷VæB7G'V7GW&Râv&FVâ—FV×2Ö’7F–ÆÂ&P¢òòÆ6VB&VæVF‚—BÂ'WBF†W’6†÷VÆB&VB2&V–ær&V†–æBF†R'V–ÆF–æp¢òò–ç7FVBöb–çF–ær÷fW"—G2&ööbæBvÆÇ2à¢G&u—†VÅ6†VB€¢7G‚À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢&ööÆVâ‡7FFRçW'6öæÄv&FVâæv&FVä¦÷W&æÄVæ&ÆVB’À¢7FFRçW'6öæÄv&FVâæv&FVä¦÷W&æÅVç&VD6÷VçBóòÀ¢“°¢G&tGV6²†7G‚Â7FFRæGV6²Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢–b‡7FFRçGWF÷&–ÄF–ÖÖVB’°¢G&uGWF÷&–ÄF–ÖÖW"€¢7G‚À¢7FFRçf–Ww÷'BÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢Ğ¢G&tÖ'’†7G‚Â7FFRæÖ'’Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u7VvvW7FVEÆçF–ætÆ&VÂ€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tVffV7G2†7G‚Â7FFRæVffV7G2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢–b‡7FFRæ'V–ÆFW%&Wf–Wr’°¢G&t'V–ÆFW%&Wf–Wr€¢7G‚À¢7FFRæ'V–ÆFW%&Wf–WrÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢ÒVÇ6R°¢G&u6VÆV7F–öâ†7G‚Â7FFRç6VÆV7FVBÂ7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRç¦ööÒ“°¢Ğ¢&WGW&ã°¢Ğ ¢&6TÆ–W"ÒVç7W&TÆ–W"†&6TÆ–W"Â7FFRçf–Ww÷'B“°¢6ö–ÄÆ–W"ÒVç7W&TÆ–W"‡6ö–ÄÆ–W"Â7FFRçf–Ww÷'B“°¢w&VVäÆ–W"ÒVç7W&TÆ–W"†w&VVäÆ–W"Â7FFRçf–Ww÷'B“°¢Ö6´Æ–W"ÒVç7W&TÆ–W"†Ö6´Æ–W"Â7FFRçf–Ww÷'B“°¢6öç7B&6T7G‚Ò&6TÆ–W"ævWD6öçFW‡B‚#&B"“°¢6öç7B6ö–Ä7G‚Ò6ö–ÄÆ–W"ævWD6öçFW‡B‚#&B"“°¢6öç7Bw&VVä7G‚Òw&VVäÆ–W"ævWD6öçFW‡B‚#&B"“°¢6öç7BÖ6´7G‚ÒÖ6´Æ–W"ævWD6öçFW‡B‚#&B"“°¢–b‚&6T7G‚ÇÂ6ö–Ä7G‚ÇÂw&VVä7G‚ÇÂÖ6´7G‚’&WGW&ã° ¢6öç7Bf—6–&ÆUÆçG2Ò7FFRçÆçG2æf–ÇFW"€¢‡ÆçB’ÓâvWEÆçEf—7VÂ‡ÆçBÂ7FFRææ÷r’ç7FFRÓÒ&W‡—&VB"À¢“°¢6öç7B†W&—FvTW&f–VÆBÒ'V–ÆD†W&—FvTW&f–VÆB‡f—6–&ÆUÆçG2“°¢6öç7Bö67W–VD6VÆÇ2ÒæWr6WB€¢°¢ââçf—6–&ÆUÆçG2æÖ‚‡ÆçB’ÓâFW'&–ä6VÆÄ¶W’‡ÆçBæw&–E÷‚ÂÆçBæw&–E÷’’’À¢ââç7FFRçvVVG2æÖ‚‡vVVB’ÓâFW'&–ä6VÆÄ¶W’‡vVVBæw&–E÷‚ÂvVVBæw&–E÷’’’À¢ÒÀ¢“°¢6öç7B÷Vå&Vv–öä¶W—2Ò7FFRæ6öÖ×Væ—G•&Vv–öç0¢òæWr6WB€¢7FFRæ6öÖ×Væ—G•&Vv–öç0¢æf–ÇFW"‚‡&Vv–öâ’Óâ&Vv–öâæ—4÷Vâ¢æÖ‚‡&Vv–öâ’ÓâG·&Vv–öâç&Vv–öå‡Ó¢G·&Vv–öâç&Vv–öå—Ö’À¢¢¢çVÆÃ°¢6öç7Bw&÷v–ætVFvU7FvW2ÒæWrÖ€¢‡7FFRæ6öÖ×Væ—G•&Vv–öç2óòµÒ’æfÆDÖ‚‡&Vv–öâ’Óà¢&Vv–öâæ—4÷Vâb`¢‡&Vv–öâçV&Æ–57FvRÓÓÒ&VFvR"ÇÀ¢&Vv–öâçV&Æ–57FvRÓÓÒ&w&÷v–ær"ÇÀ¢&Vv–öâçV&Æ–57FvRÓÓÒ'&VG’"¢òµ°¢G·&Vv–öâç&Vv–öå‡Ó¢G·&Vv–öâç&Vv–öå—ÖÀ¢&Vv–öâçV&Æ–57FvR2&VFvR"Â&w&÷v–ær"Â'&VG’"À¢Ò26öç7EĞ¢¢µÒÀ¢’À¢“°¢6öç7BwV–Fæ6U¦öæW2ÒæWrÖ€¢‡7FFRæ6öÖ×Væ—G•&Vv–öç2óòµÒ’æfÆDÖ‚‡&Vv–öâ’Óà¢&Vv–öâæ—4÷Vâb`¢‡&Vv–öâæwV–Fæ6U¦öæRÓÓÒ&†V'B"ÇÀ¢&Vv–öâæwV–Fæ6U¦öæRÓÓÒ&w&÷wF‚×&–ær"¢òµ°¢G·&Vv–öâç&Vv–öå‡Ó¢G·&Vv–öâç&Vv–öå—ÖÀ¢&Vv–öâæwV–Fæ6U¦öæRÀ¢Ò26öç7EĞ¢¢µÒÀ¢’À¢“°¢7G‚æ–ÖvU6Öö÷F†–ætVæ&ÆVBÒfÇ6S°¢7G‚æ6ÆV%&V7BƒÂÂ7FFRçf–Ww÷'Bçv–GF‚Â7FFRçf–Ww÷'Bæ†V–v‡B“°¢G&uFW'&–äÆ–W"†&6T7G‚Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ&&6R"Â7FFRç¦ööÒÂö67W–VD6VÆÇ2Â÷Vå&Vv–öä¶W—2Âw&÷v–ætVFvU7FvW2ÂwV–Fæ6U¦öæW2“°¢G&uFW'&–äÆ–W"‡6ö–Ä7G‚Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ'6ö–Â"Â7FFRç¦ööÒÂö67W–VD6VÆÇ2Â÷Vå&Vv–öä¶W—2Âw&÷v–ætVFvU7FvW2ÂwV–Fæ6U¦öæW2“°¢G&t6öÆ÷$Ö6²€¢Ö6´7G‚À¢f—6–&ÆUÆçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢'6ö–Â"À¢7FFRç¦ööÒÀ¢†W&—FvTW&f–VÆBÀ¢“°¢Ç”Ö6²‡6ö–Ä7G‚ÂÖ6´7G‚ÂÖ6´Æ–W"“°¢G&uFW'&–äÆ–W"†w&VVä7G‚Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ&w&VVâ"Â7FFRç¦ööÒÂö67W–VD6VÆÇ2Â÷Vå&Vv–öä¶W—2Âw&÷v–ætVFvU7FvW2ÂwV–Fæ6U¦öæW2“°¢G&t6öÆ÷$Ö6²€¢Ö6´7G‚À¢f—6–&ÆUÆçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢&w&VVâ"À¢7FFRç¦ööÒÀ¢†W&—FvTW&f–VÆBÀ¢“°¢Ç”Ö6²†w&VVä7G‚ÂÖ6´7G‚ÂÖ6´Æ–W"“° ¢7G‚æG&t–ÖvR†&6TÆ–W"ÂÂ“°¢7G‚æG&t–ÖvR‡6ö–ÄÆ–W"ÂÂ“°¢7G‚æG&t–ÖvR†w&VVäÆ–W"ÂÂ“°¢G&t†W&—FvTW&€¢7G‚À¢f—6–&ÆUÆçG2À¢7FFRç6VÆV7FVBÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEvFW&–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEvFW&–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tF×6ö–Â†7G‚Âf—6–&ÆUÆçG2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢7FFRæv&FVåv÷&×2æf÷$V6‚‚‡v÷&Ò’Óà¢G&tv&FVåv÷&Ò€¢7G‚À¢v÷&ÒÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢’À¢“°¢7FFRçvVVG2æf÷$V6‚‚‡vVVB’Óà¢G&uvVVB†7G‚ÂvVVBÂ7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRç¦ööÒ’À¢“°¢f—6–&ÆUÆçG2æf÷$V6‚‚‡ÆçB’Óà¢G&uÆçB€¢7G‚À¢ÆçBÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢fÇ6RÀ¢VæFVf–æVBÀ¢ÆçBæ†W&—FvUö@¢ò¢¢vWD†W&—FvTW&f–VÆD×VÇF—Æ–W"€¢†W&—FvTW&f–VÆBÀ¢ÆçBæw&–E÷‚À¢ÆçBæw&–E÷’À¢’À¢’À¢“°¢f—6–&ÆUÆçG2æf÷$V6‚‚‡ÆçB’Óà¢G&uÆçD6&T7VR€¢7G‚À¢ÆçBÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢7FFRçvFW&–æt6&U7FGW4ÆöFV@¢ò7FFRçvFW&–æt6&U&VG•ÆçD–G3òæ†2‡ÆçBæ–B’óòfÇ6P¢¢VæFVf–æVBÀ¢’À¢“°¢–b‡7FFRçW'6öæÄ6öÖ×Væ—G”fÆ÷vW'3òæÆVæwF‚’°¢G&uW'6öæÄ6öÖ×Væ—G”fÆ÷vW$Ö&¶W'2€¢7G‚À¢7FFRçW'6öæÄ6öÖ×Væ—G”fÆ÷vW'2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢Ğ¢G&uvFW&–æuF&vWG2€¢7G‚À¢7FFRçvFW&–æuF&vWG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRæÖ'’À¢7FFRç6VÆV7FVBÀ¢“°¢G&tGV6²†7G‚Â7FFRæGV6²Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢–b‡7FFRçGWF÷&–ÄF–ÖÖVB’°¢G&uGWF÷&–ÄF–ÖÖW"€¢7G‚À¢7FFRçf–Ww÷'BÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEvFW&–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEvFW&–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢Ğ¢G&tÖ'’†7G‚Â7FFRæÖ'’Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u7VvvW7FVEÆçF–ætÆ&VÂ€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tVffV7G2†7G‚Â7FFRæVffV7G2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u6VÆV7F–öâ†7G‚Â7FFRç6VÆV7FVBÂ7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRç¦ööÒ“°§Ğ Ğ