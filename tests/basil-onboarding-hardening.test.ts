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
const onboardingSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenOnboarding.tsx",
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

test("the watering lesson only follows an authoritative water-drop flower", () => {
  assert.doesNotMatch(
    canvasSource,
    /runtime\.wateringCareReadyPlantIds\.add\(plant\.id\)/,
  );
  assert.match(canvasSource, /refreshTutorialWateringTarget\(runtime\)/);
  assert.match(
    canvasSource,
    /Tap the blue square around a flower with a water drop\./,
  );
  assert.match(
    canvasSource,
    /bringTutorialTargetIntoView\(\s*runtime,\s*runtime\.suggestedWateringCell,\s*true/,
  );
  assert.match(
    canvasSource,
    /plant\.grid_y <= bounds\.maxY - 4/,
  );
  assert.match(
    canvasSource,
    /\[4, 5, 6, 7\]\.flatMap\(\(rowDistance\)/,
  );
  assert.match(
    canvasSource,
    /gridY: cell\.gridY \+ rowDistance/,
  );
  assert.doesNotMatch(
    canvasSource,
    /gridY: cell\.gridY - 3/,
  );
});

test("the opening lesson clearly introduces the worldwide public garden", () => {
  assert.match(onboardingSource, /The whole world plants here/);
  assert.match(onboardingSource, /One public garden, shared by everyone/);
  assert.match(
    onboardingSource,
    /Anyone online, anywhere in the world, can plant on this same map for free/,
  );
  assert.match(onboardingSource, /No account or username is needed/);
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
