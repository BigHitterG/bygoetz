"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  isGardenHouseDisplayUnread,
  type GardenHouseAccolade,
  type GardenHouseDisplayKey,
  type GardenHouseMetadata,
  type GardenHouseState,
} from "../lib/gardenHouse";
import { LIVING_GARDEN_DEFINITIONS } from "../lib/livingGarden";
import { MY_GARDEN_COLLECTIONS } from "../lib/myGardenCatalog";

type Position = { x: number; y: number };

const DISPLAY_LAYOUT: Record<
  GardenHouseDisplayKey,
  Position & { emblem: string; className: string }
> = {
  stewardship: { x: 11, y: 16, emblem: "★", className: "is-certificate" },
  tasks: { x: 31, y: 16, emblem: "♜", className: "is-trophy" },
  habitats: { x: 55, y: 15, emblem: "✦", className: "is-gallery" },
  heritage: { x: 84, y: 20, emblem: "✿", className: "is-heritage" },
  community: { x: 12, y: 46, emblem: "⚑", className: "is-pennant" },
  collections: { x: 89, y: 49, emblem: "▤", className: "is-shelf" },
  property: { x: 13, y: 73, emblem: "⌗", className: "is-map" },
  worms: { x: 35, y: 78, emblem: "∿", className: "is-worm" },
  calendar: { x: 87, y: 75, emblem: "▦", className: "is-calendar" },
};

const START_POSITION = { x: 50, y: 84 };

function asNumber(metadata: GardenHouseMetadata, key: string) {
  const value = metadata[key];
  return typeof value === "number" ? value : 0;
}

