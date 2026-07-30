import {
  getLivingGardenDefinition,
  type LivingGardenHabitatKey,
} from "../lib/livingGarden";

type LivingGardenCreatureProps = {
  habitatKey: LivingGardenHabitatKey;
  hidden?: boolean;
};

export function LivingGardenCreature({
  habitatKey,
  hidden = false,
}: LivingGardenCreatureProps) {
  const definition = getLivingGardenDefinition(habitatKey);
  const rows = definition.sprite.pixels;
  const columns = rows[0]?.length ?? 1;

  return (
    <span
      className={`cg-living-glyph is-${definition.visitorKind}${hidden ? " is-hidden" : ""}`}
      aria-hidden="true"
    >
      {hidden ? (
        "?"
      ) : (
        <svg
          className="cg-living-creature"
          viewBox={`0 0 ${columns} ${rows.length}`}
          shapeRendering="crispEdges"
          focusable="false"
        >
          {rows.flatMap((row, y) =>
            Array.from(row).map((colorKey, x) => {
              const fill = definition.sprite.palette[colorKey];
              return fill ? (
                <rect
                  key={`${x}:${y}`}
                  x={x}
                  y={y}
                  width="1"
                  height="1"
                  fill={fill}
                />
              ) : null;
            }),
          )}
        </svg>
      )}
    </span>
  );
}
