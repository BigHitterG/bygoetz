"use client";

import type { ReactNode } from "react";

type GardenControlsDockProps = {
  mapDisabled: boolean;
  mapAriaLabel: string;
  inventoryDisabled: boolean;
  gardenDisabled: boolean;
  gardenHighlighted: boolean;
  gardenLabel: string;
  gardenDetail?: string;
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
  upgradeVisible: boolean;
  onUpgrade: () => void;
  onMap: () => void;
  onInventory: () => void;
  onGarden: () => void;
  onAction: () => void;
};

export function GardenControlsDock({
  mapDisabled,
  mapAriaLabel,
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
  upgradeVisible,
  onUpgrade,
  onMap,
  onInventory,
  onGarden,
  onAction,
}: GardenControlsDockProps) {
  return (
    <nav className="cg-controls-dock" aria-label="Garden controls">
      {upgradeVisible ? (
        <button
          className="cg-dock-upgrade"
          type="button"
          onClick={onUpgrade}
          aria-label="Upgrade to Garden Membership and save My Garden"
        >
          <strong>Upgrade</strong>
          <small>Save My Garden</small>
        </button>
      ) : null}

      <button
        className="cg-dock-button is-map"
        type="button"
        disabled={mapDisabled}
        onClick={onMap}
        aria-label={mapAriaLabel}
      >
        <span className="cg-dock-icon-slot" aria-hidden="true">
          <span className="cg-dock-map-icon" />
        </span>
        <strong className="cg-dock-label">Map</strong>
      </button>

      <button
        className={`cg-dock-button is-inventory${inventoryHighlighted ? " is-onboarding-highlight" : ""}`}
        type="button"
        disabled={inventoryDisabled}
        onClick={onInventory}
        aria-label="Open inventory"
      >
        <span className="cg-dock-icon-slot" aria-hidden="true">
          <span className={inventoryIconClass} />
        </span>
        <strong className="cg-dock-label">Inventory</strong>
      </button>

      <button
        className={`cg-dock-button is-garden${gardenHighlighted ? " is-onboarding-highlight" : ""}`}
        type="button"
        disabled={gardenDisabled}
        onClick={onGarden}
        aria-label={gardenAriaLabel}
      >
        <span className="cg-dock-icon-slot" aria-hidden="true">
          <span className={gardenIconClass} />
        </span>
        <span className="cg-dock-copy">
          <strong>{gardenLabel}</strong>
          {gardenDetail ? <small>{gardenDetail}</small> : null}
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
        <span className="cg-dock-icon-slot" aria-hidden="true">
          {actionIcon}
        </span>
        <span className="cg-dock-label">{actionLabel}</span>
      </button>
    </nav>
  );
}
