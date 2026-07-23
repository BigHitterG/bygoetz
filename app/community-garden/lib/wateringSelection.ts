export type WateringSelectionCandidate = {
  id: string;
  gridX: number;
  gridY: number;
  careReady: boolean;
};

type WateringSelectionOptions = {
  clickedGridX: number;
  clickedGridY: number;
  maryGridX: number;
  maryGridY: number;
  candidates: WateringSelectionCandidate[];
  maxTargets?: number;
  maxReach?: number;
  maxLinkGap?: number;
};

type RankedCandidate = WateringSelectionCandidate & {
  graphDepth: number;
  inStartingSquare: boolean;
  distanceFromClick: number;
  forwardProgress: number;
};

function chebyshevDistance(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
) {
  return Math.max(Math.abs(firstX - secondX), Math.abs(firstY - secondY));
}

/**
 * Starts with the directional 2x2 quadrant in front of Mary, then follows a
 * loose chain of flowers outward. Care-ready flowers are selected before
 * already-watered flowers, while connected fallback flowers keep a four-tile
 * spray possible in dense beds.
 */
export function selectDirectionalWateringTargets({
  clickedGridX,
  clickedGridY,
  maryGridX,
  maryGridY,
  candidates,
  maxTargets = 4,
  maxReach = 6,
  maxLinkGap = 2,
}: WateringSelectionOptions) {
  if (maxTargets <= 0 || candidates.length === 0) return [];

  const originX = maryGridX <= clickedGridX ? clickedGridX : clickedGridX - 1;
  const originY = maryGridY <= clickedGridY ? clickedGridY : clickedGridY - 1;
  const startingCells = [
    [originX, originY],
    [originX + 1, originY],
    [originX, originY + 1],
    [originX + 1, originY + 1],
  ] as const;
  const startingKeys = new Set(startingCells.map(([x, y]) => `${x}:${y}`));

  const directionX = clickedGridX - maryGridX;
  const directionY = clickedGridY - maryGridY;
  const directionLength = Math.max(1, Math.hypot(directionX, directionY));
  const unitX = directionX / directionLength;
  const unitY = directionY / directionLength;

  const pool = candidates.filter((candidate) => {
    if (
      chebyshevDistance(
        candidate.gridX,
        candidate.gridY,
        clickedGridX,
        clickedGridY,
      ) > maxReach
    ) {
      return false;
    }
    const offsetX = candidate.gridX - clickedGridX;
    const offsetY = candidate.gridY - clickedGridY;
    const forwardProgress = offsetX * unitX + offsetY * unitY;
    return forwardProgress >= -1.5;
  });
  if (pool.length === 0) return [];

  const depths = new Map<string, number>();
  let frontier = pool.filter((candidate) =>
    startingCells.some(
      ([x, y]) =>
        chebyshevDistance(candidate.gridX, candidate.gridY, x, y) <= 1,
    ),
  );
  for (const candidate of frontier) depths.set(candidate.id, 0);

  let graphDepth = 0;
  while (frontier.length > 0) {
    graphDepth += 1;
    const nextFrontier: WateringSelectionCandidate[] = [];
    for (const candidate of pool) {
      if (depths.has(candidate.id)) continue;
      if (
        frontier.some(
          (connected) =>
            chebyshevDistance(
              candidate.gridX,
              candidate.gridY,
              connected.gridX,
              connected.gridY,
            ) <= maxLinkGap,
        )
      ) {
        depths.set(candidate.id, graphDepth);
        nextFrontier.push(candidate);
      }
    }
    frontier = nextFrontier;
  }

  const reachable: RankedCandidate[] = pool
    .filter((candidate) => depths.has(candidate.id))
    .map((candidate) => ({
      ...candidate,
      graphDepth: depths.get(candidate.id) ?? Number.MAX_SAFE_INTEGER,
      inStartingSquare: startingKeys.has(`${candidate.gridX}:${candidate.gridY}`),
      distanceFromClick: Math.hypot(
        candidate.gridX - clickedGridX,
        candidate.gridY - clickedGridY,
      ),
      forwardProgress:
        (candidate.gridX - clickedGridX) * unitX +
        (candidate.gridY - clickedGridY) * unitY,
    }));

  reachable.sort((first, second) => {
    if (first.careReady !== second.careReady) return first.careReady ? -1 : 1;
    if (first.inStartingSquare !== second.inStartingSquare) {
      return first.inStartingSquare ? -1 : 1;
    }
    if (first.graphDepth !== second.graphDepth) {
      return first.graphDepth - second.graphDepth;
    }
    if (first.distanceFromClick !== second.distanceFromClick) {
      return first.distanceFromClick - second.distanceFromClick;
    }
    if (first.forwardProgress !== second.forwardProgress) {
      return second.forwardProgress - first.forwardProgress;
    }
    return first.id.localeCompare(second.id);
  });

  const selected = reachable.slice(0, maxTargets);
  selected.sort((first, second) => {
    if (first.graphDepth !== second.graphDepth) {
      return first.graphDepth - second.graphDepth;
    }
    if (first.distanceFromClick !== second.distanceFromClick) {
      return first.distanceFromClick - second.distanceFromClick;
    }
    return first.id.localeCompare(second.id);
  });
  return selected;
}
