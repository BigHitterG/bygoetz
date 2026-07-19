import type { CSSProperties, MouseEvent } from "react";
import type { GardenUiState } from "./GardenCanvas";

type GardenMapKeyProps = {
  ui: GardenUiState;
  onNavigate: (mapX: number, mapY: number) => void;
};

type MapStyle = CSSProperties & {
  "--cg-map-x": string;
  "--cg-map-y": string;
  "--cg-map-width": string;
  "--cg-map-height": string;
};

export function GardenMapKey({ ui, onNavigate }: GardenMapKeyProps) {
  const mapStyle: MapStyle = {
    "--cg-map-x": `${ui.mapX}%`,
    "--cg-map-y": `${ui.mapY}%`,
    "--cg-map-width": `${ui.mapWidthPercentage}%`,
    "--cg-map-height": `${ui.mapHeightPercentage}%`,
  };

  function navigate(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    onNavigate(
      ((event.clientX - bounds.left) / bounds.width) * 100,
      ((event.clientY - bounds.top) / bounds.height) * 100,
    );
  }

  return (
    <aside className={`cg-map-key is-${ui.mode}`}>
      <button
        className="cg-mini-map"
        type="button"
        style={mapStyle}
        onClick={navigate}
        aria-label={
          ui.mode === "personal"
            ? "My Garden overview. Select a point to walk there. Colored marks show your flowers."
            : "Community Garden overview. Select a point to travel there. Colored marks show planted flowers."
        }
      >
        <span className="cg-map-north" aria-hidden="true">N</span>
        {ui.mode === "personal" ? (
          <>
            <span className="cg-map-property-boundary" aria-hidden="true" />
            <span className="cg-map-home" aria-hidden="true" />
          </>
        ) : null}
        {ui.plantMapPoints.map((plant) => (
          <span
            className={`cg-map-plant is-${plant.plantType}`}
            key={`${plant.x}-${plant.y}`}
            style={{ left: `${plant.x}%`, top: `${plant.y}%` }}
            aria-hidden="true"
          />
        ))}
        <span className="cg-map-player" title="You are here" aria-hidden="true" />
      </button>
    </aside>
  );
}

