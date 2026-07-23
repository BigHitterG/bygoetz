"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  getMyGardenElementGlyphClass,
  type MyGardenUnlockNotice,
} from "../lib/myGardenCatalog";

type GardenUnlockCelebrationProps = {
  notice: MyGardenUnlockNotice | null;
  onContinue: () => void;
  onViewGarden: () => void;
};

const CONFETTI_PIECES = [
  ["one", "8%", "-0.1s", "#ba383d"],
  ["two", "16%", "0.16s", "#e5b44f"],
  ["three", "25%", "0.02s", "#778f58"],
  ["four", "34%", "0.28s", "#7480b7"],
  ["five", "44%", "0.08s", "#ba383d"],
  ["six", "55%", "0.22s", "#e5b44f"],
  ["seven", "65%", "-0.04s", "#778f58"],
  ["eight", "74%", "0.32s", "#7480b7"],
  ["nine", "84%", "0.12s", "#ba383d"],
  ["ten", "92%", "0.24s", "#e5b44f"],
] as const;

export function GardenUnlockCelebration({
  notice,
  onContinue,
  onViewGarden,
}: GardenUnlockCelebrationProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!notice) return;

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onContinue();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notice, onContinue]);

  if (!notice) return null;

  const primaryItem = notice.items[0] ?? null;
  const collectionMoment = Boolean(notice.completedCollection);
  const title = primaryItem
    ? `You unlocked ${primaryItem.name}`
    : notice.completedCollection
      ? `${notice.completedCollection.name} complete`
      : "Garden collection complete";
  const itemNames = notice.items.map((item) => item.name).join(", ");

  return (
    <div
      className="cg-unlock-backdrop"
      role="presentation"
      key={notice.lifetimeCareRequired}
    >
      <div className="cg-unlock-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map(([id, left, delay, color]) => (
          <i
            key={id}
            style={{
              "--confetti-left": left,
              "--confetti-delay": delay,
              "--confetti-color": color,
            } as CSSProperties}
          />
        ))}
      </div>
      <section
        className={`cg-unlock-card${collectionMoment ? " is-collection" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-unlock-title"
        aria-describedby="cg-unlock-description"
      >
        <button
          ref={closeButtonRef}
          className="cg-unlock-close"
          type="button"
          aria-label="Close unlock celebration"
          onClick={onContinue}
        >
          X
        </button>
        <p className="cg-kicker">
          {collectionMoment
            ? `${notice.completedCollection?.name} milestone`
            : "New My Garden item"}
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
            <span className="cg-unlock-star">*</span>
          )}
        </div>
        <h2 id="cg-unlock-title">{title}</h2>
        {notice.completedCollection && notice.openedCollection ? (
          <p id="cg-unlock-description">
            {itemNames} is now in your inventory. You also completed{" "}
            {notice.completedCollection.name} and opened the{" "}
            {notice.openedCollection.name} collection.
          </p>
        ) : notice.completedCollection ? (
          <p id="cg-unlock-description">
            {itemNames ? `${itemNames} is now in your inventory. ` : ""}
            You completed every piece of the{" "}
            {notice.completedCollection.name} collection.
          </p>
        ) : (
          <p id="cg-unlock-description">
            Your care in the Community Garden unlocked {itemNames}. It is ready
            to place in My Garden.
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
