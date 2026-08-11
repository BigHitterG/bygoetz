import assert from "node:assert/strict";
import test from "node:test";
import {
  createGuestGardenPreview,
  GuestPreviewLimitError,
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

test("guest previews accept 15 flowers and reject only the sixteenth attempt", () => {
  let preview = createGuestGardenPreview();
  preview.garden.careBalance = 100;

  for (let index = 0; index < 15; index += 1) {
    preview = mutateGuestGarden(preview, {
      action: "plant",
      gridX: index % 12,
      gridY: Math.floor(index / 12),
      plantType: "rose",
    });
  }

  assert.equal(preview.garden.plants.length, 15);
  assert.equal(preview.garden.preview?.plantingsUsed, 15);
  assert.throws(
    () => mutateGuestGarden(preview, {
      action: "plant",
      gridX: 3,
      gridY: 1,
      plantType: "lavender",
    }),
    GuestPreviewLimitError,
  );
});
