import type { GardenHouseDisplayKey } from "./gardenHouse";

export const GARDEN_HOUSE_WORLD_BOUNDS = {
  minX: 0,
  maxX: 17,
  minY: 0,
  maxY: 19,
} as const;

export const GARDEN_HOUSE_SPAWN = { gridX: 8, gridY: 17 } as const;
export const GARDEN_HOUSE_DOOR = { gridX: 8, gridY: 19 } as const;

export type GardenHouseFixture = {
  key: GardenHouseDisplayKey;
  title: string;
  labelLines: readonly string[];
  gridX: number;
  gridY: number;
  kind: "book" | "portrait" | "cabinet" | "map" | "specimen";
};

export const GARDEN_HOUSE_FIXTURES: readonly GardenHouseFixture[] = [
  { key: "stewardship", title: "Stewardship", labelLines: ["Stewardship"], gridX: 2, gridY: 3, kind: "book" },
  { key: "tasks", title: "Garden Work", labelLines: ["Garden", "Work"], gridX: 6, gridY: 3, kind: "book" },
  { key: "habitats", title: "Living Garden", labelLines: ["Living", "Garden"], gridX: 11, gridY: 3, kind: "portrait" },
  { key: "heritage", title: "Heritage Flowers", labelLines: ["Heritage", "Flowers"], gridX: 15, gridY: 3, kind: "specimen" },
  { key: "collections", title: "Garden Collections", labelLines: ["Garden", "Collections"], gridX: 2, gridY: 9, kind: "cabinet" },
  { key: "calendar", title: "Garden Calendar", labelLines: ["Garden", "Calendar"], gridX: 6, gridY: 9, kind: "book" },
  { key: "property", title: "Garden Map", labelLines: ["Garden", "Map"], gridX: 11, gridY: 9, kind: "map" },
  { key: "community", title: "Community Projects", labelLines: ["Community", "Projects"], gridX: 15, gridY: 9, kind: "portrait" },
  { key: "worms", title: "Garden Worms", labelLines: ["Garden", "Worms"], gridX: 4, gridY: 15, kind: "specimen" },
] as const;

export function getGardenHouseFixtureAt(gridX: number, gridY: number) {
  return (
    GARDEN_HOUSE_FIXTURES.find(
      (fixture) =>
        Math.abs(fixture.gridX - gridX) <= 1 &&
        Math.abs(fixture.gridY - gridY) <= 1,
    ) ?? null
  );
}

export function getGardenHouseFixture(key: GardenHouseDisplayKey) {
  return GARDEN_HOUSE_FIXTURES.find((fixture) => fixture.key === key) ?? null;
}

export function isGardenHouseDoorAt(gridX: number, gridY: number) {
  return (
    Math.abs(gridX - GARDEN_HOUSE_DOOR.gridX) <= 1 &&
    gridY >= GARDEN_HOUSE_DOOR.gridY - 1
  );
}
