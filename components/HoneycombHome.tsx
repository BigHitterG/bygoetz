"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import styles from "./HoneycombHome.module.css";

type Bubble = {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
  size: number;
};

type HoneycombBubblesConfig = {
  rings?: number;
  maxBubbleSize?: number;
  minBubbleSize?: number;
  spacing?: number;
};

type Transform = { x: number; y: number; zoom: number };
type PointerInfo = { x: number; y: number; t: number };

const DEFAULT_CONFIG = {
  rings: 5,
  maxBubbleSize: 104,
  minBubbleSize: 34,
  spacing: 112,
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.4;

function axialDistance(q: number, r: number) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function axialToPixel(q: number, r: number, spacing: number) {
  return {
    x: spacing * (q + r / 2),
    y: spacing * (Math.sqrt(3) / 2) * r,
  };
}

function generateBubbles({ rings = DEFAULT_CONFIG.rings, maxBubbleSize = DEFAULT_CONFIG.maxBubbleSize, minBubbleSize = DEFAULT_CONFIG.minBubbleSize, spacing = DEFAULT_CONFIG.spacing }: HoneycombBubblesConfig = {}) {
  const bubbles: Bubble[] = [];

  for (let q = -rings; q <= rings; q += 1) {
    for (let r = -rings; r <= rings; r += 1) {
      const distance = axialDistance(q, r);
      if (distance > rings) continue;

      const { x, y } = axialToPixel(q, r, spacing);
      const falloff = 1 - distance / rings;
      const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
      const size = minBubbleSize + (maxBubbleSize - minBubbleSize) * smoothFalloff;

      bubbles.push({ id: `${q}:${r}`, q, r, x, y, size });
    }
  }

  return bubbles;
}

function distance(a: PointerInfo, b: PointerInfo) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function HoneycombBubbles(config: HoneycombBubblesConfig) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const transform = useRef<Transform>({ x: 0, y: 0, zoom: 1 });
  const velocity = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, PointerInfo>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const raf = useRef<number | null>(null);
  const inertia = useRef<number | null>(null);

  const bubbles = useMemo(() => generateBubbles(config), [config.rings, config.maxBubbleSize, config.minBubbleSize, config.spacing]);

  const render = useCallback(() => {
    raf.current = null;
    if (!gridRef.current) return;

    const { x, y, zoom } = transform.current;
    gridRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
  }, []);

  const scheduleRender = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(render);
  }, [render]);

  const stopInertia = useCallback(() => {
    if (inertia.current != null) cancelAnimationFrame(inertia.current);
    inertia.current = null;
  }, []);

  const moveBy = useCallback((dx: number, dy: number) => {
    transform.current.x += dx;
    transform.current.y += dy;
    scheduleRender();
  }, [scheduleRender]);

  const zoomAround = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    const current = transform.current;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const pointerX = clientX - rect.left - rect.width / 2;
    const pointerY = clientY - rect.top - rect.height / 2;
    const zoomRatio = zoom / current.zoom;

    transform.current = {
      x: pointerX - (pointerX - current.x) * zoomRatio,
      y: pointerY - (pointerY - current.y) * zoomRatio,
      zoom,
    };
    scheduleRender();
  }, [scheduleRender]);

  const startInertia = useCallback(() => {
    stopInertia();

    const tick = () => {
      velocity.current.x *= 0.94;
      velocity.current.y *= 0.94;
      moveBy(velocity.current.x, velocity.current.y);

      if (Math.hypot(velocity.current.x, velocity.current.y) > 0.08) {
        inertia.current = requestAnimationFrame(tick);
      } else {
        inertia.current = null;
      }
    };

    inertia.current = requestAnimationFrame(tick);
  }, [moveBy, stopInertia]);

  useEffect(() => {
    const centerGrid = () => {
      const width = surfaceRef.current?.clientWidth ?? window.innerWidth;
      transform.current = { x: 0, y: 0, zoom: width < 760 ? 0.78 : 1 };
      scheduleRender();
    };

    centerGrid();
    window.addEventListener("resize", centerGrid);
    return () => window.removeEventListener("resize", centerGrid);
  }, [scheduleRender]);

  useEffect(() => () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    if (inertia.current != null) cancelAnimationFrame(inertia.current);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    stopInertia();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, t: performance.now() });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    event.preventDefault();
    const now = performance.now();
    const current = { x: event.clientX, y: event.clientY, t: now };
    pointers.current.set(event.pointerId, current);
    const activePointers = [...pointers.current.values()];

    if (activePointers.length >= 2) {
      const [first, second] = activePointers;
      const pinchDistance = distance(first, second);
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;

      if (!pinch.current) pinch.current = { distance: pinchDistance, zoom: transform.current.zoom };
      zoomAround(pinch.current.zoom * (pinchDistance / pinch.current.distance), centerX, centerY);
      return;
    }

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const dt = Math.max(16, current.t - previous.t);
    velocity.current = { x: (dx * 16) / dt, y: (dy * 16) / dt };
    moveBy(dx, dy);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;

    if (pointers.current.size === 0 && Math.hypot(velocity.current.x, velocity.current.y) > 0.5) {
      startInertia();
    }
  }

  return (
    <main className={styles.home} aria-label="Interactive honeycomb bubble grid">
      <div
        ref={surfaceRef}
        className={styles.surface}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(event) => {
          event.preventDefault();
          zoomAround(transform.current.zoom * Math.exp(-event.deltaY * 0.0016), event.clientX, event.clientY);
        }}
      >
        <div ref={gridRef} className={styles.grid}>
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={styles.bubble}
              style={{
                "--x": `${bubble.x}px`,
                "--y": `${bubble.y}px`,
                "--size": `${bubble.size}px`,
              } as React.CSSProperties}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export function HoneycombHome() {
  return <HoneycombBubbles />;
}
