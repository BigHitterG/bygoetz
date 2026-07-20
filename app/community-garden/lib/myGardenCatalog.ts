export const MY_GARDEN_ELEMENTS = [
  { type: "birdhouse", name: "Birdhouse", careCost: 6 },
  { type: "bench", name: "Garden bench", careCost: 10 },
  { type: "stone_paver", name: "Stone paver", careCost: 1 },
] as const;

export type MyGardenElementType = (typeof MY_GARDEN_ELEMENTS)[number]["type"];

export function getMyGardenElement(type: MyGardenElementType) {
  return MY_GARDEN_ELEMENTS.find((element) => element.type === type)!;
}
