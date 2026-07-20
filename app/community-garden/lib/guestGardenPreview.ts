"use client";

import type {
  MyGardenPlant,
  MyGardenPlantType,
  MyGardenState,
} from "@/lib/communityGarden/myGarden";
import type { MyGardenMutation } from "./myGardenMutation";

const STORAGE_KEY = "basil-guest-garden-preview-v1";
const CHECKOUT_TRANSFER_KEY = "basil-guest-garden-checkout-v1";
const CHECKOUT_TRANSFER_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const QUICK_CARE_LIMIT = 20;
const STEADY_ACTIONS_PER_CARE = 4;
export const GUEST_PLANTING_LIMIT = 3;

export type GuestGardenPreview = {
  garden: MyGardenState;
  quickCareEarned: number;
  steadyActions: number;
  journey?: {
    world: "community" | "personal";
    mapX: number;
    mapY: number;
    zoom: number;
    selectedTool: string;
  };
};

export type GuestCareAward = {
  preview: GuestGardenPreview;
  awardedCare: number;
  steadyProgress: number;
};

export class GuestPreviewLimitError extends Error {
  constructor() {
    super("Keep this garden growing with a Garden Membership.");
    this.name = "GuestPreviewLimitError";
  }
}

function clampInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function isPlantType(value: unknown): value is MyGardenPlantType {
  return value === "rose" || value === "sunflower" || value === "lavender";
}

function normalizePlants(value: unknown) {
  if (!Array.isArray(value)) return [];
  const occupied = new Set<string>();
  const plants: MyGardenPlant[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || plants.length >= GUEST_PLANTING_LIMIT) {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const gridX = clampInteger(record.gridX, 0, 11);
    const gridY = clampInteger(record.gridY, 0, 15);
    const key = `${gridX}:${gridY}`;
    if (!isPlantType(record.plantType) || occupied.has(key)) continue;
    occupied.add(key);
    plants.push({
      id:
        typeof record.id === "string"
          ? record.id.slice(0, 120)
          : `preview-${gridX}-${gridY}-${plants.length}`,
      gridX,
      gridY,
      plantType: record.plantType,
      plantedAt:
        typeof record.plantedAt === "string"
          ? record.plantedAt
          : new Date().toISOString(),
    });
  }
  return plants;
}

function normalizePaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  const occupied = new Set<string>();
  const paths: MyGardenState["paths"] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || paths.length >= 64) continue;
    const record = candidate as Record<string, unknown>;
    const gridX = clampInteger(record.gridX, 0, 11);
    const gridY = clampInteger(record.gridY, 0, 15);
    const key = `${gridX}:${gridY}`;
    if (occupied.has(key)) continue;
    occupied.add(key);
    paths.push({ gridX, gridY });
  }
  return paths;
}

export function createGuestGardenPreview(): GuestGardenPreview {
  return {
    quickCareEarned: 0,
    steadyActions: 0,
    garden: {
      careBalance: 0,
      lifetimeCare: 0,
      dailyCareLimit: QUICK_CARE_LIMIT,
      plotLevel: 1,
      minX: 0,
      minY: 0,
      width: 12,
      height: 16,
      maxWidth: 16,
      maxHeight: 16,
      plantCost: 2,
      uprootReturn: 1,
      nextExpansion: {
        level: 2,
        minX: 0,
        minY: 0,
        width: 16,
        height: 16,
        careCost: 30,
      },
      plants: [],
      paths: [],
      elements: [],
      preview: {
        plantingLimit: GUEST_PLANTING_LIMIT,
        plantingsUsed: 0,
      },
    },
  };
}

export function loadGuestGardenPreview() {
  if (typeof window === "undefined") return createGuestGardenPreview();
  try {
    const sessionValue = window.sessionStorage.getItem(STORAGE_KEY);
    const transferValue = window.localStorage.getItem(CHECKOUT_TRANSFER_KEY);
    let parsed: Record<string, unknown> | null = sessionValue
      ? (JSON.parse(sessionValue) as Record<string, unknown>)
      : null;
    if (!parsed && transferValue) {
      const transfer = JSON.parse(transferValue) as Record<string, unknown>;
      if (
        Number(transfer.expiresAt) > Date.now() &&
        transfer.preview &&
        typeof transfer.preview === "object"
      ) {
        parsed = transfer.preview as Record<string, unknown>;
      } else {
        window.localStorage.removeItem(CHECKOUT_TRANSFER_KEY);
      }
    }
    if (!parsed) return createGuestGardenPreview();
    const gardenRecord =
      parsed.garden && typeof parsed.garden === "object"
        ? (parsed.garden as Record<string, unknown>)
        : {};
    const plants = normalizePlants(gardenRecord.plants);
    const plantingsUsed = clampInteger(
      (gardenRecord.preview as Record<string, unknown> | undefined)?.plantingsUsed,
      plants.length,
      GUEST_PLANTING_LIMIT,
    );
    const careBalance = clampInteger(gardenRecord.careBalance, 0, 100);
    const lifetimeCare = clampInteger(gardenRecord.lifetimeCare, careBalance, 500);
    return {
      quickCareEarned: clampInteger(parsed.quickCareEarned, 0, QUICK_CARE_LIMIT),
      steadyActions: clampInteger(parsed.steadyActions, 0, 10000),
      journey:
        parsed.journey && typeof parsed.journey === "object"
          ? {
              world:
                (parsed.journey as Record<string, unknown>).world === "personal"
                  ? "personal"
                  : "community",
              mapX: clampInteger(
                (parsed.journey as Record<string, unknown>).mapX,
                0,
                100,
              ),
              mapY: clampInteger(
                (parsed.journey as Record<string, unknown>).mapY,
                0,
                100,
              ),
              zoom: Math.min(
                2,
                Math.max(
                  0.5,
                  Number((parsed.journey as Record<string, unknown>).zoom) || 1,
                ),
              ),
              selectedTool:
                typeof (parsed.journey as Record<string, unknown>).selectedTool ===
                "string"
                  ? String(
                      (parsed.journey as Record<string, unknown>).selectedTool,
                    ).slice(0, 40)
                  : "rose",
            }
          : undefined,
      garden: {
        ...createGuestGardenPreview().garden,
        careBalance,
        lifetimeCare,
        plants,
        paths: normalizePaths(gardenRecord.paths),
        preview: {
          plantingLimit: GUEST_PLANTING_LIMIT,
          plantingsUsed,
        },
      },
    } satisfies GuestGardenPreview;
  } catch {
    return createGuestGardenPreview();
  }
}

