import type { CSSProperties, MouseEvent } from "react";
import type { GardenUiState } from "./GardenCanvas";

type GardenMapKeyProps = {
  ui: GardenUiState;
  onNavigate: (mapX: number, mapY: number) => void;
};

type MapStyle = CSSProperties & {
  "--cg-map-x": string;
  "--cg-map-y": string;
};

export function GardenMapKey({ ui, onNavigate }: GardenMapKeyProps) {
  const mapStyle: MapStyle = {
    "--cg-map-x": `${ui.mapX}%`,
    "--cg-map-y": `${ui.mapY}%`,
  };

  function navigate(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    onNavigate(
      ((event.clientX - bounds.left) / bounds.width) * 100,
      ((event.clientY - bounds.top) / bounds.height) * 100,
    );
  }

  return (
    <aside className="cg-map-key">
      <button
        className="cg-mini-map"
        type="button"
        style={mapStyle}
        onClick={navigate}
        aria-label="Garden overview. Select a point to travel there. Red marks show planted roses."
      >
        <span className="cg-map-north" aria-hidden="true">N</span>
        {ui.roseMapPoints.map((rose) => (
          <span
            className="cg-map-rose"
            key={`${rose.x}-${rose.y}`}
            style={{ left: `${rose.x}%`, top: `${rose.y}%` }}
            aria-hidden="true"
          />
        ))}
        <span className="cg-map-player" title="You are here" aria-hidden="true" />
      </button>
    </aside>
  );
}

