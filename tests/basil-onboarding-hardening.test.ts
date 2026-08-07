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
const communityGardenCss = await readFile(
  new URL("../app/community-garden/community-garden.css", import.meta.url),
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
    /guideMaryTowardTutorialWateringTarget\(\s*runtime,\s*runtime\.suggestedWateringCell/,
  );
  assert.match(
    canvasSource,
    /plant\.grid_y <= bounds\.maxY - 4/,
  );
  assert.match(
    canvasSource,
    /const visibleAboveCandidates = candidates\.filter/,
  );
  assert.match(
    canvasSource,
    /function isTutorialWateringCellVisibleAboveMary/,
  );
  assert.match(
    canvasSource,
    /runtime\.target = approach;/,
  );
  assert.doesNotMatch(
    canvasSource,
    /bringTutorialTargetIntoView\(\s*runtime,\s*runtime\.suggestedWateringCell,\s*true/,
  );
});

test("watering refreshes cannot move Mary after the tutorial target is selected", () => {
  assert.match(
    canvasSource,
    /function isTutorialWateringInteractionActive\(runtime: Runtime\)/,
  );
  assert.match(
    canvasSource,
    /if \(isTutorialWateringInteractionActive\(runtime\)\) return;/,
  );
  assert.match(
    canvasSource,
    /Once the player chooses the tutorial flower, finish that[\s\S]*readyPlantIds\.add\(activeTutorialPlantId\)/,
  );
  assert.match(
    canvasSource,
    /if \(nextTarget && targetChanged\) \{\s*guideMaryTowardTutorialWateringTarget/,
  );
});

test("ordinary guest planting cannot restart the watering tutorial", () => {
  assert.match(
    appSource,
    /const isGuidedCommunityPlanting =[\s\S]*onboardingStep === "community-repeat";/,
  );
  assert.match(appSource, /if \(!isGuidedCommunityPlanting\) return;/);
  assert.match(
    canvasSource,
    /if \(!tutorialDimmed && hadTutorialTarget\) \{[\s\S]*runtime\.suggestedWateringCell = null;/,
  );
  assert.match(
    canvasSource,
    /suggestWateringSpot\(\) \{\s*if \(!tutorialDimmedRef\.current\) return;/,
  );
});

test("required tutorial inventory selection cannot be dismissed", () => {
  assert.match(
    appSource,
    /const onboardingPlantSelectionRequired =[\s\S]*onboardingStep === "personal-seed";/,
  );
  assert.match(
    appSource,
    /if \(onboardingPlantSelectionRequired\) return;\s*setInventoryOpen\(false\);/,
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

test("reduced motion cannot turn repeating onboarding animations into a rapid shake", () => {
  assert.match(
    communityGardenCss,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.cg-root \*[\s\S]*?animation-duration: 0\.01ms !important;[\s\S]*?animation-iteration-count: 1 !important;/,
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
