export const MY_GARDEN_BUILDER_MAX_TILES = 10;

export type MyGardenBuilderCell = {
  gridX: number;
  gridY: number;
};

export type BuilderScreenPoint = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function sameBuilderCell(
  left: MyGardenBuilderCell,
  right: MyGardenBuilderCell,
) {
  return left.gridX === right.gridX && left.gridY === right.gridY;
}

export function getBuilderDirectionalCell(
  head: MyGardenBuilderCell,
  point: BuilderScreenPoint,
): MyGardenBuilderCell {
  const halfWidth = Math.max(1, point.width / 2);
  const halfHeight = Math.max(1, point.height / 2);
  const horizontal = (point.x - halfWidth) / halfWidth;
  const vertical = (point.y - halfHeight) / halfHeight;

  if (Math.abs(horizontal) >= Math.abs(vertical)) {
    return {
      gridX: head.gridX + (horizontal >= 0 ? 1 : -1),
      gridY: head.gridY,
    };
  }

  return {
    gridX: head.gridX,
    gridY: head.gridY + (vertical >= 0 ? 1 : -1),
  };
}

export function getBuilderAppendResult(
  cells: readonly MyGardenBuilderCell[],
  next: MyGardenBuilderCell,
) {
  if (cells.length === 0) return { kind: "append" as const };
  const head = cells[cells.length - 1];
  const previous = cells[cells.length - 2];
  if (sameBuilderCell(head, next)) return { kind: "unchanged" as const };
  if (previous && sameBuilderCell(previous, next)) {
    return { kind: "undo" as const };
  }
  if (cells.some((cell) => sameBuilderCell(cell, next))) {
    return { kind: "invalid" as const, reason: "A string cannot cross itself." };
  }
  if (
    Math.abs(head.gridX - next.gridX) + Math.abs(head.gridY - next.gridY) !==
    1
  ) {
    return {
      kind: "invalid" as const,
      reason: "Add the next square beside the current square.",
    };
  }
  if (cells.length >= MY_GARDEN_BUILDER_MAX_TILES) {
    return {
      kind: "invalid" as const,
      reason: "This string is full. Build these 10, then begin another.",
    };
  }
  return { kind: "append" as const };
}
