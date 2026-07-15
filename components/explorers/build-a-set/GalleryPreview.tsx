"use client";

import { useState, type CSSProperties } from "react";
import type { ExplorerProduct } from "@/lib/explorers/products";
import type { ExplorerSetOption } from "@/lib/explorers/buildASet";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "../ArtworkImage";
import styles from "./BuildASet.module.css";

type RoomId = "crib" | "twin-bed" | "dresser" | "reading-nook";
type LayoutId = "row" | "arc" | "staggered";

type GalleryPreviewProps = {
  products: ExplorerProduct[];
  option: ExplorerSetOption;
  onMove: (index: number, direction: -1 | 1) => void;
};

type RoomReference = {
  id: RoomId;
  label: string;
  image: string;
  referenceLabel: string;
  referenceWidthInches: number;
  referenceWidthPercent: number;
  artCenterYPercent: number;
};

const rooms: RoomReference[] = [
  {
    id: "crib",
    label: "Crib",
    image: "/explorers/rooms/crib.jpg",
    referenceLabel: "standard crib",
    referenceWidthInches: 54,
    referenceWidthPercent: 47.5,
    artCenterYPercent: 34,
  },
  {
    id: "twin-bed",
    label: "Twin bed",
    image: "/explorers/rooms/twin-bed.jpg",
    referenceLabel: "twin bed",
    referenceWidthInches: 42,
    referenceWidthPercent: 45,
    artCenterYPercent: 34,
  },
  {
    id: "dresser",
    label: "Dresser",
    image: "/explorers/rooms/dresser.jpg",
    referenceLabel: "dresser",
    referenceWidthInches: 60,
    referenceWidthPercent: 55.5,
    artCenterYPercent: 35,
  },
  {
    id: "reading-nook",
    label: "Reading nook",
    image: "/explorers/rooms/reading-nook.jpg",
    referenceLabel: "reading bench",
    referenceWidthInches: 60,
    referenceWidthPercent: 66,
    artCenterYPercent: 35,
  },
];

const layouts: { id: LayoutId; label: string; description: string }[] = [
  { id: "row", label: "Classic row", description: "Even and timeless" },
  { id: "arc", label: "Soft arc", description: "A gentle focal point" },
  { id: "staggered", label: "Staggered", description: "Playful and relaxed" },
];

function getFinishedDimensions(option: ExplorerSetOption) {
  switch (option.id) {
    case "8x10-print":
      return { width: 8, height: 10 };
    case "8x10-matted":
      return { width: 11, height: 14 };
    case "11x14-print":
      return { width: 11, height: 14 };
    case "11x14-matted":
      return { width: 16, height: 20 };
  }
}

