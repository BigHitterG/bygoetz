"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import type { ExplorerProduct } from "@/lib/explorers/products";
import type {
  ExplorerFrameColor,
  ExplorerOrderQuantity,
  ExplorerSetOption,
} from "@/lib/explorers/buildASet";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "../ArtworkImage";
import styles from "./BuildASet.module.css";

type RoomId = "wall" | "crib" | "twin-bed" | "dresser" | "reading-nook";
type LayoutId = "row" | "arc" | "staggered";

type GalleryPreviewProps = {
  products: ExplorerProduct[];
  option: ExplorerSetOption;
  quantity: ExplorerOrderQuantity;
  frameColor: ExplorerFrameColor;
  onMove: (index: number, direction: -1 | 1) => void;
};

type RoomReference = {
  id: RoomId;
  label: string;
  image?: string;
  referenceLabel?: string;
  referenceWidthInches?: number;
  referenceWidthPercent?: number;
  artCenterYPercent: number;
};

const rooms: RoomReference[] = [
  { id: "wall", label: "On wall", artCenterYPercent: 46 },
  {
    id: "crib",
    label: "Above crib",
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

const layouts: { id: LayoutId; label: string }[] = [
  { id: "row", label: "Classic row" },
  { id: "arc", label: "Soft arc" },
  { id: "staggered", label: "Staggered" },
];

function formatInches(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function GalleryPreview({
  products,
  option,
  quantity,
  frameColor,
  onMove,
}: GalleryPreviewProps) {
  const [roomId, setRoomId] = useState<RoomId>("wall");
  const [layoutId, setLayoutId] = useState<LayoutId>("row");
  const room = rooms.find((item) => item.id === roomId) ?? rooms[0];
  const isCloseup = room.id === "wall";
  const gapInches = 2;
  const wallSpreadInches =
    option.finishedWidth * quantity + gapInches * Math.max(0, quantity - 1);
  const wallHeightInches =
    option.finishedHeight + (quantity === 3 && layoutId !== "row" ? 3 : 0);
  const scalePercentPerInch = isCloseup
    ? quantity === 1
      ? 2.75
      : 1.78
    : (room.referenceWidthPercent ?? 48) / (room.referenceWidthInches ?? 54);
  const spreadPercent = Math.min(
    isCloseup ? 78 : 66,
    wallSpreadInches * scalePercentPerInch,
  );
  const frameHeightPercent = Math.min(
    isCloseup ? 58 : 42,
    option.finishedHeight * scalePercentPerInch * (isCloseup ? 1.18 : 1.5),
  );
  const dimensionTopPercent =
    room.artCenterYPercent + frameHeightPercent / 2 + (isCloseup ? 6 : 5);
  const referenceText =
    room.referenceWidthInches && room.referenceLabel
      ? room.referenceWidthInches + " in " + room.referenceLabel
      : "close-up finish view";

  const visualizerStyle = {
    "--frame-width": String((option.finishedWidth / wallSpreadInches) * 100) + "%",
    "--frame-height": String(frameHeightPercent) + "%",
    "--frame-aspect-ratio": String(option.finishedWidth / option.finishedHeight),
    "--wall-spread": String(spreadPercent) + "%",
    "--art-center-y": String(room.artCenterYPercent) + "%",
    "--dimension-top": String(dimensionTopPercent) + "%",
  } as CSSProperties;

  const frameColorClass =
    frameColor === "natural"
      ? styles.wallFrameNatural
      : frameColor === "black"
        ? styles.wallFrameBlack
        : styles.wallFrameWhite;
  const pieceClassName = [
    styles.wallFrame,
    option.format === "Framed" ? styles.wallFrameFramed : styles.wallFramePrint,
    option.isMatted ? styles.wallFrameMatted : "",
    option.format === "Framed" ? frameColorClass : "",
  ]
    .filter(Boolean)
    .join(" ");
  const layoutClass =
    quantity === 1
      ? styles.wallLayoutSingle
      : layoutId === "row"
        ? styles.wallLayoutRow
        : layoutId === "arc"
          ? styles.wallLayoutArc
          : styles.wallLayoutStaggered;

  return (
    <section className={styles.galleryPreview} aria-labelledby="gallery-preview-title">
      <div className={styles.previewHeading}>
        <div>
          <p className={styles.eyebrow}>Live gallery preview</p>
          <h2 id="gallery-preview-title">See your Explorers come together.</h2>
        </div>
        <p>
          Start close to inspect the paper, mat, and frame. Then switch to a room to
          compare true proportions against familiar furniture.
        </p>
      </div>

      <div className={styles.wallStudio}>
        <div
          className={
            styles.wallScene + (isCloseup ? " " + styles.wallSceneCloseup : "")
          }
          style={visualizerStyle}
        >
          {room.image ? (
            <Image
              className={styles.roomBackground}
              src={withSiteBasePath(room.image)}
              alt={room.label + " scale reference"}
              loading="eager"
              fill
              sizes="(max-width: 900px) 100vw, 68vw"
            />
          ) : (
            <div className={styles.closeupWallTexture} aria-hidden="true" />
          )}

          <div
            className={styles.wallArtGroup + " " + layoutClass}
            aria-label={
              String(quantity) +
              " " +
              option.label.toLowerCase() +
              (isCloseup ? " shown close up" : " shown " + room.label.toLowerCase())
            }
          >
            {products.map((product, index) => (
              <div className={pieceClassName} key={product.slug}>
                <ArtworkImage src={product.image} title={product.title} />
                <span className={styles.acrylicGlint} aria-hidden="true" />
                <span className={styles.frameNumber} aria-hidden="true">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>

          {!isCloseup ? (
            <div className={styles.wallDimension} aria-hidden="true">
              <span />
              <strong>{formatInches(wallSpreadInches)} in total</strong>
              <span />
            </div>
          ) : null}
          <span className={styles.scaleReference}>{referenceText}</span>
        </div>

        <div className={styles.wallControls}>
          <fieldset className={styles.wallControlGroup}>
            <legend>View</legend>
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

          {quantity === 3 ? (
            <fieldset className={styles.wallControlGroup}>
              <legend>Layout</legend>
              <div className={styles.layoutChoices}>
                {layouts.map((layout) => {
                  const iconClass =
                    layout.id === "row"
                      ? styles.layoutIconRow
                      : layout.id === "arc"
                        ? styles.layoutIconArc
                        : styles.layoutIconStaggered;
                  return (
                    <button
                      className={
                        layout.id === layoutId ? styles.layoutChoiceActive : ""
                      }
                      type="button"
                      key={layout.id}
                      aria-pressed={layout.id === layoutId}
                      onClick={() => setLayoutId(layout.id)}
                    >
                      <span
                        className={styles.layoutIcon + " " + iconClass}
                        aria-hidden="true"
                      >
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{layout.label}</strong>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className={styles.wallOrder}>
            <p className={styles.wallControlLabel}>Artwork order</p>
            <div>
              {products.map((product, index) => (
                <div className={styles.orderItem} key={product.slug}>
                  <span className={styles.orderThumbnail}>
                    <ArtworkImage src={product.image} title={product.title} />
                  </span>
                  <span>
                    <small>
                      {quantity === 1 ? "Selected artwork" : "Position " + (index + 1)}
                    </small>
                    <strong>{product.title}</strong>
                  </span>
                  {quantity === 3 ? (
                    <span className={styles.orderButtons}>
                      <button
                        type="button"
                        title={"Move " + product.title + " left"}
                        aria-label={"Move " + product.title + " left"}
                        disabled={index === 0}
                        onClick={() => onMove(index, -1)}
                      >
                        {"\u2190"}
                      </button>
                      <button
                        type="button"
                        title={"Move " + product.title + " right"}
                        aria-label={"Move " + product.title + " right"}
                        disabled={index === products.length - 1}
                        onClick={() => onMove(index, 1)}
                      >
                        {"\u2192"}
                      </button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <dl className={styles.wallMeasurements}>
            <div>
              <dt>Each piece</dt>
              <dd>{option.finishedWidth} x {option.finishedHeight} in</dd>
            </div>
            <div>
              <dt>Wall spread</dt>
              <dd>
                {formatInches(wallSpreadInches)} x {formatInches(wallHeightInches)} in
              </dd>
            </div>
            {quantity === 3 ? (
              <div>
                <dt>Suggested gap</dt>
                <dd>{gapInches} in</dd>
              </div>
            ) : null}
            <div>
              <dt>Finish</dt>
              <dd>
                {option.format === "Print only"
                  ? "Print only"
                  : frameColor + (option.isMatted ? ", matted" : ", no mat")}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p className={styles.visualizerNote}>
        Room views are proportional guides based on standard furniture dimensions.
        Frame appearance is a close representation; furniture and decor are not
        included.
      </p>
    </section>
  );
}

