"use client";

import type { GardenWorldMode } from "../game/gardenRenderer";

type QuickAction = {
  title: string;
  copy: string;
  icon: string;
};

const COMMUNITY_ACTIONS: QuickAction[] = [
  { title: "Walk and look around", copy: "Tap open ground to walk. Pinch, scroll, or use − and + to change the view.", icon: "walk" },
  { title: "Plant", copy: "Open Inventory, choose rose, sunflower, or lavender, select open ground, and plant.", icon: "plant" },
  { title: "Water", copy: "Choose a flower with a white water drop, then use Water as the spray follows the highlighted chain.", icon: "water" },
  { title: "Earn Care", copy: "Planting, completed watering sprays, and pulling weeds earn Care to spend in My Garden.", icon: "care" },
  { title: "Read the map", copy: "Deep green is the Garden Heart, its pale Growth Ring is open, and gold padlocks mark future land.", icon: "map" },
  { title: "Build your own place", copy: "Use the garden switch to enter My Garden. Membership saves it permanently across devices.", icon: "home" },
];

const PERSONAL_ACTIONS: QuickAction[] = [
  { title: "Place something", copy: "Choose a plant or object in Inventory, select a clear square, and place it with Care.", icon: "plant" },
  { title: "Move or remove", copy: "Select anything already placed to uproot it, pick it up, or remove its path.", icon: "remove" },
  { title: "Unlock new collections", copy: "Lifetime Care earned in the Community Garden opens plants, objects, water features, and landmarks.", icon: "care" },
  { title: "Use Builder Mode", copy: "Members can create connected strings of up to ten one-tile placements or removals.", icon: "builder" },
  { title: "Expand the clearing", copy: "Unlock neighboring land when you are ready. Basil always asks before spending expansion Care.", icon: "expand" },
  { title: "Share My Garden", copy: "Members can create a view-only image and link for the whole garden or the current corner.", icon: "share" },
];

export function GardenGuide({
  mode,
  onOpenFieldGuide,
}: {
  mode: GardenWorldMode;
  onOpenFieldGuide: () => void;
}) {
  const personal = mode === "personal";
  const actions = personal ? PERSONAL_ACTIONS : COMMUNITY_ACTIONS;

  return (
    <section className="cg-guide cg-library-section" aria-labelledby="garden-guide-title">
      <p className="cg-kicker">Quick reference</p>
      <h3 id="garden-guide-title">Playing in {personal ? "My Garden" : "the Community Garden"}</h3>
      <p className="cg-library-intro">
        {personal
          ? "Your permanent private garden is for arranging, collecting, building and sharing. Nothing here needs maintenance."
          : "This is one anonymous shared landscape. Anyone can plant, water and help it grow without creating an account."}
      </p>
      <div className="cg-quick-guide-grid">
        {actions.map((action) => (
          <article key={action.title}>
            <span className={`cg-quick-guide-icon is-${action.icon}`} aria-hidden="true" />
            <div><h4>{action.title}</h4><p>{action.copy}</p></div>
          </article>
        ))}
      </div>
      <button className="cg-open-field-guide" type="button" onClick={onOpenFieldGuide}>
        Open the complete Field Guide
        <span>Search every mechanic, plant, object and collection.</span>
      </button>
    </section>
  );
}
