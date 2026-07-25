import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rendererSource = readFileSync(
  new URL("../app/community-garden/game/gardenRenderer.ts", import.meta.url),
  "utf8",
);
const canvasSource = readFileSync(
  new URL("../app/community-garden/components/GardenCanvas.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../app/community-garden/components/CommunityGardenApp.tsx", import.meta.url),
  "utf8",
);
const confirmationSource = readFileSync(
  new URL(
    "../app/community-garden/components/GardenExpansionConfirmation.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("the My Garden house paints after plants but before Mary", () => {
  const objectsIndex = rendererSource.lastIndexOf("drawPersonalDepthObjects(");
  const houseIndex = rendererSource.lastIndexOf("drawPixelShed(");
  const maryIndex = rendererSource.lastIndexOf("drawMary(");

  assert.ok(objectsIndex > 0);
  assert.ok(houseIndex > objectsIndex);
  assert.ok(maryIndex > houseIndex);
});

test("selecting locked land no longer submits an expansion immediately", () => {
  const lockedParcelBlock = canvasSource.slice(
    canvasSource.indexOf("if (lockedParcel)"),
    canvasSource.indexOf("const maryGridX", canvasSource.indexOf("if (lockedParcel)")),
  );

  assert.match(lockedParcelBlock, /Confirm below to unlock it/);
  assert.doesNotMatch(lockedParcelBlock, /onPersonalGardenMutationRef/);
});

test("paid expansion requires a visible, explicit confirmation", () => {
  assert.match(appSource, /setExpansionConfirmationOpen\(true\)/);
  assert.match(appSource, /<GardenExpansionConfirmation/);
  assert.match(confirmationSource, /role="alertdialog"/);
  assert.match(confirmationSource, /Yes, unlock it/);
  assert.match(confirmationSource, /Not yet/);
  assert.match(confirmationSource, /careCost\.toLocaleString\(\)/);
});