function formatInches(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function GalleryPreview({ products, option, onMove }: GalleryPreviewProps) {
  const [roomId, setRoomId] = useState<RoomId>("crib");
  const [layoutId, setLayoutId] = useState<LayoutId>("row");
  const room = rooms.find((item) => item.id === roomId) ?? rooms[0];
  const finished = getFinishedDimensions(option);
  const scalePercentPerInch = room.referenceWidthPercent / room.referenceWidthInches;
  const gapInches = 2;
  const wallSpreadInches = finished.width * 3 + gapInches * 2;
  const wallHeightInches = finished.height + (layoutId === "row" ? 0 : 3);
  const frameWidthPercent = finished.width * scalePercentPerInch;
  const frameHeightPercent = finished.height * scalePercentPerInch * 1.5;
  const spreadPercent = wallSpreadInches * scalePercentPerInch;
  const dimensionTopPercent = room.artCenterYPercent + frameHeightPercent / 2 + 5;
  const isMatted = option.format === "Matted print";
  const referenceText = `${room.referenceWidthInches} in ${room.referenceLabel}`;

  const visualizerStyle = {
    "--frame-width": `${(frameWidthPercent / spreadPercent) * 100}%`,
    "--frame-height": `${frameHeightPercent}%`,
    "--wall-spread": `${spreadPercent}%`,
    "--art-center-y": `${room.artCenterYPercent}%`,
    "--dimension-top": `${dimensionTopPercent}%`,
  } as CSSProperties;

  return (
    <section className={styles.galleryPreview} aria-labelledby="gallery-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>See it on your wall</p>
          <h2 id="gallery-preview-title">Find the right scale.</h2>
        </div>
        <p>
          Compare your set against familiar furniture, try a layout, and arrange the
          Explorers before checkout.
        </p>
      </div>

      <div className={styles.wallStudio}>
        <div className={styles.wallScene} style={visualizerStyle}>
          <img
            className={styles.roomBackground}
            src={withSiteBasePath(room.image)}
            alt={`${room.label} room scale reference`}
            loading="lazy"
          />
          <div
            className={`${styles.wallArtGroup} ${styles[`wallLayout${layoutId === "row" ? "Row" : layoutId === "arc" ? "Arc" : "Staggered"}`]}`}
            aria-label={`Three ${option.label.toLowerCase()} shown above a ${room.label.toLowerCase()}`}
          >
            {products.map((product, index) => (
              <div
                className={`${styles.wallFrame} ${isMatted ? styles.wallFrameMatted : ""}`}
                key={product.slug}
              >
                <ArtworkImage src={product.image} title={product.title} />
                <span className={styles.frameNumber} aria-hidden="true">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.wallDimension} aria-hidden="true">
            <span />
            <strong>{formatInches(wallSpreadInches)} in total</strong>
            <span />
          </div>
          <span className={styles.scaleReference}>
            {referenceText}
          </span>
        </div>

        <div className={styles.wallControls}>
          <fieldset className={styles.wallControlGroup}>
            <legend>Above</legend>
            <div className={styles.segmentedChoices}>
              {rooms.map((item) => (
                <button
                  className={item.id === roomId ? styles.segmentChoiceActive : ""}
                  type="button"
                  key={item.id}
                  aria-pressed={item.id === roomId}
                  onClick={() => setRoomId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.wallControlGroup}>
            <legend>Layout</legend>
            <div className={styles.layoutChoices}>
              {layouts.map((layout) => (
                <button
                  className={layout.id === layoutId ? styles.layoutChoiceActive : ""}
                  type="button"
                  key={layout.id}
                  aria-pressed={layout.id === layoutId}
                  onClick={() => setLayoutId(layout.id)}
                >
                  <span className={`${styles.layoutIcon} ${styles[`layoutIcon${layout.id === "row" ? "Row" : layout.id === "arc" ? "Arc" : "Staggered"}`]}`} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>{layout.label}</strong>
                  <small>{layout.description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className={styles.wallOrder}>
            <p className={styles.wallControlLabel}>Artwork order</p>
            <div>
              {products.map((product, index) => (
                <div className={styles.orderItem} key={product.slug}>
                  <span className={styles.orderThumbnail}>
                    <ArtworkImage src={product.image} title={product.title} />
                  </span>
                  <span>
                    <small>Position {index + 1}</small>
                    <strong>{product.title}</strong>
                  </span>
                  <span className={styles.orderButtons}>
                    <button
                      type="button"
                      title={`Move ${product.title} left`}
                      aria-label={`Move ${product.title} left`}
                      disabled={index === 0}
                      onClick={() => onMove(index, -1)}
                    >
                      {"\u2190"}
                    </button>
                    <button
                      type="button"
                      title={`Move ${product.title} right`}
                      aria-label={`Move ${product.title} right`}
                      disabled={index === products.length - 1}
                      onClick={() => onMove(index, 1)}
                    >
                      {"\u2192"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <dl className={styles.wallMeasurements}>
            <div>
              <dt>Each piece</dt>
              <dd>{finished.width} x {finished.height} in</dd>
            </div>
            <div>
              <dt>Wall spread</dt>
              <dd>{formatInches(wallSpreadInches)} x {formatInches(wallHeightInches)} in</dd>
            </div>
            <div>
              <dt>Gap</dt>
              <dd>{gapInches} in</dd>
            </div>
            <div>
              <dt>Shown above</dt>
              <dd>{referenceText}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className={styles.visualizerNote}>
        Proportional guide based on standard furniture dimensions. Styled frames and
        furniture are shown for scale only and are not included.
      </p>
    </section>
  );
}

