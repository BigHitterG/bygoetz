"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { withSiteBasePath } from "@/lib/sitePath";
import { getBasilOrigin } from "@/lib/communityGarden/urls";
import conceptDrawing from "../public/concepts/images/551F39B2-861F-4C86-A128-FFDC16CEB303.png";
import centerLogo from "../public/concepts/images/Logo-01.png";
import styles from "./HoneycombHome.module.css";

type Bubble = {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
};

type HoneycombBubblesConfig = {
  rings?: number;
  baseBubbleSize?: number;
  maxScale?: number;
  centerBubbleScaleMultiplier?: number;
  minScale?: number;
  maxInfluenceRadius?: number;
  minimumGap?: number;
};

type PointerInfo = { x: number; y: number; t: number };
type PinchInfo = { distance: number; zoom: number };
type ViewportCenter = { x: number; y: number };

const DEFAULT_CONFIG = {
  rings: 8,
  baseBubbleSize: 72,
  maxScale: 1.45,
  centerBubbleScaleMultiplier: 2,
  minScale: 0.45,
  maxInfluenceRadius: 420,
  minimumGap: 14,
};

const MOMENTUM_FRICTION = 0.94;
const MOMENTUM_STOP_SPEED = 0.08;
const SNAP_DURATION = 620;
const MOBILE_BREAKPOINT = 760;
const MOBILE_CENTER_BUBBLE_VIEWPORT_RATIO = 0.48;
const MOBILE_CENTER_BUBBLE_MIN_SIZE = 180;
const MOBILE_CENTER_BUBBLE_MAX_SIZE = 256;
const MIN_ZOOM = 0.88;
const MAX_ZOOM = 1;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const TAP_DRAG_THRESHOLD = 7;
const FOCUS_OVERLAY_DELAY = 900;
const EXPLORERS_SERIES_BUBBLE = { q: 1, r: 0 };
const EXPLORERS_BUBBLE_ID = `${EXPLORERS_SERIES_BUBBLE.q}:${EXPLORERS_SERIES_BUBBLE.r}`;
const EXPLORERS_LINK_ID = "explorers";
const COMMUNITY_GARDEN_BUBBLE = { q: -1, r: 0 };
const COMMUNITY_GARDEN_LINK_ID = "community-garden";
const LINKED_BUBBLE_ROUTES: Record<string, string> = {
  [EXPLORERS_LINK_ID]: "/explorers",
  [COMMUNITY_GARDEN_LINK_ID]: getBasilOrigin(),
};

