"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_DAILY_CARE_LIMIT,
  type CommunityGardenEconomy,
} from "@/lib/communityGarden/economyPolicy";
import { SPECIAL_WATERING_FLOWER_NAME } from "../lib/roseLifecycle";

const LIFE_STAGES = [
  { name: "Seed", className: "is-seed" },
  { name: "Sprout", className: "is-sprout" },
  { name: "Growing", className: "is-growing" },
  { name: "Bloom", className: "is-blooming" },
  { name: "Wilt", className: "is-wilting" },
  { name: "Return", className: "is-returned" },
] as const;

export function GardenGuide() {
  const [economy, setEconomy] = useState<CommunityGardenEconomy>({
    dailyCareLimit: DEFAULT_DAILY_CARE_LIMIT,
    fullRewardLimit: Math.floor(DEFAULT_DAILY_CARE_LIMIT / 3),
    moderateRewardLimit: Math.floor((DEFAULT_DAILY_CARE_LIMIT * 2) / 3),
    moderateActionsRequired: 4,
    longActionsRequired: 20,
    updatedAt: new Date(0).toISOString(),
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/community-garden/economy", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        setEconomy((await response.json()) as CommunityGardenEconomy);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <section className="cg-guide cg-library-section" aria-labelledby="garden-guide-title">
      <p className="cg-kicker">A shared living artwork</p>
      <h3 id="garden-guide-title">Garden Guide</h3>

      <dl className="cg-guide-list">
        <div>
          <dt>Explore</dt>
          <dd>Tap the ground to walk. Use - and + for a wider or closer view.</dd>
        </div>
        <div>
          <dt>Travel</dt>
          <dd>Colored dots on the map show planted flowers. Tap anywhere on the map to visit.</dd>
        </div>
        <div>
          <dt>Care</dt>
          <dd>
            Open Inventory to choose a seed, select an open spot, and plant.
            A white water drop means that flower can offer you Care. When another
            gardener has recently cared for it, the drop rests for a while. Dark
            soil shows shared hydration and slowly dries as the plant approaches
            wilting. A rare white {SPECIAL_WATERING_FLOWER_NAME} with a red center
            adds 2 bonus Care.
          </dd>
        </div>
        <div>
          <dt>Choose</dt>
          <dd>Rose, sunflower, and lavender each grow and return at a different pace.</dd>
        </div>
        <div>
          <dt>Switch gardens</dt>
          <dd>
            Use the garden switch to try My Garden. After three flowers, you can
            save it or keep building a temporary preview up to ten flowers.
            Membership keeps the garden and opens permanent placeable items.
          </dd>
        </div>
      </dl>

      <div className="cg-life-guide">
        <h4>One shared life cycle</h4>
        <ol>
          {LIFE_STAGES.map((stage) => (
            <li key={stage.name}>
              <span className={`cg-stage-icon ${stage.className}`} aria-hidden="true" />
              <span>{stage.name}</span>
            </li>
          ))}
        </ol>
        <p>
          Water renews a plant&apos;s care clock. Without care it wilts, returns
          to the soil, and leaves room for something new. Everyone sees the same
          care and drying cycle. Water cannot extend a flower beyond its maximum
          season listed in Plants.
        </p>
      </div>

      <div className="cg-ecology-guide" aria-labelledby="garden-numbers-title">
        <h4 id="garden-numbers-title">The garden numbers</h4>
        <div className="cg-ecology-grid">
          <article>
            <p className="cg-ecology-number">3 at once</p>
            <h5>Watering</h5>
            <p>
              Tap a real flower, then pump three times to release a spray that can
              follow a loose chain to three flowers. Care-ready flowers are chosen
              before already-watered ones, but the whole spray is one helpful
              action. Planting is the quicker way to earn Care; watering saves
              walking while maintaining several flowers.
            </p>
          </article>
          <article>
            <p className="cg-ecology-number">100 newest</p>
            <h5>Your watering footprint</h5>
            <p>
              Your newest 100 Care-earning waterings show as cared for to everyone.
              Keep watering beyond 100 and your oldest watering opportunity opens
              for other gardeners. It does not reopen for you until your own
              four-hour clock finishes.
            </p>
          </article>
          <article>
            <p className="cg-ecology-number">100 newest</p>
            <h5>Your ecological footprint</h5>
            <p>
              In the long run, your footprint in the Community Garden is your newest
              100 flowers. You can always keep planting. Each new flower beyond that
              lets one of your oldest flowers return to the earth during a ten-minute
              garden update, opening space for someone else. Your new flower stays.
            </p>
          </article>
          <article>
            <p className="cg-ecology-number">140 / 180</p>
            <h5>Patch pressure</h5>
            <p>
              A 16 by 16 patch becomes busy at 140 plants and rests from new planting
              at 180. Busy patches can grow up to 12 weeds on open tiles. Flowers do
              not turn into weeds.
            </p>
          </article>
          <article>
            <p className="cg-ecology-number">36 hours</p>
            <h5>Weeds</h5>
            <p>
              A weed is a temporary sign that a patch is crowded. Pull it to earn
              Care and reopen its tile. It lasts no more than 36 hours and may clear
              sooner when the patch becomes healthy.
            </p>
          </article>
        </div>
      </div>

      <div className="cg-care-rates">
        <h4>Daily Care rhythm</h4>
        <dl>
          <div><dt>First helpful action</dt><dd>+4 Care</dd></div>
          <div>
            <dt>Through {economy.fullRewardLimit} Care</dt><dd>+1 each</dd>
          </div>
          <div>
            <dt>{economy.fullRewardLimit + 1}-{economy.moderateRewardLimit} Care</dt>
            <dd>+1 every {economy.moderateActionsRequired} helpful actions</dd>
          </div>
          <div>
            <dt>{economy.moderateRewardLimit + 1}-{economy.dailyCareLimit} Care</dt>
            <dd>+1 every {economy.longActionsRequired} helpful actions</dd>
          </div>
          <div><dt>Daily limit</dt><dd>{economy.dailyCareLimit} Care</dd></div>
        </dl>
        <p>
          The slower rhythm lets long sessions continue while keeping one gardener
          from consuming the whole shared landscape. The counter starts fresh each
          day.
        </p>
      </div>

      <p className="cg-guide-principle">
        Public play needs no account and never labels plants with an owner.
        Preview Care and flowers are temporary. Membership privately saves them
        and keeps My Garden available across devices.
      </p>
      <div className="cg-play-notes">
        <h4>Why did a flower leave?</h4>
        <p>
          It either reached its no-water return time, reached its maximum season,
          or returned to the earth as one of your oldest flowers after your ecological
          footprint passed 100. It did not become a weed, and another player&apos;s
          footprint did not remove it. My Garden is private and is not affected by
          this footprint rule.
        </p>
      </div>
    </section>
  );
}

