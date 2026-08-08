"use client";

import type { ReactNode } from "react";

type GardenControlsDockProps = {
  mapDisabled: boolean;
  inventoryDisabled: boolean;
  gardenDisabled: boolean;
  gardenHighlighted: boolean;
  gardenLabel: string;
  gardenDetail: string;
  gardenAriaLabel: string;
  gardenIconClass: string;
  gardenNotice?: ReactNode;
  inventoryHighlighted: boolean;
  inventoryIconClass: string;
  actionDisabled: boolean;
  actionHighlighted: boolean;
  actionQuickStart: boolean;
  actionLabel: string;
  actionIcon: ReactNode;
  onMap: () => void;
  onInventory: () => void;
  onGarden: () => void;
  onAction: () => void;
};

export function GardenControlsDock({
  mapDisabled,
  inventoryDisabled,
  gardenDisabled,
  gardenHighlighted,
  gardenLabel,
  gardenDetail,
  gardenAriaLabel,
  gardenIconClass,
  gardenNotice,
  inventoryHighlighted,
  inventoryIconClass,
  actionDisabled,
  actionHighlighted,
  actionQuickStart,
  actionLabel,
  actionIcon,
  onMap,
  onInventory,
  onGarden,
  onAction,
}: GardenControlsDockProps) {
  return (
    <nav className="cg-controls-dock" aria-label="Garden controls">
      <button
        className="cg-dock-button is-map"
        type="button"
        disabled={mapDisabled}
        onClick={onMap}
        aria-label="Open the detailed Community Garden map"
      >
        <span className="cg-dock-map-icon" aria-hidden="true" />
        <strong>Map</strong>
      </button>

      <button
        className={`cg-dock-button is-inventory${inventoryHighlighted ? " is-onboarding-highlight" : ""}`}
        type="button"
        disabled={inventoryDisabled}
        onClick={onInventory}
        aria-label="Open inventory"
      >
        <span className={inventoryIconClass} aria-hidden="true" />
        <strong>Inventory</strong>
      </button>

      <button
        className={`cg-dock-button is-garden${gardenHighlighted ? " is-onboarding-highlight" : ""}`}
        type="button"
        disabled={gardenDisabled}
        onClick={onGarden}
        aria-label={gardenAriaLabel}
      >
        <span className={gardenIconClass} aria-hidden="true" />
        <span className="cg-dock-copy">
          <strong>{gardenLabel}</strong>
          <small>{gardenDetail}</small>
        </span>
        {gardenNotice}
      </button>

      <button
        className={`cg-action-button${actionHighlighted ? " is-onboarding-highlight" : ""}${actionQuickStart ? " is-quick-start-final" : ""}`}
        type="button"
        disabled={actionDisabled}
        onClick={onAction}
      >
        {actionQuickStart ? (
          <span className="cg-action-guidance" aria-hidden="true">
            Click here
          </span>
        ) : null}
        {actionIcon}
        <span>{actionLabel}</span>
      </button>
    </nav>
  );
}
