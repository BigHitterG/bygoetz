import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  GARDEN_ONBOARDING_PLANT_TYPES,
  getCommunityQuickStartPlantType,
  isCommunityQuickStart,
} from "../app/community-garden/lib/gardenOnboarding.ts";

const appSource = await readFile(
  new URL(
    "../app/community-garden/components/CommunityGardenApp.tsx",
    import.meta.url,
  ),
  "utf8",
);
const onboardingSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenOnboarding.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("only the explicit community start value selects Quick Start", () => {
  assert.equal(isCommunityQuickStart("?start=community"), true);
  assert.equal(
    isCommunityQuickStart(
      "?utm_source=reddit&start=community&utm_campaign=community_quick_start",
    ),
    true,
  );
  assert.equal(isCommunityQuickStart("?start=personal"), false);
  assert.equal(isCommunityQuickStart(""), false);
});

test("Quick Start assigns one stable tutorial-safe flower per launch session", () => {
  const first = getCommunityQuickStartPlantType("launch-session-one");
  assert.equal(first, getCommunityQuickStartPlantType("launch-session-one"));
  assert.ok(GARDEN_ONBOARDING_PLANT_TYPES.includes(first));
  for (const seed of ["two", "three", "four", "five"]) {
    assert.ok(
      GARDEN_ONBOARDING_PLANT_TYPES.includes(
        getCommunityQuickStartPlantType(seed),
      ),
    );
  }
});

test("new Quick Start visitors skip Inventory and begin on a community tile", () => {
  assert.match(
    appSource,
    /const useCommunityQuickStart =[\s\S]+communityQuickStart[\s\S]+storedCommunityPlantings < 3;/,
  );
  assert.match(
    appSource,
    /else if \(useCommunityQuickStart\) \{\s*next = "community-tile";/,
  );
  assert.match(onboardingSource, /A starter flower is already selected/);
  assert.match(onboardingSource, /Quick planting/);
});

test("the third Quick Start flower ends guidance without opening My Garden or an offer", () => {
  assert.match(
    appSource,
    /if \(nextPlantings >= 3 && communityQuickStart\) \{\s*transitionOnboarding\("complete"/,
  );
  assert.match(appSource, /You are part of the garden\./);
  assert.match(
    appSource,
    /nextPlantings >= 3 && !communityQuickStart[\s\S]*suggestWateringSpot/,
  );
  assert.match(
    appSource,
    /nextPlantings >= 3 \? "community-water" : "community-tile"/,
  );
});

test("completed onboarding and member accounts are never restarted by the link", () => {
  assert.match(
    appSource,
    /communityQuickStart &&\s*!memberGarden &&\s*!isGardenOnboardingFinished\(stored\)/,
  );
  assert.match(appSource, /if \(memberGarden\) \{\s*next = "complete";/);
});
