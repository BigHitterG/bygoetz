"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GardenHouseAccolade,
  GardenHouseMetadata,
} from "../lib/gardenHouse";
import { GARDEN_HOUSE_TIER_THRESHOLDS } from "../lib/gardenHouse";
import { GARDEN_STEWARDSHIP_RANKS } from "../lib/stewardshipTypes";
import {
  LIVING_GARDEN_DEFINITIONS,
  type LivingGardenSprite,
} from "../lib/livingGarden";
import { MY_GARDEN_COLLECTIONS } from "../lib/myGardenCatalog";

type AccoladeBadge = {
  id: string;
  name: string;
  description: string;
  requirement: string;
  earned: boolean;
  kind: GardenHouseAccolade["key"];
  sprite?: LivingGardenSprite;
};

function asNumber(metadata: GardenHouseMetadata, key: string) {
  const value = metadata[key];
  return typeof value === "number" ? value : 0;
}

function asStringArray(metadata: GardenHouseMetadata, key: string) {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function milestoneBadges(
  display: GardenHouseAccolade,
  milestones: readonly number[],
  names: readonly string[],
  unit: string,
): AccoladeBadge[] {
  return milestones.map((milestone, index) => ({
    id: `${display.key}-${milestone}`,
    name: names[index] ?? `${milestone.toLocaleString()} ${unit}`,
    description: `A permanent mark for reaching ${milestone.toLocaleString()} ${unit.toLowerCase()}.`,
    requirement: `Reach ${milestone.toLocaleString()} ${unit.toLowerCase()}.`,
    earned: display.progress >= milestone,
    kind: display.key,
  }));
}

function getAccoladeBadges(display: GardenHouseAccolade): AccoladeBadge[] {
  if (display.key === "stewardship") {
    return GARDEN_STEWARDSHIP_RANKS.map((rank, index) => {
      const requirements = [
        rank.tasks > 0 ? `${rank.tasks} tasks` : null,
        rank.categories > 0 ? `${rank.categories} task types` : null,
        rank.activeDays > 0 ? `${rank.activeDays} active days` : null,
        rank.projects > 0 ? `${rank.projects} community projects` : null,
      ].filter(Boolean);
      return {
        id: rank.key,
        name: rank.name,
        description: `${rank.name} stewardship carries a ${rank.capacity.toLocaleString()}-flower community capacity.`,
        requirement:
          requirements.length > 0
            ? `Complete ${requirements.join(", ")}.`
            : "Begin caring for the Community Garden.",
        earned: index < display.tier,
        kind: display.key,
      };
    });
  }

  if (display.key === "habitats") {
    const discovered = new Set(
      asStringArray(display.metadata, "discoveredHabitats"),
    );
    return LIVING_GARDEN_DEFINITIONS.map((habitat) => ({
      id: habitat.key,
      name: habitat.name,
      description: habitat.discoveryCopy,
      requirement: habitat.recipe,
      earned: discovered.has(habitat.key),
      kind: display.key,
      sprite: habitat.sprite,
    }));
  }

  if (display.key === "collections") {
    const completed = new Set(
      asStringArray(display.metadata, "completedCollections"),
    );
    return MY_GARDEN_COLLECTIONS.map((collection) => ({
      id: collection.key,
      name: collection.name,
      description: collection.description,
      requirement: `Reach ${collection.completionLifetimeCareRequired.toLocaleString()} lifetime Care.`,
      earned: completed.has(collection.key),
      kind: display.key,
    }));
  }

  if (display.key === "tasks") {
    return milestoneBadges(
      display,
      GARDEN_HOUSE_TIER_THRESHOLDS.tasks,
      ["First Helping Hand", "Steady Helper", "Garden Regular", "Seasoned Hand", "Hundred Acts", "Community Pillar"],
      "Garden Tasks",
    );
  }
  if (display.key === "heritage") {
    return milestoneBadges(
      display,
      GARDEN_HOUSE_TIER_THRESHOLDS.heritage,
      ["First Heritage Flower", "Heritage Keeper", "Living Memory", "Garden Historian"],
      "Heritage Flowers",
    );
  }
  if (display.key === "calendar") {
    return milestoneBadges(
      display,
      GARDEN_HOUSE_TIER_THRESHOLDS.calendar,
      ["First Day", "Garden Week", "Garden Month", "Hundred Days", "Year in the Garden"],
      "Active Days",
    );
  }
  if (display.key === "property") {
    return milestoneBadges(
      display,
      GARDEN_HOUSE_TIER_THRESHOLDS.property,
      ["First Clearing", "Garden Plan", "Land Shaper", "Garden Estate", "Landscape Keeper"],
      "Shaped Parcels",
    );
  }
  if (display.key === "community") {
    return milestoneBadges(
      display,
      GARDEN_HOUSE_TIER_THRESHOLDS.community,
      ["Project Neighbor", "Common Cause", "Community Builder", "Garden Organizer", "Commonwealth"],
      "Community Projects",
    );
  }
  return milestoneBadges(
    display,
    GARDEN_HOUSE_TIER_THRESHOLDS.worms,
    ["First Garden Worm", "Soil Listener", "Worm Friend", "Living Soil Keeper"],
    "Garden Worms",
  );
}

function PixelSprite({ sprite }: { sprite: LivingGardenSprite }) {
  const columns = sprite.pixels[0]?.length ?? 1;
  return (
    <span
      className="cg-accolade-pixel-sprite"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      aria-hidden="true"
    >
      {sprite.pixels.flatMap((row, rowIndex) =>
        Array.from(row).map((pixel, columnIndex) => (
          <i
            key={`${rowIndex}-${columnIndex}`}
            style={{
              backgroundColor:
                pixel === "." ? "transparent" : sprite.palette[pixel],
            }}
          />
        )),
      )}
    </span>
  );
}

function BadgeArt({ badge, index }: { badge: AccoladeBadge; index: number }) {
  return (
    <span
      className={`cg-accolade-badge-art is-${badge.kind} is-tone-${index % 6}`}
      aria-hidden="true"
    >
      <span className="cg-accolade-ribbon is-left" />
      <span className="cg-accolade-ribbon is-right" />
      <span className="cg-accolade-medallion">
        {badge.sprite ? (
          <PixelSprite sprite={badge.sprite} />
        ) : (
          <span className="cg-accolade-symbol">
            <i />
            <b />
            <em />
          </span>
        )}
      </span>
    </span>
  );
}

function displayProgressCopy(display: GardenHouseAccolade, earned: number, total: number) {
  if (display.key === "stewardship") {
    return `${earned} of ${total} stewardship ranks earned`;
  }
  if (display.key === "habitats") {
    return `${earned} of ${total} living-garden badges discovered`;
  }
  if (display.key === "collections") {
    return `${earned} of ${total} garden collections completed`;
  }
  return `${earned} of ${total} milestone badges earned`;
}

export function GardenHouseBadgeModal({
  display,
  onClose,
}: {
  display: GardenHouseAccolade;
  onClose: () => void;
}) {
  const [expandedBadgeId, setExpandedBadgeId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const badges = useMemo(() => getAccoladeBadges(display), [display]);
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const progress = badges.length > 0 ? (earnedCount / badges.length) * 100 : 0;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="cg-accolade-modal-scrim"
      role="presentation"
      onPointerDown={onClose}
    >
      <section
        className="cg-accolade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-accolade-modal-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="cg-accolade-modal-header">
          <div>
            <p>Hall of Growth</p>
            <h2 id="cg-accolade-modal-title">{display.title}</h2>
            <span>{display.description}</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${display.title} badge book`}
          >
            Close
          </button>
        </header>

        <div className="cg-accolade-book-progress">
          <div>
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{displayProgressCopy(display, earnedCount, badges.length)}</strong>
        </div>

        <div className="cg-accolade-badge-grid">
          {badges.map((badge, index) => {
            const expanded = expandedBadgeId === badge.id;
            return (
              <article
                className={`cg-accolade-badge-card${badge.earned ? " is-earned" : " is-locked"}${expanded ? " is-expanded" : ""}`}
                key={badge.id}
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedBadgeId((current) =>
                      current === badge.id ? null : badge.id,
                    )
                  }
                >
                  <BadgeArt badge={badge} index={index} />
                  <span className="cg-accolade-badge-name">
                    <strong>{badge.name}</strong>
                    <small>{badge.earned ? "Earned" : "Still to grow"}</small>
                  </span>
                  <span className="cg-accolade-expand-mark" aria-hidden="true">
                    {expanded ? "-" : "+"}
                  </span>
                </button>
                {expanded ? (
                  <div className="cg-accolade-badge-details">
                    <p>{badge.description}</p>
                    <dl>
                      <div>
                        <dt>How to earn it</dt>
                        <dd>{badge.requirement}</dd>
                      </div>
                      {display.key === "calendar" && badge.earned ? (
                        <div>
                          <dt>Longest streak</dt>
                          <dd>{asNumber(display.metadata, "longestStreak")} days</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
