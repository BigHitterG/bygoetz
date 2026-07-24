import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const appSource = await readFile(
  new URL(
    "../app/community-garden/components/CommunityGardenApp.tsx",
    import.meta.url,
  ),
  "utf8",
);
const canvasSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenCanvas.tsx",
    import.meta.url,
  ),
  "utf8",
);
const offerSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenMembershipOffer.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("required tutorial gestures cannot move Mary away from the commanded tile", () => {
  assert.match(
    canvasSource,
    /if \(tutorialDimmedRef\.current\) \{[\s\S]*Finish the highlighted garden step before exploring/,
  );
  assert.match(
    canvasSource,
    /tutorialDimmedRef\.current &&[\s\S]*requiredTutorialCell/,
  );
});

test("three community plantings lead to watering before My Garden", () => {
  assert.match(
    appSource,
    /nextPlantings >= 3 \? "community-water" : "community-tile"/,
  );
  assert.match(
    appSource,
    /transitionOnboarding\("my-garden", \["community-water"\]\)/,
  );
});

test("the watering lesson uses a visible tutorial flower", () => {
  assert.match(
    canvasSource,
    /runtime\.wateringCareReadyPlantIds\.add\(plant\.id\)/,
  );
  assert.match(
    canvasSource,
    /bringTutorialTargetIntoView\(\s*runtime,\s*runtime\.suggestedWateringCell,\s*true/,
  );
});

test("My Garden cannot be left before the first guided planting", () => {
  assert.match(appSource, /const communityGardenTutorialLocked =/);
  assert.match(
    appSource,
    /if \(world === "personal"\) \{\s*if \(communityGardenTutorialLocked\) return;/,
  );
});

test("Care Blossom teaching is persisted after the first discovery", () => {
  assert.match(appSource, /basil-care-blossom-discovery-v1/);
  assert.match(appSource, /claimFirstCareBlossomDiscovery\(\)/);
});

test("membership offer compares the current garden with missing benefits", () => {
  assert.doesNotMatch(offerSource, /cg-membership-garden-preview/);
  assert.match(offerSource, /Keep this garden growing/);
  assert.match(offerSource, /What you are missing/);
  assert.match(offerSource, /Save<\/strong> this exact garden/);
});
