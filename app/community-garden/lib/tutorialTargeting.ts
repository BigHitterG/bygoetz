export type TutorialGridPoint = {
  gridX: number;
  gridY: number;
};

export const TUTORIAL_PLANTING_HIT_TOLERANCE_TILES = 2;

export function snapToTutorialPlantingTarget(
  selected: TutorialGridPoint,
  target: TutorialGridPoint | null,
) {
  if (!target) return selected;
  const withinTargetArea =
    Math.max(
      Math.abs(selected.gridX - target.gridX),
      Math.abs(selected.gridY - target.gridY),
    ) <= TUTORIAL_PLANTING_HIT_TOLERANCE_TILES;
  return withinTargetArea ? target : selected;
}
