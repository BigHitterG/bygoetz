export const OCCUPIED_GARDEN_COORDINATE_REASON =
  "occupied_coordinate" as const;

export type GardenActionFailureReason =
  typeof OCCUPIED_GARDEN_COORDINATE_REASON;

export function parseGardenActionFailureReason(
  value: unknown,
): GardenActionFailureReason | null {
  return value === OCCUPIED_GARDEN_COORDINATE_REASON ? value : null;
}

