"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
const FEATURED_CONCEPT_BUBBLE = { q: 1, r: 0 };

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

function getViewportSize() {
  if (typeof window === "undefined") return { width: 0, height: 0 };

  const viewport = window.visualViewport;

  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef(new Map<string, HTMLDivElement>());
  const translate = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const viewportCenter = useRef<ViewportCenter>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, PointerInfo>());
  const raf = useRef<number | null>(null);
  const momentum = useRef<number | null>(null);
  const snap = useRef<number | null>(null);
  const focusedBubbleId = useRef<string | null>(null);

  const resolvedBaseBubbleSize = baseBubbleSize ?? responsiveBaseBubbleSize;
  const centerScale = maxScale * centerBubbleScaleMultiplier;
  const spacing = resolvedBaseBubbleSize * centerScale + minimumGap;
  const bubbles = useMemo(
    () => generateBubbles(rings, spacing),
    [rings, spacing],
  );

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
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const bubble of bubbles) {
      const element = bubbleRefs.current.get(bubble.id);
      if (!element) continue;

      const screenX = center.x + translate.current.x + bubble.x;
      const screenY = center.y + translate.current.y + bubble.y;
      const distanceFromCenter = Math.hypot(
        screenX - center.x,
        screenY - center.y,
      );
      const normalized = Math.min(distanceFromCenter / maxInfluenceRadius, 1);
      const scale =
        centerScale - (centerScale - minScale) * smoothstep(0, 1, normalized);

      if (distanceFromCenter < nearestDistance) {
        nearestDistance = distanceFromCenter;
        nearestId = bubble.id;
      }

      element.style.transform = `translate(-50%, -50%) translate3d(${screenX}px, ${screenY}px, 0) scale(${scale})`;
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
    }

    surfaceRef.current?.setAttribute("data-bubbles-ready", "true");
  }, [bubbles, centerScale, maxInfluenceRadius, minScale]);

  const renderImmediately = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    render();
  }, [render]);

  const scheduleRender = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(render);
  }, [render]);

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
    let nearestBubble: Bubble | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const bubble of bubbles) {
      const screenX = center.x + translate.current.x + bubble.x;
      const screenY = center.y + translate.current.y + bubble.y;
      const distanceFromCenter = Math.hypot(
        screenX - center.x,
        screenY - center.y,
      );
      if (distanceFromCenter < nearestDistance) {
        nearestDistance = distanceFromCenter;
        nearestBubble = bubble;
      }
    }

    if (!nearestBubble || nearestDistance < 0.5) return;

    const start = { ...translate.current };
    const delta = {
      x: center.x - (center.x + start.x + nearestBubble.x),
      y: center.y - (center.y + start.y + nearestBubble.y),
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
      }
    };

    snap.current = requestAnimationFrame(tick);
  }, [bubbles, scheduleRender, stopSnap]);

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
    },
    [],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    stopMomentum();
    stopSnap();
    velocity.current = { x: 0, y: 0 };
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
    });
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
    const dt = Math.max(16, current.t - previous.t);
    velocity.current = { x: (dx * 16) / dt, y: (dy * 16) / dt };
    moveBy(dx, dy);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);

    if (pointers.current.size !== 0) return;

    if (Math.hypot(velocity.current.x, velocity.current.y) > 0.5) {
      startMomentum();
    } else {
      snapNearestBubbleToCenter();
    }
  }

  return (
    <div
      ref={surfaceRef}
      className={styles.surface}
      aria-label="Interactive honeycomb bubble grid"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {bubbles.map((bubble) => (
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
            } as React.CSSProperties
          }
          aria-hidden="true"
        >
          {bubble.q === 0 && bubble.r === 0 ? (
            <img
              className={styles.centerLogo}
              src={centerLogo.src}
              alt=""
              draggable="false"
            />
          ) : null}
          {bubble.q === FEATURED_CONCEPT_BUBBLE.q &&
          bubble.r === FEATURED_CONCEPT_BUBBLE.r ? (
            <img
              className={styles.conceptDrawing}
              src={conceptDrawing.src}
              alt=""
              draggable="false"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function HoneycombHome() {
  return <HoneycombBubbles />;
}
