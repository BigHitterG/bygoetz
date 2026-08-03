import { BASIL_COMMONS_POLICY } from "../../../lib/communityGarden/commonsPolicy.ts";
import type {
  GardenRegionManifest,
  GardenRegionSummary,
} from "./supabaseGarden";

export function getCommunityRegionKeyForCell(
  gridX: number,
  gridY: number,
  regionSize: number,
) {
  return `${Math.floor(gridX / regionSize)}:${Math.floor(gridY / regionSize)}`;
}

export function getCommunityRegionForCell(
  manifest: GardenRegionManifest,
  gridX: number,
  gridY: number,
): GardenRegionSummary | null {
  const regionKey = getCommunityRegionKeyForCell(
    gridX,
    gridY,
    manifest.regionSize,
  );
  return manifest.regions.find((region) => region.regionKey === regionKey) ?? null;
}

export function isTutorialPlantingRegionAvailable(
  manifest: GardenRegionManifest,
  blockedRegionKeys: ReadonlySet<string>,
  gridX: number,
  gridY: number,
) {
  const region = getCommunityRegionForCell(manifest, gridX, gridY);
  if (!region || blockedRegionKeys.has(region.regionKey)) return false;
  return (
    region.isOpen &&
    region.pressureState === "healthy" &&
    region.plantCount <
      Math.min(region.plantCapacity, BASIL_COMMONS_POLICY.regionBusyAt)
  );
}
