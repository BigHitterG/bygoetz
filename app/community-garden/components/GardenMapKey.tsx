"use client";

import { useState, type CSSProperties, type MouseEvent } from "react";
import {
  CommunityAtlas,
  type CommunityAtlasTarget,
} from "./CommunityAtlas";
import type { GardenUiState } from "./GardenCanvas";

type GardenMapKeyProps = {
  ui: GardenUiState;
  canExpand: boolean;
  disabled?: boolean;
  expanded?: boolean;
  showExpandButton?: boolean;
  focusTarget?: CommunityAtlasTarget | null;
  onExpandedChange?: (expanded: boolean) => void;
  onNavigate: (mapX: number, mapY: number) => void;
  onNavigateGrid: (gridX: number, gridY: number) => void;
};

type MapStyle = CSSProperties & {
  "--cg-map-x": string;
  "--cg-map-y": string;
  "--cg-map-width": string;
  "--cg-map-height": string;
};

function isLockedRegion(region: GardenUiState["regionMapCells"][number]) {
  return !region.isOpen && region.stage !== "wild";
}

export function GardenMapKey({
  ui,
  canExpand,
  disabled = false,
  expanded: controlledExpanded,
  showExpandButton = true,
  focusTarget,
  onExpandedChange,
  onNavigate,
  onNavigateGrid,
}: GardenMapKeyProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [dismissedFocusRequest, setDismissedFocusRequest] = useState<
    number | null
  >(null);
  const focusedAtlasRequested = Boolean(
    focusTarget && focusTarget.requestId !== dismissedFocusRequest,
  );
  const expanded = controlledExpanded ?? internalExpanded;
  const mapExpanded = (expanded || focusedAtlasRequested) && !disabled;

  function setExpanded(nextExpanded: boolean) {
    setInternalExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  }
  const mapStyle: MapStyle = {
    "--cg-map-x": `${ui.mapX}%`,
    "--cg-map-y": `${ui.mapY}%`,
    "--cg-map-width": `${ui.mapWidthPercentage}%`,
    "--cg-map-height": `${ui.mapHeightPercentage}%`,
  };

  function getMapPosition(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      mapX: ((event.clientX - bounds.left) / bounds.width) * 100,
      mapY: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
  }

  function navigate(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) return;
    const { mapX, mapY } = getMapPosition(event);
    onNavigate(mapX, mapY);
  }

  const detailedMapName = ui.mode === "personal" ? "My Garden map" : "Community Atlas";

  return (
    <aside
      className={`cg-map-key is-${ui.mode}${mapExpanded ? " is-expanded" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <button
        className="cg-mini-map"
        type="button"
        disabled={disabled}
        style={mapStyle}
        onClick={navigate}
        aria-label={
          disabled
            ? "Garden overview. Finish this tutorial step before using map travel."
            : ui.mode === "personal"
              ? "My Garden overview. Select a point to move there, or use Map below for a detailed view."
              : "Community Garden overview. Locked growing edge land is marked with padlocks. Select a point to travel, or use Map below for the detailed Community Atlas."
        }
      >
        <span className="cg-map-north" aria-hidden="true">N</span>
        {ui.mode === "personal"
          ? ui.pathMapPoints.map((path, index) => (
              <span
                className="cg-map-path"
                key={`${path.x}-${path.y}-${index}`}
                style={{ left: `${path.x}%`, top: `${path.y}%` }}
                aria-hidden="true"
              />
            ))
          : null}
        {ui.regionMapCells.length > 0
          ? ui.regionMapCells.map((region) => (
              <span
                className={`cg-map-region is-${region.stage}${region.isOpen ? " is-open" : ""}${region.guidanceZone ? ` is-zone-${region.guidanceZone}` : ""}${isLockedRegion(region) ? " is-locked" : ""}`}
                key={region.key}
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  "--cg-region-density": String(
                    Math.min(0.64, 0.08 + region.occupancyPercent / 170),
                  ),
                } as CSSProperties}
                aria-hidden="true"
              >
                {isLockedRegion(region) ? <span className="cg-map-region-lock" /> : null}
              </span>
            ))
          : ui.plantMapPoints.map((plant) => (
              <span
                className={`cg-map-plant is-${plant.plantType}`}
                key={`${plant.gridX}-${plant.gridY}`}
                style={{ left: `${plant.x}%`, top: `${plant.y}%` }}
                aria-hidden="true"
              />
            ))}
        <span className="cg-map-player" title="You are here" aria-hidden="true" />
      </button>

      {canExpand && showExpandButton ? (
        <button
          className="cg-map-expand"
          type="button"
          disabled={disabled}
          aria-label={`Open the ${detailedMapName}`}
          aria-expanded={mapExpanded}
          onClick={() => setExpanded(true)}
        >
          {ui.mode === "personal" ? "Map" : "Atlas"}
        </button>
      ) : null}

      {canExpand && mapExpanded ? (
        <CommunityAtlas
          key={focusTarget?.requestId ?? "community-atlas"}
          open={mapExpanded}
          ui={ui}
          focusTarget={focusTarget}
          onClose={() => {
            setExpanded(false);
            setDismissedFocusRequest(focusTarget?.requestId ?? null);
          }}
          onNavigateMap={onNavigate}
          onNavigateGrid={onNavigateGrid}
        />
      ) : null}
    </aside>
  );
}