function asString(metadata: GardenHouseMetadata, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function asStringArray(metadata: GardenHouseMetadata, key: string) {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function displayStats(display: GardenHouseAccolade) {
  const metadata = display.metadata;
  switch (display.key) {
    case "stewardship":
      return [
        ["Current rank", asString(metadata, "rankName")],
        ["Care capacity", asNumber(metadata, "capacity").toLocaleString()],
        ["Next", asString(metadata, "nextRank")],
      ];
    case "tasks":
      return [
        ["Tasks completed", display.progress.toLocaleString()],
        ["Latest accolade", asString(metadata, "latestAccolade")],
      ];
    case "habitats":
      return [
        ["Habitats discovered", `${display.progress} of ${display.target}`],
        ["Portraits remaining", Math.max(0, display.target - display.progress).toString()],
      ];
    case "heritage":
      return [
        ["Your Heritage Flower", asString(metadata, "heritageFlowerType")],
        ["Community encounters", asNumber(metadata, "encounteredFlowers").toString()],
      ];
    case "collections":
      return [
        ["Collections completed", `${display.progress} of ${display.target}`],
        ["Lifetime Care", asNumber(metadata, "lifetimeCare").toLocaleString()],
      ];
    case "calendar":
      return [
        ["Active days", display.progress.toLocaleString()],
        ["Current streak", `${asNumber(metadata, "currentStreak")} days`],
        ["Longest streak", `${asNumber(metadata, "longestStreak")} days`],
      ];
    case "property":
      return [
        ["Parcels unlocked", asNumber(metadata, "unlockedParcels").toLocaleString()],
        ["Parcels shaped", asNumber(metadata, "shapedParcels").toLocaleString()],
        ["Parcels returned", asNumber(metadata, "returnedParcels").toLocaleString()],
      ];
    case "community":
      return [["Projects completed", display.progress.toLocaleString()]];
    case "worms":
      return [["Lifetime discoveries", display.progress.toLocaleString()]];
  }
}

function progressLabel(display: GardenHouseAccolade) {
  if (display.target <= 0) return "Not yet begun";
  if (
    (display.key === "habitats" || display.key === "collections" || display.key === "stewardship") &&
    display.progress >= display.target
  ) {
    return "Complete";
  }
  if (display.progress >= display.target) return "Next milestone earned";
  return `${display.progress.toLocaleString()} / ${display.target.toLocaleString()} to next milestone`;
}

function GardenHouseInspector({ display }: { display: GardenHouseAccolade | null }) {
  if (!display) {
    return (
      <aside className="cg-house-inspector is-empty" aria-live="polite">
        <p className="cg-house-kicker">Hall of Growth</p>
        <h3>Your history lives here.</h3>
        <p>Walk to a display and tap it to see what you have accomplished.</p>
      </aside>
    );
  }

  const progress =
    display.target > 0
      ? Math.min(100, Math.round((display.progress / display.target) * 100))
      : 0;
  const discoveredHabitats = new Set(
    asStringArray(display.metadata, "discoveredHabitats"),
  );
  const completedCollections = new Set(
    asStringArray(display.metadata, "completedCollections"),
  );

  return (
    <aside className="cg-house-inspector" aria-live="polite">
      <p className="cg-house-kicker">{display.category}</p>
      <h3>{display.title}</h3>
      <p>{display.description}</p>
      <div className="cg-house-progress" aria-label={progressLabel(display)}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <strong className="cg-house-progress-label">{progressLabel(display)}</strong>

      <dl className="cg-house-stats">
        {displayStats(display).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "Not yet earned"}</dd>
          </div>
        ))}
      </dl>

      {display.key === "habitats" ? (
        <div className="cg-house-portrait-grid" aria-label="Habitat portrait collection">
          {LIVING_GARDEN_DEFINITIONS.map((habitat) => {
            const discovered = discoveredHabitats.has(habitat.key);
            return (
              <span
                className={discovered ? "is-discovered" : "is-silhouette"}
                key={habitat.key}
                title={discovered ? habitat.name : "Undiscovered habitat"}
              >
                {discovered ? "✦" : "?"}
              </span>
            );
          })}
        </div>
      ) : null}

      {display.key === "collections" ? (
        <div className="cg-house-collection-list" aria-label="Garden collections">
          {MY_GARDEN_COLLECTIONS.map((collection) => (
            <span
              className={completedCollections.has(collection.key) ? "is-complete" : ""}
              key={collection.key}
            >
              {completedCollections.has(collection.key) ? "◆" : "◇"} {collection.name}
            </span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export function GardenHouseInterior({
  open,
  state,
  onClose,
  onInspect,
}: {
  open: boolean;
  state: GardenHouseState;
  onClose: () => void;
  onInspect: (key: GardenHouseDisplayKey) => void;
}) {
  const [mary, setMary] = useState<Position>(START_POSITION);
  const [selectedKey, setSelectedKey] = useState<GardenHouseDisplayKey | null>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const displayMap = useMemo(
    () => new Map(state.displays.map((item) => [item.key, item])),
    [state.displays],
  );
  const selected = selectedKey ? displayMap.get(selectedKey) ?? null : null;

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => exitButtonRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      const step = event.shiftKey ? 5 : 3;
      const movement: Record<string, Position> = {
        ArrowLeft: { x: -step, y: 0 },
        a: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        d: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        w: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
        s: { x: 0, y: step },
      };
      const delta = movement[event.key];
      if (!delta) return;
      event.preventDefault();
      setMary((current) => ({
        x: Math.max(5, Math.min(95, current.x + delta.x)),
        y: Math.max(27, Math.min(88, current.y + delta.y)),
      }));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  function inspect(key: GardenHouseDisplayKey) {
    const layout = DISPLAY_LAYOUT[key];
    setMary({
      x: Math.max(7, Math.min(93, layout.x)),
      y: Math.max(31, Math.min(84, layout.y + 10)),
    });
    setSelectedKey(key);
    onInspect(key);
  }

  return (
    <section
      className="cg-house-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cg-house-title"
    >
      <div className="cg-house-shell">
        <header className="cg-house-header">
          <div>
            <p>Garden House</p>
            <h2 id="cg-house-title">Hall of Growth</h2>
          </div>
          <button ref={exitButtonRef} type="button" onClick={onClose}>
            Exit to My Garden
          </button>
        </header>

        <div className="cg-house-layout">
          <div className="cg-house-stage">
            <div
              className="cg-house-room"
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setMary({
                  x: Math.max(4, Math.min(96, ((event.clientX - bounds.left) / bounds.width) * 100)),
                  y: Math.max(27, Math.min(88, ((event.clientY - bounds.top) / bounds.height) * 100)),
                });
              }}
            >
              <div className="cg-house-room-title" aria-hidden="true">
                Everything you have grown
              </div>
              {state.displays.map((item) => {
                const layout = DISPLAY_LAYOUT[item.key];
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`cg-house-display ${layout.className} ${selectedKey === item.key ? "is-selected" : ""}`}
                    style={{ left: `${layout.x}%`, top: `${layout.y}%` }}
                    onClick={() => inspect(item.key)}
                    aria-label={`Inspect ${item.title}`}
                  >
                    <span aria-hidden="true">{layout.emblem}</span>
                    <small>{item.title}</small>
                    {isGardenHouseDisplayUnread(item) ? (
                      <i aria-label="Updated">!</i>
                    ) : null}
                  </button>
                );
              })}

              <button
                className="cg-house-future-display"
                type="button"
                style={{ left: "67%", top: "75%" }}
                onClick={() => {
                  setMary({ x: 67, y: 84 });
                  setSelectedKey(null);
                }}
                aria-label="An empty pedestal for a future accomplishment"
              >
                <span aria-hidden="true">?</span>
                <small>Something still to come</small>
              </button>

              <div
                className="cg-house-mary"
                style={{ left: `${mary.x}%`, top: `${mary.y}%` }}
                aria-label="You are walking inside the Garden House"
              >
                <span />
              </div>
              <button className="cg-house-door" type="button" onClick={onClose}>
                <span aria-hidden="true" />
                Exit
              </button>
            </div>
          </div>

          <GardenHouseInspector display={selected} />
        </div>
        <p className="cg-house-help">Tap the floor to walk · Tap a display to inspect · Arrow keys or WASD also move</p>
      </div>
    </section>
  );
}
