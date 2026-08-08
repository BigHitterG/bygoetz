import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  COMMUNITY_FAST_START_PLANTINGS,
  GARDEN_ONBOARDING_PLANT_TYPES,
  getCommunityQuickStartPlantType,
  isClassicGardenOnboarding,
  isCommunityQuickStart,
} from "../app/community-garden/lib/gardenOnboarding.ts";
import {
  TUTORIAL_PLANTING_HIT_TOLERANCE_TILES,
  snapToTutorialPlantingTarget,
} from "../app/community-garden/lib/tutorialTargeting.ts";

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
const canvasSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenCanvas.tsx",
    import.meta.url,
  ),
  "utf8",
);
const rootPageSource = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const rendererSource = await readFile(
  new URL(
    "../app/community-garden/game/gardenRenderer.ts",
    import.meta.url,
  ),
  "utf8",
);
const gardenCssSource = await readFile(
  new URL("../app/community-garden/community-garden.css", import.meta.url),
  "utf8",
);

test("Quick Start is the default and classic onboarding remains addressable", () => {
  assert.equal(isCommunityQuickStart(""), true);
  assert.equal(isCommunityQuickStart("?start=community"), true);
  assert.equal(
    isCommunityQuickStart(
      "?utm_source=reddit&start=community&utm_campaign=community_quick_start",
    ),
    true,
  );
  assert.equal(isCommunityQuickStart("?start=personal"), false);
  assert.equal(isCommunityQuickStart("?onboarding=classic"), false);
  assert.equal(isClassicGardenOnboarding("?onboarding=classic"), true);
  assert.equal(isClassicGardenOnboarding(""), false);
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

test("new Quick Start visitors skip Inventory and begin ready to plant", () => {
  assert.equal(COMMUNITY_FAST_START_PLANTINGS, 2);
  assert.match(
    appSource,
    /const useCommunityQuickStart =[\s\S]+communityQuickStart[\s\S]+storedCommunityPlantings < communityOnboardingPlantingTarget;/,
  );
  assert.match(
    appSource,
    /else if \(useCommunityQuickStart\) \{\s*next = "community-tile";/,
  );
  assert.match(onboardingSource, /A starter flower is already selected/);
  assert.match(onboardingSource, /Quick planting/);
  assert.match(appSource, /readyToPlant:[\s\S]*communityOnboardingPlantings === 0/);
  assert.match(canvasSource, /Your first spot is ready\. Tap Plant below\./);
  assert.match(appSource, /: "Plant here"/);
});

test("the second Quick Start flower ends guidance without opening My Garden or an offer", () => {
  assert.match(
    appSource,
    /nextPlantings >= communityOnboardingPlantingTarget &&[\s\S]*communityQuickStart[\s\S]*transitionOnboarding\("complete"/,
  );
  assert.match(appSource, /You are part of the garden\./);
  assert.match(appSource, /Your two community flowers are growing/);
  assert.match(
    appSource,
    /nextPlantings >= communityOnboardingPlantingTarget &&[\s\S]*!communityQuickStart[\s\S]*suggestWateringSpot/,
  );
});

test("Quick Start never teleports Mary and gives the second target one clear canvas cue", () => {
  assert.match(appSource, /keepMaryInPlace: shouldSuggestCommunity && communityQuickStart/);
  assert.match(appSource, /keepMaryInPlace: communityQuickStart/);
  assert.match(canvasSource, /findImmediatePlantingCell\(runtime\)/);
  assert.match(canvasSource, /findVisibleQuickStartPlantingCell\(runtime\)/);
  assert.match(
    onboardingSource,
    /communityQuickStart &&[\s\S]*communityPlantings > 0[\s\S]*return null;/,
  );
  assert.match(rendererSource, /strokeText\("CLICK HERE"/);
  assert.match(rendererSource, /ctx\.lineTo\(screen\.x, arrowTipY\)/);
  assert.match(
    appSource,
    /tutorialClickHere={[\s\S]*communityOnboardingPlantings === 1 &&[\s\S]*!onboardingPlantActionReady/,
  );
  assert.match(appSource, /className="cg-action-guidance"/);
  assert.match(appSource, /`Plant \$\{getPlantDefinition\(ui\.selectedPlantType\)\.name\}`/);
  assert.match(gardenCssSource, /\.cg-action-button\.is-quick-start-final/);
});

test("completion owns the screen without overlapping the Garden Heart explainer", () => {
  assert.match(appSource, /quickStartCompletedThisSessionRef\.current = true/);
  assert.match(appSource, /setGrowingEdgeIntroOpen\(false\)/);
  assert.match(
    appSource,
    /growingEdgeIntroOpen &&[\s\S]*!tutorialMapDimmed &&[\s\S]*!showCommunityQuickStartComplete/,
  );
  assert.match(appSource, /Seriously—thank you for planting\./);
  assert.match(gardenCssSource, /\.cg-free-planting-notice\.is-community-complete/);
  assert.match(gardenCssSource, /@keyframes cg-community-complete/);
});

test("near misses snap to the glowing second planting patch", () => {
  const target = { gridX: 20, gridY: 30 };
  assert.equal(TUTORIAL_PLANTING_HIT_TOLERANCE_TILES, 2);
  assert.deepEqual(snapToTutorialPlantingTarget({ gridX: 18, gridY: 32 }, target), target);
  assert.deepEqual(
    snapToTutorialPlantingTarget({ gridX: 17, gridY: 30 }, target),
    { gridX: 17, gridY: 30 },
  );
});

test("the Basil root keeps campaign parameters and enters the garden", () => {
  assert.match(rootPageSource, /isBasilHostname\(hostname\)/);
  assert.match(rootPageSource, /redirect\(`\/community-garden/);
  assert.match(rootPageSource, /params\.append\(key, item\)/);
});

test("My Garden has no three-flower offer and hard-gates at its configured limit", () => {
  assert.doesNotMatch(appSource, /used === GUEST_SOFT_PAYWALL_PLANTINGS/);
  assert.match(
    appSource,
    /used >= \(updatedPreview\.garden\.preview\?\.plantingLimit \?\? 10\)[\s\S]*setMembershipOfferStage\("hard"\)/,
  );
});

test("completed onboarding and member accounts are never restarted by the link", () => {
  assert.match(
    appSource,
    /communityQuickStart &&\s*!memberGarden &&\s*!isGardenOnboardingFinished\(stored\)/,
  );
  assert.match(appSource, /if \(memberGarden\) \{\s*next = "complete";/);
});

test("the classic link deliberately restores the longer onboarding", () => {
  assert.match(
    appSource,
    /const stored = classicOnboardingRequested[\s\S]*\? null[\s\S]*loadGardenOnboardingStep\(\)/,
  );
  assert.match(
    appSource,
    /const storedCommunityPlantings = classicOnboardingRequested[\s\S]*\? 0[\s\S]*loadCommunityOnboardingPlantings\(\)/,
  );
});
