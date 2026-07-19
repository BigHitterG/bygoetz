export const MY_GARDEN_UPGRADES = [
  { type: "birdhouse", name: "Birdhouse", careCost: 6 },
  { type: "bench", name: "Garden bench", careCost: 10 },
  { type: "stone_path", name: "Stone path", careCost: 14 },
  { type: "sage_shed", name: "Sage shed", careCost: 18 },
] as const;

export type MyGardenUpgradeType = (typeof MY_GARDEN_UPGRADES)[number]["type"];
