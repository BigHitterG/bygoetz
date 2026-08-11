"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { BASIL_COMMONS_POLICY } from "@/lib/communityGarden/commonsPolicy";
import type { GardenWorldMode } from "../game/gardenRenderer";
import {
  BASIL_LIFETIME_CARE_GOAL,
  getMyGardenCollection,
  MY_GARDEN_COLLECTIONS,
  MY_GARDEN_ELEMENTS,
  type MyGardenInventoryCategory,
} from "../lib/myGardenCatalog";
import { GardenCatalogSprite } from "./GardenCatalogSprite";
import { PlantGlossary } from "./PlantGlossary";
import {
  LIVING_GARDEN_DEFINITIONS,
  type LivingGardenDiscovery,
  type LivingGardenHabitat,
  type LivingGardenHabitatKey,
} from "../lib/livingGarden";
import { LivingGardenCreature } from "./LivingGardenCreature";

type FieldGuideShelf =
  | "home"
  | "how-to"
  | "community"
  | "personal"
  | "plants"
  | "catalog"
  | "habitats"
  | "progress";

type GuideTopic = {
  id: string;
  shelf: Exclude<FieldGuideShelf, "home" | "plants" | "catalog" | "progress">;
  title: string;
  summary: string;
  details: string[];
  keywords: string;
};

const SHELVES: Array<{
  id: Exclude<FieldGuideShelf, "home">;
  label: string;
  description: string;
}> = [
  { id: "how-to", label: "How to Play", description: "Movement, planting, watering and controls." },
  { id: "community", label: "Community Garden", description: "Shared ecology, Care, Heritage and map growth." },
  { id: "personal", label: "My Garden", description: "Permanent building, Builder Mode, expansion and sharing." },
  { id: "plants", label: "Plant Encyclopedia", description: "Every flower, its real-world reference and game behavior." },
  { id: "catalog", label: "Garden Catalog", description: "Paths, decor, nature and water items." },
  { id: "habitats", label: "Habitats & Visitors", description: "Living Garden clues, discoveries, and active visitors." },
  { id: "progress", label: "Progress & Collections", description: "Lifetime Care, collection milestones and Basil I." },
];

