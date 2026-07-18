"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import type { ExplorerProduct } from "@/lib/explorers/products";
import type {
  ExplorerFrameColor,
  ExplorerOrderQuantity,
  ExplorerSetOption,
} from "@/lib/explorers/buildASet";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "../ArtworkImage";
import { ArtworkSelector } from "./ArtworkSelector";
import { onWallSingleNaturalShell } from "./onWallSingleNaturalShell";
import { readingNookBackground } from "./readingNookBackground";
import styles from "./BuildASet.module.css";

type RoomId = "wall" | "crib" | "twin-bed" | "dresser" | "reading-nook";
type LayoutId = "row" | "arc" | "staggered";

type GalleryPreviewProps = {
  products: Array<ExplorerProduct | null>;
  option: ExplorerSetOption;
  quantity: ExplorerOrderQuantity;
  frameColor: ExplorerFrameColor;
  onMove: (index: number, direction: -1 | 1) => void;
  availableProducts: ExplorerProduct[];
  onSelectArtwork: (index: number, product: ExplorerProduct) => void;
  initialLayoutId?: string;
  initialRoomId?: string;
  selectionControls: ReactNode;
  children: ReactNode;
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
  {
    id: "wall",
    label: "On wall",
    image: "/explorers/materials/legacy-wall-v2.webp",
    artCenterYPercent: 46,
  },
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
    image: readingNookBackground.replace("WPxRGE2ax", "WPxRGE2axZ"),
    referenceLabel: "reading bench",
    referenceWidthInches: 60,
    referenceWidthPercent: 66,
    artCenterYPercent: 34,
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
  availableProducts,
  onSelectArtwork,
  initialLayoutId,
  initialRoomId,
  selectionControls,
  children,
}: GalleryPreviewProps) {
  const initialRoom = rooms.some((room) => room.id === initialRoomId)
    ? (initialRoomId as RoomId)
    : "wall";
  const initialLayout = layouts.some((layout) => layout.id === initialLayoutId)
    ? (initialLayoutId as LayoutId)
    : "row";
  const [roomId, setRoomId] = useState<RoomId>(initialRoom);
  const [layoutId, setLayoutId] = useState<LayoutId>(initialLayout);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const pickerCloseRef = useRef<HTMLButtonElement>(null);
  const pickerDialogRef = useRef<HTMLElement>(null);
  const pickerTriggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const room = rooms.find((item) => item.id === roomId) ?? rooms[0];
  const isCloseup = room.id === "wall";
  const usesRenderedOnWallFrames =
    isCloseup &&
    option.format === "Framed" &&
    (quantity === 1 || (quantity === 3 && layoutId === "row"));
  const gapInches = 2;
  const wallSpreadInches =
    option.finishedWidth * quantity + gapInches * Math.max(0, quantity - 1);
  const wallHeightInches =
    option.finishedHeight + (quantity === 3 && layoutId !== "row" ? 3 : 0);
  const scalePercentPerInch = isCloseup
    ? quantity === 1
      ? 5
      : 1.78
    : (room.referenceWidthPercent ?? 48) / (room.referenceWidthInches ?? 54);
  const spreadPercent =
    isCloseup && quantity === 1
      ? 44
      : Math.min(isCloseup ? 78 : 66, wallSpreadInches * scalePercentPerInch);
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

  const renderedWallStyle = {
    backgroundImage: `url("${onWallSingleNaturalShell}")`,
  } as CSSProperties;
  const renderedFrameStyle = {
    backgroundImage: `url("${onWallSingleNaturalShell}")`,
  } as CSSProperties;

  useEffect(() => {
    if (pickerIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    pickerCloseRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerIndex(null);
        return;
      }

      if (event.key !== "Tab" || !pickerDialogRef.current) return;
      const focusableElements = Array.from(
        pickerDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      pickerTriggerRefs.current[pickerIndex]?.focus();
    };
  }, [pickerIndex]);

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
      <h2 className={styles.srOnly} id="gallery-preview-title">
        Live gallery preview
      </h2>

      {usesRenderedOnWallFrames ? (
        <style>{`
          .explorers-rendered-wall {
            position: absolute;
            inset: 0;
            background-position: left center;
            background-repeat: no-repeat;
            background-size: 390% 100%;
          }
          .explorers-rendered-shell .${styles.wallFrame} {
            border: 0 !important;
            outline: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
          }
          .explorers-rendered-shell .${styles.wallFrame}::before,
          .explorers-rendered-shell .${styles.wallFrame}::after,
          .explorers-rendered-shell .${styles.acrylicGlint},
          .explorers-rendered-shell .${styles.frameNumber} {
            display: none !important;
          }
          .explorers-rendered-frame-skin {
            position: absolute;
            z-index: 1;
            inset: -4%;
            background-position: 50% 25%;
            background-repeat: no-repeat;
            background-size: 212% 112%;
            pointer-events: none;
          }
          .explorers-rendered-frame-tint {
            --rendered-frame-rail: clamp(5px, 1.35vw, 12px);
            position: absolute;
            z-index: 2;
            inset: -4%;
            box-sizing: border-box;
            border: 0;
            background: #ffffff;
            pointer-events: none;
          }
          .explorers-rendered-frame-tint-black {
            box-shadow:
              inset 0 0 0 var(--rendered-frame-rail) #151515,
              inset 0 0 0 calc(var(--rendered-frame-rail) + 1px) rgba(0, 0, 0, 0.42),
              inset 1px 1px 0 rgba(255, 255, 255, 0.11),
              0 1px 2px rgba(37, 29, 23, 0.24),
              0 10px 18px rgba(37, 29, 23, 0.16);
          }
          .explorers-rendered-frame-tint-white {
            background: #ffffff;
            box-shadow:
              inset 0 0 0 var(--rendered-frame-rail) #f7f7f4,
              inset 0 0 0 calc(var(--rendered-frame-rail) + 1px) rgba(65, 62, 57, 0.23),
              inset 1px 1px 0 rgba(255, 255, 255, 0.96),
              0 0 0 1px rgba(65, 62, 57, 0.24),
              0 1px 2px rgba(55, 45, 37, 0.2),
              0 10px 18px rgba(55, 45, 37, 0.13);
          }
          .explorers-rendered-shell[data-matted="true"] .explorers-rendered-frame-tint {
            background-color: #faf9f6;
          }
          .explorers-rendered-shell .${styles.wallFrame} img,
          .explorers-rendered-shell .${styles.wallFrame} > div {
            z-index: 3;
            border: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            object-fit: contain;
          }
          .explorers-rendered-shell[data-matted="true"] .${styles.wallFrame} img,
          .explorers-rendered-shell[data-matted="true"] .${styles.wallFrame} > div {
            top: 15% !important;
            left: 14% !important;
            width: 72% !important;
            height: 70% !important;
            box-sizing: border-box;
            border: 0 !important;
            box-shadow: none !important;
          }
          .explorers-rendered-shell[data-matted="false"] .${styles.wallFrame} img,
          .explorers-rendered-shell[data-matted="false"] .${styles.wallFrame} > div {
            top: 3% !important;
            left: 3% !important;
            width: 94% !important;
            height: 94% !important;
          }
          .explorers-rendered-shell .${styles.emptyArtwork} {
            z-index: 3;
            background: #ffffff !important;
          }
          .explorers-rendered-shell[data-matted="false"] .${styles.emptyArtwork} {
            top: 3% !important;
            left: 3% !important;
            width: 94% !important;
            height: 94% !important;
          }
          @media (max-width: 620px) {
            .${styles.wallSceneCloseup} .explorers-rendered-shell.${styles.wallLayoutSingle} {
              top: 50%;
              width: 52%;
            }
          }
        `}</style>
      ) : null}

      <div className={styles.wallStudio}>
        <div
          className={[styles.wallScene, isCloseup ? styles.wallSceneCloseup : ""]
            .filter(Boolean)
            .join(" ")}
          style={{ ...visualizerStyle, gridColumn: "1 / -1" }}
        >
          {usesRenderedOnWallFrames ? (
            <div
              className="explorers-rendered-wall"
              style={renderedWallStyle}
              aria-hidden="true"
            />
          ) : room.image ? (
            <Image
              className={styles.roomBackground}
              src={room.image.startsWith("data:") ? room.image : withSiteBasePath(room.image)}
              alt={room.label + " scale reference"}
              loading="eager"
              unoptimized={room.image.startsWith("data:")}
              fill
              sizes="(max-width: 900px) 100vw, 68vw"
            />
          ) : (
            <div className={styles.closeupWallTexture} aria-hidden="true" />
          )}

          <div
            className={[
              styles.wallArtGroup,
              layoutClass,
              usesRenderedOnWallFrames ? "explorers-rendered-shell" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-matted={usesRenderedOnWallFrames ? String(option.isMatted) : undefined}
            aria-label={
              String(quantity) +
              " " +
              option.label.toLowerCase() +
              ", " +
              products.filter(Boolean).length +
              " selected" +
              (isCloseup ? " shown close up" : " shown " + room.label.toLowerCase())
            }
          >
            {products.map((product, index) => (
              <div
                className={`${pieceClassName} ${product ? "" : styles.wallFrameEmpty}`}
                key={product?.slug ?? `empty-${index}`}
              >
                {usesRenderedOnWallFrames ? (
                  <>
                    {frameColor === "natural" ? (
                      <span
                        className="explorers-rendered-frame-skin"
                        style={renderedFrameStyle}
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className={`explorers-rendered-frame-tint explorers-rendered-frame-tint-${frameColor}`}
                        aria-hidden="true"
                      />
                    )}
                  </>
                ) : null}
                {product ? (
                  <ArtworkImage src={product.image} title={product.title} />
                ) : (
                  <span className={styles.emptyArtwork} aria-hidden="true">
                    <i>+</i>
                    <small>Choose artwork</small>
                  </span>
                )}
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
          {!usesRenderedOnWallFrames ? (
            <span className={styles.scaleReference}>{referenceText}</span>
          ) : null}
        </div>
      </div>

      <div
        className={styles.wallControls}
        style={{
          borderLeft: 0,
          borderTop: "1px solid #d8d2c9",
        }}
      >
        {selectionControls}

        <div className={styles.wallOrder} id="artwork-selection">
          <p className={styles.wallControlLabel}>Artwork selection</p>
          <p className={styles.selectionHelp}>
            Tap a position to choose its artwork. Use the arrows to adjust the order.
          </p>
          <div>
            {products.map((product, index) => (
              <div className={styles.orderItem} key={`position-${index}`}>
                <button
                  ref={(element) => {
                    pickerTriggerRefs.current[index] = element;
                  }}
                  className={styles.selectionSlotButton}
                  type="button"
                  onClick={() => setPickerIndex(index)}
                  aria-label={`Choose artwork for position ${index + 1}, currently ${product?.title ?? "empty"}`}
                >
                  <span
                    className={`${styles.orderThumbnail} ${product ? "" : styles.orderThumbnailEmpty}`}
                  >
                    {product ? (
                      <ArtworkImage src={product.image} title={product.title} />
                    ) : (
                      <span aria-hidden="true">+</span>
                    )}
                  </span>
                  <span className={styles.selectionSlotCopy}>
                    <small>
                      {quantity === 1 ? "Selected artwork" : "Position " + (index + 1)}
                    </small>
                    <strong>{product?.title ?? "Choose artwork"}</strong>
                    <em>Tap to change</em>
                  </span>
                </button>
                {quantity === 3 && product ? (
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

        <fieldset className={styles.wallControlGroup}>
          <legend>Preview room</legend>
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
            <legend>Preview arrangement</legend>
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

      {pickerIndex !== null ? (
        <div
          className={styles.artworkPickerBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPickerIndex(null);
          }}
        >
          <section
            ref={pickerDialogRef}
            className={styles.artworkPickerDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="artwork-picker-title"
            aria-describedby="artwork-picker-description"
          >
            <header>
              <div>
                <p className={styles.eyebrow}>
                  {quantity === 1 ? "Selected artwork" : `Position ${pickerIndex + 1}`}
                </p>
                <h2 id="artwork-picker-title">Choose an Explorer</h2>
              </div>
              <button
                ref={pickerCloseRef}
                className={styles.artworkPickerClose}
                type="button"
                aria-label="Close artwork picker"
                onClick={() => setPickerIndex(null)}
              >
                {"\u00d7"}
              </button>
            </header>
            <p id="artwork-picker-description">
              Choose the artwork for this position. Your wall updates immediately.
            </p>
            <ArtworkSelector
              products={availableProducts}
              selectedSlugs={products.map((product) => product?.slug ?? null)}
              activeIndex={pickerIndex}
              onSelect={(product) => {
                onSelectArtwork(pickerIndex, product);
                setPickerIndex(null);
              }}
            />
          </section>
        </div>
      ) : null}

      <p className={styles.visualizerNote}>
        Room views are proportional guides based on standard furniture dimensions.
        Frame appearance is a close representation; furniture and decor are not
        included.
      </p>
      {children}
    </section>
  );
}
