import {
  PLANT_TYPES,
  type CommunityPlantType,
} from "./roseLifecycle.ts";

export type HeritageMomentRole = "planter" | "helper";

export type HeritageMoment = {
  eventId: string;
  notificationId?: string;
  plantId: string;
  plantType: CommunityPlantType;
  gridX: number;
  gridY: number;
  role: HeritageMomentRole;
  becameHeritageAt: string;
};

function readString(
  value: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
) {
  const candidate = value[camelKey] ?? (snakeKey ? value[snakeKey] : undefined);
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function readInteger(
  value: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
) {
  const candidate = Number(
    value[camelKey] ?? (snakeKey ? value[snakeKey] : Number.NaN),
  );
  return Number.isInteger(candidate) ? candidate : null;
}

export function parseHeritageMoment(
  value: unknown,
  fallbackRole?: HeritageMomentRole,
): HeritageMoment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const notificationId = readString(candidate, "notificationId", "id");
  const eventId =
    readString(candidate, "eventId", "event_id") ?? notificationId;
  const plantId = readString(candidate, "plantId", "plant_id");
  const plantType = readString(candidate, "plantType", "plant_type");
  const gridX = readInteger(candidate, "gridX", "grid_x");
  const gridY = readInteger(candidate, "gridY", "grid_y");
  const roleValue = readString(candidate, "role");
  const role =
    roleValue === "planter" || roleValue === "helper"
      ? roleValue
      : fallbackRole;
  const becameHeritageAt = readString(
    candidate,
    "becameHeritageAt",
    "became_heritage_at",
  );

  if (
    !eventId ||
    !plantId ||
    !plantType ||
    !PLANT_TYPES.includes(plantType as CommunityPlantType) ||
    gridX === null ||
    gridY === null ||
    !role ||
    !becameHeritageAt
  ) {
    return null;
  }

  return {
    eventId,
    ...(notificationId ? { notificationId } : {}),
    plantId,
    plantType: plantType as CommunityPlantType,
    gridX,
    gridY,
    role,
    becameHeritageAt,
  };
}

export function parseHeritageMoments(
  value: unknown,
  fallbackRole?: HeritageMomentRole,
) {
  if (!Array.isArray(value)) return [] as HeritageMoment[];
  return value
    .slice(0, 20)
    .map((candidate) => parseHeritageMoment(candidate, fallbackRole))
    .filter((candidate): candidate is HeritageMoment => Boolean(candidate));
}

export function mergeHeritageMomentQueue(
  current: HeritageMoment[],
  incoming: HeritageMoment[],
) {
  if (incoming.length === 0) return current;
  const queuedEventIds = new Set(current.map((moment) => moment.eventId));
  const additions = incoming.filter((moment) => {
    if (queuedEventIds.has(moment.eventId)) return false;
    queuedEventIds.add(moment.eventId);
    return true;
  });
  return additions.length > 0 ? [...current, ...additions] : current;
}