export function saveGuestGardenPreview(preview: GuestGardenPreview) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
    window.localStorage.setItem(
      CHECKOUT_TRANSFER_KEY,
      JSON.stringify({
        expiresAt: Date.now() + CHECKOUT_TRANSFER_LIFETIME_MS,
        preview,
      }),
    );
  } catch {
    // The in-memory preview remains playable when private storage is unavailable.
  }
}

export function clearGuestGardenPreview() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(CHECKOUT_TRANSFER_KEY);
}

export function preserveGuestGardenPreviewForCheckout(
  preview: GuestGardenPreview,
) {
  if (typeof window === "undefined") return;
  saveGuestGardenPreview(preview);
}

export function awardGuestCare(
  current: GuestGardenPreview,
  requestedCare: number,
): GuestCareAward {
  const value = clampInteger(requestedCare, 0, 5);
  let awardedCare = 0;
  let quickCareEarned = current.quickCareEarned;
  let steadyActions = current.steadyActions;
  let steadyProgress = steadyActions % STEADY_ACTIONS_PER_CARE;

  if (quickCareEarned < QUICK_CARE_LIMIT) {
    awardedCare = Math.min(value, QUICK_CARE_LIMIT - quickCareEarned);
    quickCareEarned += awardedCare;
    steadyProgress = 0;
  } else {
    steadyActions += 1;
    steadyProgress = steadyActions % STEADY_ACTIONS_PER_CARE;
    awardedCare = steadyProgress === 0 ? 1 : 0;
  }

  return {
    awardedCare,
    steadyProgress,
    preview: {
      quickCareEarned,
      steadyActions,
      garden: {
        ...current.garden,
        careBalance: current.garden.careBalance + awardedCare,
        lifetimeCare: current.garden.lifetimeCare + awardedCare,
      },
    },
  };
}

export function mutateGuestGarden(
  current: GuestGardenPreview,
  mutation: MyGardenMutation,
) {
  const garden = current.garden;
  const preview = garden.preview ?? {
    plantingLimit: GUEST_PLANTING_LIMIT,
    plantingsUsed: 0,
  };

  if (mutation.action === "plant") {
    if (preview.plantingsUsed >= preview.plantingLimit) {
      throw new GuestPreviewLimitError();
    }
    if (garden.careBalance < garden.plantCost) {
      throw new Error("Earn more Care in the Community Garden before planting here.");
    }
    if (
      mutation.gridX < 0 ||
      mutation.gridX >= garden.width ||
      mutation.gridY < 0 ||
      mutation.gridY >= garden.height
    ) {
      throw new Error("That spot is outside your current fenced garden.");
    }
    if (
      garden.plants.some(
        (plant) =>
          plant.gridX === mutation.gridX && plant.gridY === mutation.gridY,
      )
    ) {
      throw new Error("That garden spot is already planted.");
    }
    const nextPlantingsUsed = preview.plantingsUsed + 1;
    const plantedAt = new Date().toISOString();
    return {
      ...current,
      garden: {
        ...garden,
        careBalance: garden.careBalance - garden.plantCost,
        plants: [
          ...garden.plants,
          {
            id: `preview-${mutation.gridX}-${mutation.gridY}-${Date.now()}`,
            gridX: mutation.gridX,
            gridY: mutation.gridY,
            plantType: mutation.plantType,
            plantedAt,
          },
        ],
        preview: {
          ...preview,
          plantingsUsed: nextPlantingsUsed,
        },
      },
    } satisfies GuestGardenPreview;
  }

  if (mutation.action === "uproot") {
    const plant = garden.plants.find((candidate) => candidate.id === mutation.plantId);
    if (!plant) throw new Error("That plant is no longer in My Garden.");
    return {
      ...current,
      garden: {
        ...garden,
        careBalance: garden.careBalance + garden.uprootReturn,
        plants: garden.plants.filter((candidate) => candidate.id !== mutation.plantId),
      },
    } satisfies GuestGardenPreview;
  }

  if (mutation.action === "toggle-path") {
    const existing = garden.paths.some(
      (path) => path.gridX === mutation.gridX && path.gridY === mutation.gridY,
    );
    return {
      ...current,
      garden: {
        ...garden,
        paths: existing
          ? garden.paths.filter(
              (path) =>
                path.gridX !== mutation.gridX || path.gridY !== mutation.gridY,
            )
          : [...garden.paths, { gridX: mutation.gridX, gridY: mutation.gridY }],
      },
    } satisfies GuestGardenPreview;
  }

  throw new GuestPreviewLimitError();
}

export function getGuestPreviewImport(preview: GuestGardenPreview) {
  return {
    careBalance: clampInteger(preview.garden.careBalance, 0, QUICK_CARE_LIMIT),
    plants: normalizePlants(preview.garden.plants).map(
      ({ gridX, gridY, plantType }) => ({ gridX, gridY, plantType }),
    ),
    paths: normalizePaths(preview.garden.paths),
  };
}