function axialDistance(q: number, r: number) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function axialToPixel(q: number, r: number, spacing: number) {
  return {
    x: spacing * (q + r / 2),
    y: spacing * (Math.sqrt(3) / 2) * r,
  };
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getViewportSize() {
  if (typeof window === "undefined") return { width: 0, height: 0 };

  const viewport = window.visualViewport;

  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

function snapToDevicePixel(value: number) {
  if (typeof window === "undefined") return value;

  const ratio = window.devicePixelRatio || 1;
  return Math.round(value * ratio) / ratio;
}

function getPointerDistance(pointers: Map<number, PointerInfo>) {
  if (pointers.size < 2) return null;

  const [first, second] = Array.from(pointers.values());
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getLinkedBubbleTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;

  return target
    .closest<HTMLElement>("[data-linked-bubble-id]")
    ?.getAttribute("data-linked-bubble-id") ?? null;
}

function getResponsiveBaseBubbleSize(
  viewportWidth: number,
  maxScale: number,
  centerBubbleScaleMultiplier: number,
) {
  if (viewportWidth > MOBILE_BREAKPOINT) return DEFAULT_CONFIG.baseBubbleSize;

  const targetCenterBubbleSize = Math.min(
    MOBILE_CENTER_BUBBLE_MAX_SIZE,
    Math.max(
      MOBILE_CENTER_BUBBLE_MIN_SIZE,
      viewportWidth * MOBILE_CENTER_BUBBLE_VIEWPORT_RATIO,
    ),
  );

  return targetCenterBubbleSize / (maxScale * centerBubbleScaleMultiplier);
}

function generateBubbles(rings: number, spacing: number) {
  const bubbles: Bubble[] = [];

  for (let q = -rings; q <= rings; q += 1) {
    for (let r = -rings; r <= rings; r += 1) {
      if (axialDistance(q, r) > rings) continue;

      const { x, y } = axialToPixel(q, r, spacing);
      bubbles.push({ id: `${q}:${r}`, q, r, x, y });
    }
  }

  return bubbles;
}

export function HoneycombBubbles({
  rings = DEFAULT_CONFIG.rings,
  baseBubbleSize,
  maxScale = DEFAULT_CONFIG.maxScale,
  centerBubbleScaleMultiplier = DEFAULT_CONFIG.centerBubbleScaleMultiplier,
  minScale = DEFAULT_CONFIG.minScale,
  maxInfluenceRadius = DEFAULT_CONFIG.maxInfluenceRadius,
  minimumGap = DEFAULT_CONFIG.minimumGap,
}: HoneycombBubblesConfig) {
  const [responsiveBaseBubbleSize, setResponsiveBaseBubbleSize] = useState(() => {
    if (baseBubbleSize != null) return baseBubbleSize;
    return getResponsiveBaseBubbleSize(
      getViewportSize().width,
      maxScale,
      centerBubbleScaleMultiplier,
    );
  });
  const [showExplorersOverlay, setShowExplorersOverlay] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef(new Map<string, HTMLDivElement>());
  const translate = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const zoom = useRef(MAX_ZOOM);
  const viewportCenter = useRef<ViewportCenter>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, PointerInfo>());
  const pinch = useRef<PinchInfo | null>(null);
  const raf = useRef<number | null>(null);
  const momentum = useRef<number | null>(null);
  const snap = useRef<number | null>(null);
  const focusedBubbleId = useRef<string | null>(null);
  const overlayTimer = useRef<number | null>(null);
  const dragDistance = useRef(0);
  const linkedBubbleTarget = useRef<string | null>(null);

  const resolvedBaseBubbleSize = baseBubbleSize ?? responsiveBaseBubbleSize;
  const centerScale = maxScale * centerBubbleScaleMultiplier;
  const spacing = resolvedBaseBubbleSize * centerScale + minimumGap;
  const bubbles = useMemo(
    () => generateBubbles(rings, spacing),
    [rings, spacing],
  );

  const clearOverlayTimer = useCallback(() => {
    if (overlayTimer.current != null) window.clearTimeout(overlayTimer.current);
    overlayTimer.current = null;
  }, []);

  const hideExplorersOverlay = useCallback(() => {
    clearOverlayTimer();
    setShowExplorersOverlay(false);
  }, [clearOverlayTimer]);

  const scheduleExplorersOverlay = useCallback(() => {
    clearOverlayTimer();

    if (focusedBubbleId.current !== EXPLORERS_BUBBLE_ID || pointers.current.size !== 0) {
      setShowExplorersOverlay(false);
      return;
    }

    overlayTimer.current = window.setTimeout(() => {
      const canShowOverlay =
        focusedBubbleId.current === EXPLORERS_BUBBLE_ID &&
        pointers.current.size === 0 &&
        momentum.current == null &&
        snap.current == null;

      setShowExplorersOverlay(canShowOverlay);
      overlayTimer.current = null;
    }, FOCUS_OVERLAY_DELAY);
  }, [clearOverlayTimer]);

  const stopMomentum = useCallback(() => {
    if (momentum.current != null) cancelAnimationFrame(momentum.current);
    momentum.current = null;
  }, []);

  const stopSnap = useCallback(() => {
    if (snap.current != null) cancelAnimationFrame(snap.current);
    snap.current = null;
  }, []);

  const render = useCallback(() => {
    raf.current = null;
    const center = viewportCenter.current;
    const zoomLevel = zoom.current;
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const bubble of bubbles) {
      const element = bubbleRefs.current.get(bubble.id);
      if (!element) continue;

      const gridX = bubble.x * zoomLevel;
      const gridY = bubble.y * zoomLevel;
      const screenX = center.x + translate.current.x + gridX;
      const screenY = center.y + translate.current.y + gridY;
      const distanceFromCenter = Math.hypot(
        screenX - center.x,
        screenY - center.y,
      );
      const normalized = Math.min(distanceFromCenter / maxInfluenceRadius, 1);
      const scale =
        centerScale - (centerScale - minScale) * smoothstep(0, 1, normalized);
      const renderedBubbleSize = snapToDevicePixel(
        resolvedBaseBubbleSize * scale * zoomLevel,
      );
      const snappedScreenX = snapToDevicePixel(screenX);
      const snappedScreenY = snapToDevicePixel(screenY);

      if (distanceFromCenter < nearestDistance) {
        nearestDistance = distanceFromCenter;
        nearestId = bubble.id;
      }

      element.style.setProperty("--bubble-size", `${renderedBubbleSize}px`);
      element.style.transform = `translate(-50%, -50%) translate(${snappedScreenX}px, ${snappedScreenY}px)`;
      element.style.zIndex = String(Math.round((1 - normalized) * 1000));
    }

    if (focusedBubbleId.current !== nearestId) {
      const previousFocused = focusedBubbleId.current
        ? bubbleRefs.current.get(focusedBubbleId.current)
        : null;
      previousFocused?.classList.remove(styles.focusedBubble);
      const nextFocused = nearestId ? bubbleRefs.current.get(nearestId) : null;
      nextFocused?.classList.add(styles.focusedBubble);
      focusedBubbleId.current = nearestId;

      if (nearestId === EXPLORERS_BUBBLE_ID && pointers.current.size === 0) {
        scheduleExplorersOverlay();
      } else {
        hideExplorersOverlay();
      }
    }

    surfaceRef.current?.setAttribute("data-bubbles-ready", "true");
  }, [
    bubbles,
    centerScale,
    hideExplorersOverlay,
    maxInfluenceRadius,
    minScale,
    resolvedBaseBubbleSize,
    scheduleExplorersOverlay,
  ]);

  const renderImmediately = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    render();
  }, [render]);

  const scheduleRender = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(render);
  }, [render]);

  const setZoom = useCallback(
    (nextZoom: number) => {
      const clampedZoom = clampZoom(nextZoom);
      if (Math.abs(clampedZoom - zoom.current) < 0.001) return;

      zoom.current = clampedZoom;
      scheduleRender();
    },
    [scheduleRender],
  );

  const moveBy = useCallback(
    (dx: number, dy: number) => {
      translate.current.x += dx;
      translate.current.y += dy;
      scheduleRender();
    },
    [scheduleRender],
  );

  const snapNearestBubbleToCenter = useCallback(() => {
    stopSnap();
    const center = viewportCenter.current;
    const zoomLevel = zoom.current;
    let nearestBubble: Bubble | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const bubble of bubbles) {
      const screenX = center.x + translate.current.x + bubble.x * zoomLevel;
      const screenY = center.y + translate.current.y + bubble.y * zoomLevel;
      const distanceFromCenter = Math.hypot(
        screenX - center.x,
        screenY - center.y,
      );
      if (distanceFromCenter < nearestDistance) {
        nearestDistance = distanceFromCenter;
        nearestBubble = bubble;
      }
    }

    if (!nearestBubble || nearestDistance < 0.5) {
      scheduleExplorersOverlay();
      return;
    }

    const start = { ...translate.current };
    const delta = {
      x: center.x - (center.x + start.x + nearestBubble.x * zoomLevel),
      y: center.y - (center.y + start.y + nearestBubble.y * zoomLevel),
    };
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / SNAP_DURATION, 1);
      const eased = easeOutCubic(progress);
      translate.current = {
        x: start.x + delta.x * eased,
        y: start.y + delta.y * eased,
      };
      scheduleRender();

      if (progress < 1) {
        snap.current = requestAnimationFrame(tick);
      } else {
        snap.current = null;
        scheduleExplorersOverlay();
      }
    };

    snap.current = requestAnimationFrame(tick);
  }, [bubbles, scheduleExplorersOverlay, scheduleRender, stopSnap]);

  const startMomentum = useCallback(() => {
    stopMomentum();

    const tick = () => {
      velocity.current.x *= MOMENTUM_FRICTION;
      velocity.current.y *= MOMENTUM_FRICTION;
      moveBy(velocity.current.x, velocity.current.y);

      if (
        Math.hypot(velocity.current.x, velocity.current.y) > MOMENTUM_STOP_SPEED
      ) {
        momentum.current = requestAnimationFrame(tick);
      } else {
        momentum.current = null;
        snapNearestBubbleToCenter();
      }
    };

    momentum.current = requestAnimationFrame(tick);
  }, [moveBy, snapNearestBubbleToCenter, stopMomentum]);

  useLayoutEffect(() => {
    const updateViewport = () => {
      const surfaceBounds = surfaceRef.current?.getBoundingClientRect();
      const viewportSize = getViewportSize();
      const width = surfaceBounds?.width ?? viewportSize.width;
      const height = surfaceBounds?.height ?? viewportSize.height;

      viewportCenter.current = {
        x: width / 2,
        y: height / 2,
      };

      if (baseBubbleSize == null) {
        setResponsiveBaseBubbleSize(
          getResponsiveBaseBubbleSize(
            width,
            maxScale,
            centerBubbleScaleMultiplier,
          ),
        );
      }

      renderImmediately();
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, [baseBubbleSize, centerBubbleScaleMultiplier, maxScale, renderImmediately]);

  useLayoutEffect(() => {
    surfaceRef.current?.removeAttribute("data-bubbles-ready");
    renderImmediately();
  }, [bubbles, resolvedBaseBubbleSize, renderImmediately]);

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      if (momentum.current != null) cancelAnimationFrame(momentum.current);
      if (snap.current != null) cancelAnimationFrame(snap.current);
      if (overlayTimer.current != null) window.clearTimeout(overlayTimer.current);
    },
    [],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    hideExplorersOverlay();
    stopMomentum();
    stopSnap();
    velocity.current = { x: 0, y: 0 };
    dragDistance.current = 0;
    linkedBubbleTarget.current = getLinkedBubbleTarget(event.target);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
    });

    const distance = getPointerDistance(pointers.current);
    pinch.current = distance == null ? null : { distance, zoom: zoom.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    event.preventDefault();
    const now = performance.now();
    const current = { x: event.clientX, y: event.clientY, t: now };
    pointers.current.set(event.pointerId, current);

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    dragDistance.current += Math.hypot(dx, dy);

    if (dragDistance.current > TAP_DRAG_THRESHOLD) {
      linkedBubbleTarget.current = null;
      hideExplorersOverlay();
    }

    if (pointers.current.size >= 2) {
      const distance = getPointerDistance(pointers.current);
      if (distance != null) {
        if (!pinch.current) {
          pinch.current = { distance, zoom: zoom.current };
        } else if (pinch.current.distance > 0) {
          setZoom(pinch.current.zoom * (distance / pinch.current.distance));
        }
      }
      velocity.current = { x: 0, y: 0 };
      return;
    }

    const dt = Math.max(16, current.t - previous.t);
    velocity.current = { x: (dx * 16) / dt, y: (dy * 16) / dt };
    moveBy(dx, dy);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;

    if (pointers.current.size !== 0) return;

    const targetLink = linkedBubbleTarget.current;
    linkedBubbleTarget.current = null;
    const linkedRoute = targetLink ? LINKED_BUBBLE_ROUTES[targetLink] : null;

    const shouldOpenLinkedBubble =
      linkedRoute != null &&
      dragDistance.current <= TAP_DRAG_THRESHOLD &&
      Math.hypot(velocity.current.x, velocity.current.y) <= 0.5;

    if (shouldOpenLinkedBubble && linkedRoute) {
      window.location.href = withSiteBasePath(linkedRoute);
      return;
    }

    if (Math.hypot(velocity.current.x, velocity.current.y) > 0.5) {
      startMomentum();
    } else {
      snapNearestBubbleToCenter();
    }
  }

  function onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    linkedBubbleTarget.current = null;
    hideExplorersOverlay();
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    hideExplorersOverlay();
    stopMomentum();
    stopSnap();
    velocity.current = { x: 0, y: 0 };
    setZoom(zoom.current - event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  }

  return (
    <div
      ref={surfaceRef}
      className={styles.surface}
      aria-label="Interactive honeycomb bubble grid"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    >
      {bubbles.map((bubble) => {
        const isCenterBubble = bubble.q === 0 && bubble.r === 0;
        const isExplorersBubble =
          bubble.q === EXPLORERS_SERIES_BUBBLE.q &&
          bubble.r === EXPLORERS_SERIES_BUBBLE.r;
        const isCommunityGardenBubble =
          bubble.q === COMMUNITY_GARDEN_BUBBLE.q &&
          bubble.r === COMMUNITY_GARDEN_BUBBLE.r;

        return (
          <div
            key={bubble.id}
            ref={(element) => {
              if (element) bubbleRefs.current.set(bubble.id, element);
              else bubbleRefs.current.delete(bubble.id);
            }}
            className={styles.bubble}
            style={
              {
                "--base-size": `${resolvedBaseBubbleSize}px`,
                "--bubble-size": `${resolvedBaseBubbleSize}px`,
              } as React.CSSProperties
            }
            aria-hidden={isExplorersBubble || isCommunityGardenBubble ? undefined : true}
          >
            {isCenterBubble ? (
              <img
                className={styles.centerLogo}
                src={centerLogo.src}
                alt=""
                draggable="false"
              />
            ) : null}
            {isExplorersBubble ? (
              <div
                className={styles.explorersLink}
                data-linked-bubble-id={EXPLORERS_LINK_ID}
                aria-label="Open The Explorers Series"
              >
                <img
                  className={styles.explorersPreview}
                  src={withSiteBasePath("/explorers/Monkey.png")}
                  alt="The Explorers Series"
                  draggable="false"
                  onError={(event) => {
                    if (event.currentTarget.src !== conceptDrawing.src) {
                      event.currentTarget.src = conceptDrawing.src;
                    }
                  }}
                />
              </div>
            ) : null}
            {isCommunityGardenBubble ? (
              <div
                className={styles.gardenLink}
                data-linked-bubble-id={COMMUNITY_GARDEN_LINK_ID}
                aria-label="Open Basil Community Garden"
              >
                <span className={styles.gardenPreview} aria-hidden="true">
                  <span />
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
      {showExplorersOverlay ? (
        <div className={styles.focusOverlay} aria-hidden="true">
          <div className={styles.focusOverlayPanel}>
            <div className={styles.focusOverlayHeading}>
              <p className={styles.focusOverlayKicker}>The Explorers Series</p>
              <h2>Modern geometric animal illustrations</h2>
            </div>
            <p className={styles.focusOverlayDescription}>
              A playful collection of print-ready artwork for nurseries,
              playrooms, reading corners, and creative homes.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HoneycombHome() {
  return <HoneycombBubbles />;
}

