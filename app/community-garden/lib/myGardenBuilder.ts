export const MY_GARDEN_BUILDER_MAX_TILES = 10;

export type MyGardenBuilderCell = {
  gridX: number;
  gridY: number;
};

export function sameBuilderCell(
  left: MyGardenBuilderCell,
  right: MyGardenBuilderCell,
) {
  return left.gridX === right.gridX && left.gridY === right.gridY;
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