const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: "movement",
    shelf: "how-to",
    title: "Move and zoom",
    summary: "Tap or click open ground to walk. Pinch, scroll, or use the zoom controls to change your view.",
    details: [
      "Mary walks toward the selected square while the garden remains a continuous shared surface.",
      "The minimap is for travel and orientation. During required tutorial steps, it stays locked so you cannot lose the guided action.",
    ],
    keywords: "walk movement mary zoom pinch map travel controls",
  },
  {
    id: "planting",
    shelf: "how-to",
    title: "Plant",
    summary: "Choose a seed in Inventory, select open ground, then use the Plant action.",
    details: [
      "Planting in the Community Garden grows the shared landscape and earns Care.",
      "Planting in My Garden spends Care and creates a permanent private arrangement.",
      "A rare Garden Worm can surface while planting and adds bonus Care the first time you discover one.",
    ],
    keywords: "plant seed inventory garden worm soil care",
  },
  {
    id: "watering",
    shelf: "how-to",
    title: "Water",
    summary: "Select a flower with a water drop and use Water as the highlighted spray travels through nearby flowers.",
    details: [
      "Only flowers currently showing a water opportunity join the spray.",
      "The local chain can reach up to three flowers and is treated as one helpful action.",
      "Watering maintains several flowers with less walking, while planting remains the faster way to earn Care.",
    ],
    keywords: "water watering droplet drop spray chain care blossom",
  },
  {
    id: "inventory",
    shelf: "how-to",
    title: "Use Inventory",
    summary: "Inventory is the place to choose and place things; the Field Guide is the place to learn about them.",
    details: [
      "Community Garden Inventory contains the shared flower choices.",
      "My Garden Inventory grows with lifetime Care and is divided into Plants, Paths, Decor, Nature and Water.",
    ],
    keywords: "inventory select item plant path decor nature water unlock",
  },
  {
    id: "care",
    shelf: "community",
    title: "Care",
    summary: "Helpful planting, watering and weed-pulling actions earn Care without a daily ceiling.",
    details: [
      "Your first helpful action of the day includes the daily bonus. Every helpful action after that continues earning Care.",
      "Care is earned in the shared garden and spent building My Garden.",
      "A Care Blossom adds 2 bonus Care when its water-ready flower is included in a completed spray.",
    ],
    keywords: "care points currency reward unlimited daily bonus care blossom",
  },
  {
    id: "flower-life",
    shelf: "community",
    title: "Shared flower life",
    summary: "Community flowers have a care clock and a maximum season; whichever ends first can return the tile to open earth.",
    details: [
      "Water renews the care clock but does not normally extend the maximum season.",
      "Flowers move through seed, sprout, growing, bloom, wilt and return stages.",
      "My Garden is different: its flowers are permanent and require no maintenance.",
    ],
    keywords: "life lifecycle season wilt die return disappear water clock",
  },
  {
    id: "footprints",
    shelf: "community",
    title: "Ecological footprints",
    summary: "Your newest 100 Community flowers and newest 100 Care-earning waterings form your lasting active footprint.",
    details: [
      "You can keep playing beyond 100. A new flower stays while one of your oldest ordinary flowers returns during a garden update.",
      "Older watering opportunities reopen for other gardeners as your watering footprint advances; your own four-hour Care cooldown still applies.",
      "Signed-out flowers use the same ordinary lifecycle within a browser's newest-100 footprint. Signing in attaches that footprint to the account.",
    ],
    keywords: "100 footprint planting watering account guest browser oldest return lifecycle",
  },
  {
    id: "weeds",
    shelf: "community",
    title: "Weeds and busy patches",
    summary: "Weeds appear on open ground when a 16 by 16 patch becomes crowded.",
    details: [
      "A patch becomes busy around 140 plants and rests from new planting at 180.",
      "Busy patches can carry up to 12 temporary weeds. Pulling one earns Care and reopens its tile.",
      "Flowers never turn into weeds. Weeds last no more than 36 hours and may clear sooner as pressure falls.",
    ],
    keywords: "weed patch pressure crowded 140 180 pull",
  },
  {
    id: "heritage",
    shelf: "community",
    title: "Heritage Flowers",
    summary: "A well-established ordinary flower can become a permanent community landmark after sustained care from several gardeners.",
    details: [
      `A candidate needs at least ${BASIL_COMMONS_POLICY.heritageMinimumAgeDays} days of age, Care on ${BASIL_COMMONS_POLICY.heritageCareDays} different days from ${BASIL_COMMONS_POLICY.heritageGardeners} gardeners, and at least ${BASIL_COMMONS_POLICY.heritageNeighborCount} nearby flowers.`,
      "Heritage happens naturally; the player does not nominate a flower. Eligible accounts can establish one Heritage Flower and receive a Heritage Gardener marker.",
      "The eight adjacent tiles receive 4x maximum seasons. The next perimeter receives 2x. Overlapping auras never stack; the strongest protection applies.",
      "The aura extends maximum season, not the need for water. A protected flower can still wilt when its care clock runs out.",
    ],
    keywords: "heritage permanent gold aura 4x 2x gardener badge landmark lifespan",
  },
  {
    id: "map-growth",
    shelf: "community",
    title: "Garden Heart, Growth Ring and Growing Edge",
    summary: "The map distinguishes established shared ground, open connected growth land, and future locked land.",
    details: [
      "Deep green is the Garden Heart: the strongest connected area the community has sustained.",
      "The pale Growth Ring is ordinary open land where the next connected layer can form.",
      "Golden padlocks mark the Growing Edge. Expansion requires distributed, sustained support and cannot be forced by one player flooding a patch.",
    ],
    keywords: "map heart growth ring growing edge gold lock frontier expansion",
  },
  {
    id: "personal-permanence",
    shelf: "personal",
    title: "A permanent private garden",
    summary: "My Garden saves your layout, Care balance and unlocked collection across signed-in devices.",
    details: [
      "Plants and objects in My Garden do not age, wilt, or count against the Community Garden footprint.",
      "The public map never displays your email or connects your private account to individual contributions.",
    ],
    keywords: "my garden permanent save private account devices no maintenance",
  },
  {
    id: "builder",
    shelf: "personal",
    title: "Builder Mode",
    summary: "Members can prepare a connected string of up to ten one-tile placements or removals and apply it together.",
    details: [
      "Choose the starting tile, open Builder, then tap a screen direction to extend the string.",
      "Strings cannot cross themselves, leave unlocked land, or pass through incompatible occupied squares.",
      "Builder supports one-tile items. Larger structures are still placed normally.",
    ],
    keywords: "builder mode string ten row plant uproot path pickup member",
  },
  {
    id: "personal-expansion",
    shelf: "personal",
    title: "Expand My Garden",
    summary: "Unlocking a neighboring plot permanently extends the private clearing and moves the surrounding forest back.",
    details: [
      "Basil asks for confirmation before spending Care on a land expansion.",
      "Previously unlocked land and everything placed there remain part of the saved garden.",
    ],
    keywords: "expand land plot forest confirm unlock care",
  },
  {
    id: "sharing",
    shelf: "personal",
    title: "Share My Garden",
    summary: "Members can publish a view-only snapshot of the whole garden or the corner currently on screen.",
    details: [
      "A share creates an image and public view link without exposing account information or granting editing access.",
      "Existing shared snapshots can be reviewed and revoked from the Share panel.",
    ],
    keywords: "share snapshot social image link whole corner revoke member",
  },
];

