import type { CSSProperties } from "react";
import type { GardenUiState } from "./GardenCanvas";

type GardenMapKeyProps = {
  ui: GardenUiState;
  onReturnToCenter: () => void;
};

type MapStyle = CSSProperties & {
  "--cg-map-x": string;
  "--cg-map-y": string;
};

export function GardenMapKey({ ui, onReturnToCenter }: GardenMapKeyProps) {
  const mapStyle: MapStyle = {
    "--cg-map-x": `${ui.mapX}%`,
    "--cg-map-y": `${ui.mapY}%`,
  };

  return (
    <aside className="cg-map-key" aria-label={`Garden map. ${ui.locationLabel}`}>
      <div className="cg-map-key-heading">
        <span aria-hidden="true">N</span>
        <strong>{ui.locationLabel}</strong>
      </div>
      <div className="cg-mini-map" style={mapStyle} role="img" aria-label="Your location and the garden center">
        <span className="cg-map-center" title="Garden center" aria-hidden="true" />
        <span className="cg-map-player" title="You are here" aria-hidden="true" />
      </div>
      <div className="cg-map-legend" aria-hidden="true">
        <span><i className="cg-map-you-dot" />You</span>
        <span><i className="cg-map-center-dot" />Center</span>
      </div>
      <button type="button" onClick={onReturnToCenter} title="Walk to the garden center">
        <span className="cg-map-button-rose" aria-hidden="true" />
        Garden center
      </button>
    </aside>
  );
}

