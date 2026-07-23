"use client";

import {
  getMyGardenElementGlyphClass,
  type MyGardenUnlockNotice,
} from "../lib/myGardenCatalog";

type GardenUnlockCelebrationProps = {
  notice: MyGardenUnlockNotice | null;
  onContinue: () => void;
  onViewGarden: () => void;
};

export function GardenUnlockCelebration({
  notice,
  onContinue,
  onViewGarden,
}: GardenUnlockCelebrationProps) {
  if (!notice) return null;

  const primaryItem = notice.items[0] ?? null;
  const collectionMoment = Boolean(notice.completedCollection);
  const title = collectionMoment
    ? `${notice.completedCollection?.name} complete`
    : primaryItem
      ? `${primaryItem.name} unlocked`
      : "Garden collection complete";
  const itemNames = notice.items.map((item) => item.name).join(", ");

  return (
    <div className="cg-unlock-backdrop" role="presentation">
      <section
        className={`cg-unlock-card${collectionMoment ? " is-collection" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-unlock-title"
      >
        <p className="cg-kicker">
          {collectionMoment ? "Collection milestone" : "A gift from your garden"}
        </p>
        <div className="cg-unlock-emblem" aria-hidden="true">
          {primaryItem?.kind === "plant" ? (
            <span className={`cg-plant-glyph is-${primaryItem.plantType}`} />
          ) : primaryItem?.elementType ? (
            <span
              className={`cg-item-glyph ${getMyGardenElementGlyphClass(
                primaryItem.elementType,
              )}`}
            />
          ) : (
            <span className="cg-unlock-star">★</span>
          )}
        </div>
        <h2 id="cg-unlock-title">{title}</h2>
        {notice.completedCollection && notice.openedCollection ? (
          <p>
            You completed {notice.completedCollection.name}.{" "}
            {notice.openedCollection.name} is now ready to grow
            {itemNames ? `, beginning with ${itemNames}` : ""}.
          </p>
        ) : notice.completedCollection ? (
          <p>
            Every piece of the {notice.completedCollection.name} collection is
            now yours. Your garden carries the mark of everything you cared for.
          </p>
        ) : (
          <p>
            Your Community Garden care unlocked {itemNames}. It is waiting in
            your My Garden inventory.
          </p>
        )}
        <small>
          Unlocked at {notice.lifetimeCareRequired.toLocaleString()} lifetime Care
        </small>
        <div className="cg-unlock-actions">
          <button type="button" onClick={onViewGarden}>
            View in My Garden
          </button>
          <button type="button" onClick={onContinue}>
            Keep tending
          </button>
        </div>
      </section>
    </div>
  );
}
