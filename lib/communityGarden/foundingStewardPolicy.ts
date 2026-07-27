import { createHash } from "node:crypto";

export type FoundingStewardActionType = "plant" | "water" | "weed";

export const FOUNDING_STEWARD_ACTIVE_START_HOUR = 7;
export const FOUNDING_STEWARD_ACTIVE_END_HOUR = 23;
export const FOUNDING_STEWARD_SESSION_MINUTES = 30;
export const FOUNDING_STEWARD_SESSION_COUNT =
  (FOUNDING_STEWARD_ACTIVE_END_HOUR - FOUNDING_STEWARD_ACTIVE_START_HOUR) * 2;
export const FOUNDING_STEWARD_MAX_ACTIONS_PER_SESSION = 24;

const ACTION_ORDINAL_BASE: Record<FoundingStewardActionType, number> = {
  plant: 1000,
  water: 2000,
  weed: 3000,
};

export type FoundingStewardSchedule = {
  runDate: string;
  sessionSlot: number | null;
  active: boolean;
};

function centralParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function getFoundingStewardSchedule(now = new Date()): FoundingStewardSchedule {
  const local = centralParts(now);
  const runDate = [local.year, local.month, local.day]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0"))
    .join("-");
  if (
    local.hour < FOUNDING_STEWARD_ACTIVE_START_HOUR ||
    local.hour >= FOUNDING_STEWARD_ACTIVE_END_HOUR
  ) {
    return { runDate, sessionSlot: null, active: false };
  }
  return {
    runDate,
    sessionSlot:
      (local.hour - FOUNDING_STEWARD_ACTIVE_START_HOUR) * 2 +
      (local.minute >= FOUNDING_STEWARD_SESSION_MINUTES ? 1 : 0),
    active: true,
  };
}

export function getFoundingStewardActionOrdinal(
  actionType: FoundingStewardActionType,
  zeroBasedIndex: number,
) {
  return ACTION_ORDINAL_BASE[actionType] + zeroBasedIndex + 1;
}

export function getFoundingStewardScheduledCount(total: number, sessionSlot: number) {
  return Math.floor(
    (Math.max(0, sessionSlot) + 1) * Math.max(0, total) /
      FOUNDING_STEWARD_SESSION_COUNT,
  );
}

export function getFoundingStewardDueActions(input: {
  dailyPlantActions: number;
  dailyWaterActions: number;
  dailyWeedActions: number;
  sessionSlot: number;
  successfulOrdinals: ReadonlySet<number>;
  maximum?: number;
}) {
  const targets: Array<[FoundingStewardActionType, number]> = [
    ["plant", input.dailyPlantActions],
    ["water", input.dailyWaterActions],
    ["weed", input.dailyWeedActions],
  ];
  return targets
    .flatMap(([actionType, dailyTarget]) => {
      const scheduled = getFoundingStewardScheduledCount(dailyTarget, input.sessionSlot);
      return Array.from({ length: scheduled }, (_, index) => ({
        actionType,
        actionOrdinal: getFoundingStewardActionOrdinal(actionType, index),
        progress: (index + 1) / Math.max(1, dailyTarget),
      }));
    })
    .filter((action) => !input.successfulOrdinals.has(action.actionOrdinal))
    .sort((left, right) => left.progress - right.progress || left.actionOrdinal - right.actionOrdinal)
    .slice(0, input.maximum ?? FOUNDING_STEWARD_MAX_ACTIONS_PER_SESSION);
}

export function getFoundingStewardActionId(
  runDate: string,
  stewardId: number,
  actionOrdinal: number,
) {
  const bytes = createHash("sha256")
    .update(`basil-founding-steward:${runDate}:${stewardId}:${actionOrdinal}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
