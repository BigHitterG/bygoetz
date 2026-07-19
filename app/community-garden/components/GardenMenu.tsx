"use client";

import { withSiteBasePath } from "@/lib/sitePath";
import { GardenElements } from "./GardenElements";
import { GardenGuide } from "./GardenGuide";
import { GardenSteward } from "./GardenSteward";
import { PlantGlossary } from "./PlantGlossary";

export type LibrarySection = "play" | "plants" | "elements" | "steward";

const LIBRARY_TABS = [
  { id: "play", label: "Play", icon: "play" },
  { id: "plants", label: "Plants", icon: "plants" },
  { id: "elements", label: "Elements", icon: "elements" },
  { id: "steward", label: "Pass", icon: "support" },
] as const;

type GardenMenuProps = {
  open: boolean;
  section: LibrarySection;
  onClose: () => void;
  onSectionChange: (section: LibrarySection) => void;
};

export function GardenMenu({
  open,
  section,
  onClose,
  onSectionChange,
}: GardenMenuProps) {
  if (!open) return null;

  return (
    <div className="cg-menu-scrim" role="presentation" onPointerDown={onClose}>
      <aside
        className="cg-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garden-menu-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="cg-menu-heading">
          <div>
            <p className="cg-kicker">Basil Community Garden</p>
            <h2 id="garden-menu-title">Garden Library</h2>
          </div>
          <button className="cg-icon-button" type="button" onClick={onClose} aria-label="Close menu">
            <span aria-hidden="true">X</span>
          </button>
        </div>

        <nav className="cg-library-tabs" role="tablist" aria-label="Garden library sections">
          {LIBRARY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              onClick={() => onSectionChange(tab.id)}
            >
              <span className={`cg-library-icon is-${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div id={`garden-${section}-panel`} role="tabpanel" className="cg-library-panel">
          {section === "play" ? <GardenGuide /> : null}
          {section === "plants" ? <PlantGlossary /> : null}
          {section === "elements" ? <GardenElements /> : null}
          {section === "steward" ? <GardenSteward /> : null}
        </div>

        <a className="cg-back-link" href={withSiteBasePath("/")}>
          Back to By Goetz
        </a>
      </aside>
    </div>
  );
}

