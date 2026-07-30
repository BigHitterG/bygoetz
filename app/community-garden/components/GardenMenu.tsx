"use client";

import { useState } from "react";
import { GardenFounder } from "./GardenFounder";
import { GardenFieldGuide } from "./GardenFieldGuide";
import { GardenGuide } from "./GardenGuide";
import { GardenSteward } from "./GardenSteward";
import { BasilPolicyLinks } from "./BasilPolicyLinks";
import type { GardenAudioControls } from "../lib/gardenAudio";
import type { GardenWorldMode } from "../game/gardenRenderer";
import type {
  LivingGardenDiscovery,
  LivingGardenHabitat,
} from "../lib/livingGarden";

export type LibrarySection = "play" | "guide" | "account" | "about";

const LIBRARY_TABS = [
  { id: "play", label: "Play", icon: "play" },
  { id: "guide", label: "Field Guide", icon: "plants" },
  { id: "account", label: "Account", icon: "home" },
  { id: "about", label: "About", icon: "about" },
] as const;

type GardenMenuProps = {
  open: boolean;
  section: LibrarySection;
  audio: GardenAudioControls;
  mode: GardenWorldMode;
  lifetimeCare: number;
  livingGardenDiscoveries: LivingGardenDiscovery[];
  livingGardenHabitats: LivingGardenHabitat[];
  onClose: () => void;
  onSectionChange: (section: LibrarySection) => void;
  onVisitHeritage?: (gridX: number, gridY: number) => void;
  onVisitHabitat?: (gridX: number, gridY: number) => void;
  guideInitialShelf?: "home" | "habitats";
};

export function GardenMenu({
  open,
  section,
  audio,
  mode,
  lifetimeCare,
  livingGardenDiscoveries,
  livingGardenHabitats,
  onClose,
  onSectionChange,
  onVisitHeritage,
  onVisitHabitat,
  guideInitialShelf = "home",
}: GardenMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  function closeMenu() {
    setSettingsOpen(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="cg-menu-scrim" role="presentation" onPointerDown={closeMenu}>
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
            <h2 id="garden-menu-title">{settingsOpen ? "Settings" : "Garden Library"}</h2>
          </div>
          <div className="cg-menu-heading-actions">
            <button
              className="cg-menu-settings-button"
              type="button"
              aria-pressed={settingsOpen}
              onClick={() => setSettingsOpen((current) => !current)}
            >
              {settingsOpen ? "Back to library" : "Sound settings"}
            </button>
            <button className="cg-icon-button" type="button" onClick={closeMenu} aria-label="Close menu">
              <span aria-hidden="true">X</span>
            </button>
          </div>
        </div>

        {!settingsOpen ? (
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
        ) : null}

        {settingsOpen ? (
        <section className="cg-audio-settings is-standalone" aria-labelledby="garden-sound-title">
          <div className="cg-audio-heading">
            <div>
              <p className="cg-kicker">Soundscape</p>
              <h3 id="garden-sound-title">Garden Sound</h3>
            </div>
            <button type="button" onClick={audio.toggleMuteAll}>
              {audio.settings.musicEnabled || audio.settings.soundEnabled
                ? "Mute all"
                : "Restore sound"}
            </button>
          </div>

          <label className="cg-audio-row">
            <span>Music</span>
            <button
              type="button"
              aria-pressed={audio.settings.musicEnabled}
              onClick={audio.toggleMusic}
            >
              {audio.settings.musicEnabled ? "On" : "Off"}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(audio.settings.musicVolume * 100)}
              disabled={!audio.settings.musicEnabled}
              aria-label="Music volume"
              onChange={(event) =>
                audio.setMusicVolume(Number(event.currentTarget.value) / 100)
              }
            />
          </label>

          <label className="cg-audio-row">
            <span>Effects</span>
            <button
              type="button"
              aria-pressed={audio.settings.soundEnabled}
              onClick={audio.toggleSound}
            >
              {audio.settings.soundEnabled ? "On" : "Off"}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(audio.settings.soundVolume * 100)}
              disabled={!audio.settings.soundEnabled}
              aria-label="Sound effects volume"
              onChange={(event) =>
                audio.setSoundVolume(Number(event.currentTarget.value) / 100)
              }
            />
          </label>
        </section>
        ) : null}

        {!settingsOpen ? (
          <>
            <div id={`garden-${section}-panel`} role="tabpanel" className="cg-library-panel">
              {section === "play" ? (
                <GardenGuide mode={mode} onOpenFieldGuide={() => onSectionChange("guide")} />
              ) : null}
              {section === "guide" ? (
                <GardenFieldGuide
                  mode={mode}
                  lifetimeCare={lifetimeCare}
                  livingGardenDiscoveries={livingGardenDiscoveries}
                  livingGardenHabitats={livingGardenHabitats}
                  onVisitHabitat={onVisitHabitat}
                  initialShelf={guideInitialShelf}
                />
              ) : null}
              {section === "account" ? <GardenSteward onVisitHeritage={onVisitHeritage} /> : null}
              {section === "about" ? <GardenFounder /> : null}
            </div>
            <BasilPolicyLinks compact />
          </>
        ) : null}
      </aside>
    </div>
  );
}