const CATALOG_CATEGORIES: Array<{ key: "all" | Exclude<MyGardenInventoryCategory, "plants">; label: string }> = [
  { key: "all", label: "All" },
  { key: "paths", label: "Paths" },
  { key: "decor", label: "Decor" },
  { key: "nature", label: "Nature" },
  { key: "water", label: "Water" },
];

function matchesQuery(query: string, ...values: Array<string | number>) {
  if (!query) return true;
  const haystack = values.join(" ").toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

function TopicList({ shelf, query }: { shelf: GuideTopic["shelf"]; query: string }) {
  const topics = GUIDE_TOPICS.filter(
    (topic) =>
      topic.shelf === shelf &&
      matchesQuery(query, topic.title, topic.summary, topic.details.join(" "), topic.keywords),
  );

  if (!topics.length) return <p className="cg-field-guide-empty">No guide entries match that search.</p>;

  return (
    <div className="cg-field-guide-topics">
      {topics.map((topic) => (
        <details key={topic.id} id={`field-guide-${topic.id}`}>
          <summary>
            <span>{topic.title}</span>
            <small>{topic.summary}</small>
          </summary>
          <div>
            {topic.details.map((detail) => <p key={detail}>{detail}</p>)}
            {topic.id === "heritage" ? (
              <div className="cg-heritage-season-table" role="table" aria-label="Heritage Flower maximum seasons">
                <div role="row" className="is-heading"><span role="columnheader">Flower</span><span role="columnheader">Normal</span><span role="columnheader">2x ring</span><span role="columnheader">4x ring</span></div>
                <div role="row"><strong role="rowheader">Rose</strong><span role="cell">14 days</span><span role="cell">28 days</span><span role="cell">56 days</span></div>
                <div role="row"><strong role="rowheader">Sunflower</strong><span role="cell">7 days</span><span role="cell">14 days</span><span role="cell">28 days</span></div>
                <div role="row"><strong role="rowheader">Lavender</strong><span role="cell">21 days</span><span role="cell">42 days</span><span role="cell">84 days</span></div>
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function CatalogReference({ lifetimeCare, query }: { lifetimeCare: number; query: string }) {
  const [category, setCategory] = useState<(typeof CATALOG_CATEGORIES)[number]["key"]>("all");
  const showFreePath =
    (category === "all" || category === "paths") &&
    matchesQuery(query, "Garden path", "paths", "always available", "free", "Builder compatible");
  const entries = MY_GARDEN_ELEMENTS.filter((entry) => {
    const collection = getMyGardenCollection(entry.collection);
    return (
      (category === "all" || entry.category === category) &&
      matchesQuery(query, entry.name, entry.category, collection.name, entry.lifetimeCareRequired, entry.careCost)
    );
  });

  return (
    <section aria-labelledby="field-guide-catalog-title">
      <p className="cg-kicker">My Garden reference</p>
      <h3 id="field-guide-catalog-title">Garden Catalog</h3>
      <p className="cg-library-intro">Inventory is for placing things. This catalog explains what each saved My Garden item costs, when it unlocks, how much room it needs, and whether Builder Mode supports it.</p>
      <nav className="cg-field-guide-filters" aria-label="Garden Catalog categories">
        {CATALOG_CATEGORIES.map((entry) => (
          <button key={entry.key} type="button" aria-pressed={category === entry.key} onClick={() => setCategory(entry.key)}>{entry.label}</button>
        ))}
      </nav>
      <div className="cg-field-guide-catalog-grid">
        {showFreePath ? (
          <article className="cg-field-guide-catalog-entry">
            <span className="cg-path-icon" aria-hidden="true" />
            <h4>Garden path</h4>
            <p>Always available · Free · 1×1 · Builder compatible</p>
          </article>
        ) : null}
        {entries.map((entry) => {
          const collection = getMyGardenCollection(entry.collection);
          const unlocked = lifetimeCare >= entry.lifetimeCareRequired;
          const builderCompatible = entry.footprintWidth === 1 && entry.footprintHeight === 1;
          return (
            <article className={`cg-field-guide-catalog-entry${unlocked ? "" : " is-locked"}`} key={entry.type}>
              <GardenCatalogSprite kind="element" type={entry.type} />
              <div className="cg-field-guide-entry-heading">
                <h4>{entry.name}</h4>
                <span>{unlocked ? "Unlocked" : "Locked"}</span>
              </div>
              <dl>
                <div><dt>Collection</dt><dd>{collection.name}</dd></div>
                <div><dt>Unlock</dt><dd>{entry.lifetimeCareRequired.toLocaleString()} lifetime Care</dd></div>
                <div><dt>Place</dt><dd>{entry.careCost.toLocaleString()} Care</dd></div>
                <div><dt>Size</dt><dd>{entry.footprintWidth}×{entry.footprintHeight}</dd></div>
                <div><dt>Builder</dt><dd>{builderCompatible ? "Compatible" : "Place normally"}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
      {!entries.length && !showFreePath ? <p className="cg-field-guide-empty">No catalog entries match that search.</p> : null}
    </section>
  );
}

function LivingGardenReference({
  lifetimeCare,
  query,
  discoveries,
  habitats,
  onVisitHabitat,
}: {
  lifetimeCare: number;
  query: string;
  discoveries: LivingGardenDiscovery[];
  habitats: LivingGardenHabitat[];
  onVisitHabitat?: (gridX: number, gridY: number) => void;
}) {
  const [hintLevels, setHintLevels] = useState<
    Partial<Record<LivingGardenHabitatKey, number>>
  >({});
  const discoveredByKey = new Map(
    discoveries.map((discovery) => [discovery.habitatKey, discovery]),
  );
  const activeByKey = new Map(
    habitats.map((habitat) => [habitat.key, habitat]),
  );
  const visible = LIVING_GARDEN_DEFINITIONS.filter((definition) =>
    matchesQuery(
      query,
      definition.name,
      definition.chapter,
      definition.clue,
      definition.recipe,
      definition.hints.join(" "),
    ),
  );
  const chapters = Array.from(
    new Set(LIVING_GARDEN_DEFINITIONS.map((definition) => definition.chapter)),
  );

  return (
    <section className="cg-living-guide" aria-labelledby="living-garden-guide-title">
      <p className="cg-kicker">A quiet collection inside My Garden</p>
      <h3 id="living-garden-guide-title">Habitats & Visitors</h3>
      <p className="cg-library-intro">
        Arrange compatible plants and garden objects near one another. When a
        habitat comes alive, its visitor joins this guide forever. Habitats are
        visual discoveries: they require no maintenance and never award or cost
        extra Care.
      </p>
      <div className="cg-living-guide-summary">
        <strong>{discoveries.length} of {LIVING_GARDEN_DEFINITIONS.length} discovered</strong>
        <span>{habitats.length} currently visiting</span>
      </div>
      <div className="cg-living-guide-chapters" aria-label="Habitat chapter progress">
        {chapters.map((chapter) => {
          const definitions = LIVING_GARDEN_DEFINITIONS.filter(
            (definition) => definition.chapter === chapter,
          );
          const count = definitions.filter((definition) =>
            discoveredByKey.has(definition.key),
          ).length;
          return <span key={chapter}>{chapter} {count}/{definitions.length}</span>;
        })}
      </div>
      <div className="cg-living-guide-grid">
        {visible.map((definition) => {
          const discovery = discoveredByKey.get(definition.key);
          const active = activeByKey.get(definition.key);
          const hintLevel = hintLevels[definition.key] ?? 0;
          const inventoryReady = lifetimeCare >= definition.lifetimeCareRequired;
          return (
            <article
              key={definition.key}
              className={`cg-living-guide-card${discovery ? " is-discovered" : " is-unknown"}${active ? " is-active" : ""}`}
            >
              <LivingGardenCreature
                habitatKey={definition.key}
                hidden={!discovery}
              />
              <p className="cg-kicker">{definition.chapter}</p>
              <h4>{discovery ? definition.name : "Unknown visitor"}</h4>
              {discovery ? (
                <>
                  <p>{definition.discoveryCopy}</p>
                  <small>{definition.recipe}</small>
                  <div className={`cg-living-status${active ? " is-active" : ""}`}>
                    {active ? "Currently visiting" : "Habitat currently dormant"}
                  </div>
                  <small>
                    Discovered {new Date(discovery.discoveredAt).toLocaleDateString()}
                  </small>
                  <button
                    type="button"
                    disabled={!onVisitHabitat}
                    onClick={() => {
                      const target = active ?? {
                        gridX: discovery.firstCenterX,
                        gridY: discovery.firstCenterY,
                      };
                      onVisitHabitat?.(target.gridX, target.gridY);
                    }}
                  >
                    Visit habitat
                  </button>
                </>
              ) : (
                <>
                  <p>{definition.clue}</p>
                  <small>
                    {inventoryReady
                      ? "You have reached the collection containing everything this visitor needs."
                      : `A future collection contains something this visitor needs (${definition.lifetimeCareRequired.toLocaleString()} lifetime Care).`}
                  </small>
                  <p className="cg-living-hint">Hint: {definition.hints[hintLevel]}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setHintLevels((current) => ({
                        ...current,
                        [definition.key]: (hintLevel + 1) % definition.hints.length,
                      }))
                    }
                  >
                    Show another hint
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>
      {!visible.length ? <p className="cg-field-guide-empty">No habitats match that search.</p> : null}
    </section>
  );
}

function ProgressReference({ lifetimeCare, query }: { lifetimeCare: number; query: string }) {
  const current = [...MY_GARDEN_COLLECTIONS].reverse().find((entry) => entry.lifetimeCareRequired <= lifetimeCare) ?? MY_GARDEN_COLLECTIONS[0];
  const next = MY_GARDEN_COLLECTIONS.find((entry) => entry.lifetimeCareRequired > lifetimeCare) ?? null;
  const collections = MY_GARDEN_COLLECTIONS.filter((entry) => matchesQuery(query, entry.name, entry.description, entry.lifetimeCareRequired));
  const goalProgress = Math.min(100, (lifetimeCare / BASIL_LIFETIME_CARE_GOAL) * 100);

  return (
    <section className="cg-field-guide-progress" aria-labelledby="field-guide-progress-title">
      <p className="cg-kicker">My Garden progression</p>
      <h3 id="field-guide-progress-title">Progress & Collections</h3>
      <div className="cg-field-guide-progress-summary">
        <div><span>Lifetime Care</span><strong>{lifetimeCare.toLocaleString()}</strong></div>
        <div><span>Current collection</span><strong>{current.name}</strong></div>
        <div><span>Next collection</span><strong>{next ? `${next.name} · ${next.lifetimeCareRequired.toLocaleString()}` : "Basil I achieved"}</strong></div>
        <div className="cg-field-guide-progress-bar" aria-label={`${Math.round(goalProgress)} percent toward Basil I`}><i style={{ width: `${goalProgress}%` }} /></div>
      </div>
      <div className="cg-field-guide-collections">
        {collections.map((collection) => {
          const opened = lifetimeCare >= collection.lifetimeCareRequired;
          const completed = lifetimeCare >= collection.completionLifetimeCareRequired;
          return (
            <article key={collection.key} className={`${opened ? "is-open" : "is-locked"}${completed ? " is-complete" : ""}`}>
              <span>{completed ? "Complete" : opened ? "Open" : "Locked"}</span>
              <h4>{collection.name}</h4>
              <p>{collection.description}</p>
              <small>{collection.lifetimeCareRequired.toLocaleString()}–{collection.completionLifetimeCareRequired.toLocaleString()} lifetime Care</small>
            </article>
          );
        })}
      </div>
      {!collections.length ? <p className="cg-field-guide-empty">No collections match that search.</p> : null}
      <aside className="cg-field-guide-awards">
        <h4>Long-term garden marks</h4>
        <p><strong>Heritage Gardener</strong> marks an account whose naturally selected Community Garden flower became Heritage.</p>
        <p><strong>Basil I</strong> opens at 1,000,000 lifetime Care and unlocks the one-Care Basil Heritage Plant for My Garden.</p>
      </aside>
    </section>
  );
}

export function GardenFieldGuide({
  mode,
  lifetimeCare,
  livingGardenDiscoveries,
  livingGardenHabitats,
  onVisitHabitat,
  initialShelf = "home",
}: {
  mode: GardenWorldMode;
  lifetimeCare: number;
  livingGardenDiscoveries: LivingGardenDiscovery[];
  livingGardenHabitats: LivingGardenHabitat[];
  onVisitHabitat?: (gridX: number, gridY: number) => void;
  initialShelf?: "home" | "habitats";
}) {
  const [shelf, setShelf] = useState<FieldGuideShelf>(initialShelf);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const searchMatches = useMemo(() => {
    if (!deferredQuery) return [];
    return SHELVES.filter((entry) => {
      if (entry.id === "plants") {
        return matchesQuery(deferredQuery, entry.label, entry.description, "rose sunflower lavender daisy tulip wildflowers peony bee balm heritage weed care blossom");
      }
      if (entry.id === "catalog") {
        return MY_GARDEN_ELEMENTS.some((item) => matchesQuery(deferredQuery, item.name, item.category, getMyGardenCollection(item.collection).name));
      }
      if (entry.id === "progress") {
        return MY_GARDEN_COLLECTIONS.some((item) => matchesQuery(deferredQuery, item.name, item.description));
      }
      if (entry.id === "habitats") {
        return LIVING_GARDEN_DEFINITIONS.some((item) =>
          matchesQuery(
            deferredQuery,
            item.name,
            item.chapter,
            item.clue,
            item.recipe,
            item.hints.join(" "),
          ),
        );
      }
      return GUIDE_TOPICS.some((topic) => topic.shelf === entry.id && matchesQuery(deferredQuery, topic.title, topic.summary, topic.details.join(" "), topic.keywords));
    });
  }, [deferredQuery]);

  function openShelf(next: Exclude<FieldGuideShelf, "home">) {
    setShelf(next);
  }

  return (
    <section className="cg-field-guide cg-library-section" aria-labelledby="field-guide-title">
      <div className="cg-field-guide-heading">
        <div>
          <p className="cg-kicker">A reference for the whole garden</p>
          <h3 id="field-guide-title">Field Guide</h3>
        </div>
        {shelf !== "home" ? <button type="button" onClick={() => setShelf("home")}>All sections</button> : null}
      </div>
      <label className="cg-field-guide-search">
        <span>Search the guide</span>
        <input type="search" value={query} placeholder="Heritage, watering, Builder, pond…" onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>

      {shelf === "home" ? (
        <>
          <p className="cg-field-guide-context">You are currently in <strong>{mode === "personal" ? "My Garden" : "the Community Garden"}</strong>. The guide covers both gardens and labels the difference.</p>
          <div className="cg-field-guide-shelves">
            {(deferredQuery ? searchMatches : SHELVES).map((entry) => (
              <button key={entry.id} type="button" onClick={() => openShelf(entry.id)}>
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </button>
            ))}
          </div>
          {deferredQuery && !searchMatches.length ? <p className="cg-field-guide-empty">Nothing in the Field Guide matches “{query}”.</p> : null}
        </>
      ) : null}

      {shelf === "how-to" ? <><p className="cg-field-guide-shelf-intro">The short version of every essential interaction.</p><TopicList shelf="how-to" query={deferredQuery} /></> : null}
      {shelf === "community" ? <><p className="cg-field-guide-shelf-intro">How the anonymous shared landscape lives, returns, and grows.</p><TopicList shelf="community" query={deferredQuery} /></> : null}
      {shelf === "personal" ? <><p className="cg-field-guide-shelf-intro">How your permanent private clearing works.</p><TopicList shelf="personal" query={deferredQuery} /></> : null}
      {shelf === "plants" ? <PlantGlossary query={deferredQuery} /> : null}
      {shelf === "catalog" ? <CatalogReference lifetimeCare={lifetimeCare} query={deferredQuery} /> : null}
      {shelf === "habitats" ? (
        <LivingGardenReference
          lifetimeCare={lifetimeCare}
          query={deferredQuery}
          discoveries={livingGardenDiscoveries}
          habitats={livingGardenHabitats}
          onVisitHabitat={onVisitHabitat}
        />
      ) : null}
      {shelf === "progress" ? <ProgressReference lifetimeCare={lifetimeCare} query={deferredQuery} /> : null}
    </section>
  );
}
