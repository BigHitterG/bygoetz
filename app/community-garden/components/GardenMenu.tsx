"use client";

import { GardenElements } from "./GardenElements";
import { GardenFounder } from "./GardenFounder";
import { GardenGuide } from "./GardenGuide";
import { GardenSteward } from "./GardenSteward";
import { PlantGlossary } from "./PlantGlossary";
import { BasilPolicyLinks } from "./BasilPolicyLinks";
import type { GardenAudioControls } from "../lib/gardenAudio";

export type LibrarySection = "play" | "plants" | "elements" | "account" | "about";

const LIBRARY_TABS = [
  { id: "play", label: "Play", icon: "play" },
  { id: "plants", label: "Plants", icon: "plants" },
  { id: "elements", label: "Elements", icon: "elements" },
  { id: "account", label: "Account", icon: "home" },
  { id: "about", label: "About", icon: "about" },
] as const;

type GardenMenuProps = {
  open: boolean;
  section: LibrarySection;
  audio: GardenAudioControls;
  onClose: () => void;
  onSectionChange: (section: LibrarySection) => void;
};

export function GardenMenu({
  open,
  section,
  audio,
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
          {section === "account" ? <GardenSteward /> : null}
          {section === "about" ? <GardenFounder /> : null}
        </div>

        <section className="cg-audio-settings" aria-labelledby="garden-sound-title">
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
        <BasilPolicyLinks compact />
      </aside>
    </div>
  );
}

