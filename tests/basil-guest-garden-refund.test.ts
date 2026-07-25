import assert from "node:assert/strict";
import test from "node:test";
import {
  createGuestGardenPreview,
  mutateGuestGarden,
} from "../app/community-garden/lib/guestGardenPreview.ts";

test("temporary starter flowers return their full Care cost when uprooted", () => {
  const initial = createGuestGardenPreview();
  initial.garden.careBalance = initial.garden.plantCost;

  const planted = mutateGuestGarden(initial, {
    action: "plant",
    gridX: 2,
    gridY: 3,
    plantType: "rose",
  });
  const plant = planted.garden.plants[0];

  assert.equal(planted.garden.careBalance, 0);
  assert.ok(plant);

  const uprooted = mutateGuestGarden(planted, {
    action: "uproot",
    plantId: plant.id,
  });

  assert.equal(uprooted.garden.careBalance, initial.garden.plantCost);
  assert.equal(uprooted.garden.plants.length, 0);
  assert.equal(uprooted.garden.preview?.plantingsUsed, 0);
});
