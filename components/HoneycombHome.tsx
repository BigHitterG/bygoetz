"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./HoneycombHome.module.css";

type HoneycombIcon = {
  id: string;
  label: string;
  color: string;
  icon: string;
  href: string;
  x: number;
  y: number;
};

type Transform = { x: number; y: number; zoom: number };
type PointerInfo = { x: number; y: number; t: number };

const SPACING = 108;
const ROW_HEIGHT = SPACING * 0.86;
const MIN_ZOOM = 0.58;
const MAX_ZOOM = 1.85;
const TAP_SLOP = 8;
const LONG_PRESS_MS = 520;

const appSeeds = [
  ["home", "Home", "#0a84ff", "⌂", "/"],
  ["work", "Work", "#ff9f0a", "✦", "/work"],
  ["notes", "Notes", "#ffd60a", "✎", "/notes"],
  ["photos", "Photos", "#ff375f", "◉", "/photos"],
  ["music", "Music", "#bf5af2", "♪", "/music"],
  ["maps", "Maps", "#30d158", "⌖", "/maps"],
  ["mail", "Mail", "#64d2ff", "✉", "/mail"],
  ["calendar", "Calendar", "#ff453a", "31", "/calendar"],
  ["weather", "Weather", "#5e5ce6", "☁", "/weather"],
  ["fitness", "Fitness", "#32d74b", "↟", "/fitness"],
  ["shop", "Shop", "#ac8e68", "◈", "/shop"],
  ["studio", "Studio", "#ff2d55", "✺", "/studio"],
  ["journal", "Journal", "#8e8e93", "☾", "/journal"],
  ["chat", "Chat", "#00c7be", "…", "/chat"],
  ["tasks", "Tasks", "#5856d6", "✓", "/tasks"],
  ["wallet", "Wallet", "#34c759", "$", "/wallet"],
  ["news", "News", "#ff3b30", "N", "/news"],
  ["camera", "Camera", "#d1d1d6", "◌", "/camera"],
  ["settings", "Settings", "#636366", "⚙", "/settings"],
  ["profile", "Profile", "#ff7a00", "☺", "/profile"],
] as const;

function jitter(seed: number) {
  const value = Math.sin(seed * 999) * 10000;
  return (value - Math.floor(value) - 0.5) * 16;
}

function hexToPixel(col: number, row: number) {
  return { x: col * SPACING + (Math.abs(row) % 2) * (SPACING / 2), y: row * ROW_HEIGHT };
}

function nearestHex(x: number, y: number) {
  const row = Math.round(y / ROW_HEIGHT);
  const col = Math.round((x - (Math.abs(row) % 2) * (SPACING / 2)) / SPACING);
  return hexToPixel(col, row);
}

function makeInitialIcons(): HoneycombIcon[] {
  const coords = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2],[-2,-1],[2,-1],[-2,1],[2,1],[-1,-2],[1,2],[2,2]];
  return appSeeds.map(([id, label, color, icon, href], index) => {
    const [col, row] = coords[index];
    const point = hexToPixel(col, row);
    return { id, label, color, icon, href, x: point.x + jitter(index + 1), y: point.y + jitter(index + 41) };
  });
}

function clampWithResistance(value: number, limit: number) {
  if (Math.abs(value) <= limit) return value;
  return Math.sign(value) * (limit + (Math.abs(value) - limit) * 0.28);
}

export function HoneycombHome() {
  const [icons, setIcons] = useState<HoneycombIcon[]>(makeInitialIcons);
  const [editMode, setEditMode] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const transform = useRef<Transform>({ x: 0, y: 0, zoom: 1 });
  const velocity = useRef({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, PointerInfo>());
  const drag = useRef<{ startX: number; startY: number; iconId?: string; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const longPress = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const inertia = useRef<number | null>(null);
  const pinch = useRef<{ distance: number; zoom: number; center: { x: number; y: number } } | null>(null);
  const centered = useRef(false);

  const bounds = useMemo(() => ({ x: SPACING * 3.2, y: ROW_HEIGHT * 3.4 }), []);

  const render = useCallback(() => {
    raf.current = null;
    const el = fieldRef.current;
    if (!el) return;
    const { x, y, zoom } = transform.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const ix = Number(child.dataset.x ?? 0) * zoom + x + cx;
      const iy = Number(child.dataset.y ?? 0) * zoom + y + cy;
      const d = Math.hypot(ix - cx, iy - cy);
      const depth = Math.max(0, 1 - d / Math.max(rect.width, rect.height) * 1.35);
      child.style.setProperty("--depth-scale", String(0.74 + depth * 0.34));
      child.style.setProperty("--depth-opacity", String(0.42 + depth * 0.58));
      child.style.setProperty("--depth-blur", `${(1 - depth) * 1.8}px`);
    }
  }, []);

  const schedule = useCallback(() => { if (raf.current == null) raf.current = requestAnimationFrame(render); }, [render]);

  useEffect(() => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (rect && !centered.current) {
      transform.current = { x: -icons[0].x, y: -icons[0].y, zoom: rect.width < 680 ? 0.86 : 1 };
      centered.current = true;
    }
    schedule();
  }, [icons, schedule]);

  const moveBy = useCallback((dx: number, dy: number) => {
    transform.current.x = clampWithResistance(transform.current.x + dx, bounds.x);
    transform.current.y = clampWithResistance(transform.current.y + dy, bounds.y);
    schedule();
  }, [bounds, schedule]);

  const zoomAround = useCallback((nextZoom: number, cx: number, cy: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const old = transform.current.zoom;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const ox = cx - rect.left - rect.width / 2;
    const oy = cy - rect.top - rect.height / 2;
    transform.current.x = ox - (ox - transform.current.x) * (zoom / old);
    transform.current.y = oy - (oy - transform.current.y) * (zoom / old);
    transform.current.zoom = zoom;
    schedule();
  }, [schedule]);

  const stopInertia = () => { if (inertia.current) cancelAnimationFrame(inertia.current); inertia.current = null; };
  const startInertia = useCallback(() => {
    stopInertia();
    const tick = () => {
      velocity.current.x *= 0.94; velocity.current.y *= 0.94;
      moveBy(velocity.current.x, velocity.current.y);
      if (Math.hypot(velocity.current.x, velocity.current.y) > 0.15) inertia.current = requestAnimationFrame(tick);
    };
    inertia.current = requestAnimationFrame(tick);
  }, [moveBy]);

  function surfacePoint(clientX: number, clientY: number) {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - rect.width / 2 - transform.current.x) / transform.current.zoom, y: (clientY - rect.top - rect.height / 2 - transform.current.y) / transform.current.zoom };
  }

  function onPointerDown(event: React.PointerEvent, iconId?: string) {
    event.preventDefault(); stopInertia();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, t: performance.now() });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, iconId: editMode ? iconId : undefined, moved: false };
    if (iconId) longPress.current = window.setTimeout(() => setEditMode(true), LONG_PRESS_MS);
  }

  function onPointerMove(event: React.PointerEvent) {
    const prev = pointers.current.get(event.pointerId); if (!prev) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, t: performance.now() });
    const active = [...pointers.current.values()];
    if (active.length >= 2) {
      const [a, b] = active; const dist = Math.hypot(a.x - b.x, a.y - b.y); const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!pinch.current) pinch.current = { distance: dist, zoom: transform.current.zoom, center };
      zoomAround(pinch.current.zoom * (dist / pinch.current.distance), center.x, center.y); return;
    }
    const dx = event.clientX - prev.x; const dy = event.clientY - prev.y;
    const dt = Math.max(16, performance.now() - prev.t);
    velocity.current = { x: dx * 16 / dt, y: dy * 16 / dt };
    if (drag.current && Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY) > TAP_SLOP) { drag.current.moved = true; if (longPress.current) clearTimeout(longPress.current); }
    if (drag.current?.iconId) {
      const p = nearestHex(surfacePoint(event.clientX, event.clientY).x, surfacePoint(event.clientX, event.clientY).y);
      setIcons((items) => items.map((item) => item.id === drag.current?.iconId ? { ...item, x: p.x, y: p.y } : item));
    } else moveBy(dx, dy);
  }

  function onPointerUp(event: React.PointerEvent) {
    if (longPress.current) clearTimeout(longPress.current);
    pointers.current.delete(event.pointerId); pinch.current = null;
    suppressClick.current = Boolean(drag.current?.moved);
    if (!drag.current?.iconId && drag.current?.moved) startInertia();
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    drag.current = null;
  }

  return (
    <main className={styles.home} aria-label="Honeycomb app launcher">
      <div ref={surfaceRef} className={`${styles.surface} ${editMode ? styles.editing : ""}`} onPointerDown={(e) => onPointerDown(e)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={(e) => { e.preventDefault(); zoomAround(transform.current.zoom * Math.exp(-e.deltaY * 0.0014), e.clientX, e.clientY); }}>
        <div ref={fieldRef} className={styles.field}>
          {icons.map((item) => (
            <button key={item.id} data-x={item.x} data-y={item.y} className={styles.iconButton} style={{ "--x": `${item.x}px`, "--y": `${item.y}px`, "--color": item.color } as React.CSSProperties} onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, item.id); }} onClick={(e) => { if (suppressClick.current || editMode) e.preventDefault(); else window.history.pushState(null, "", item.href); }} aria-label={`Open ${item.label}`}>
              <span className={styles.glyph} aria-hidden="true">{item.icon}</span><span className={styles.label}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button className={styles.editToggle} onClick={() => setEditMode((v) => !v)}>{editMode ? "Done" : "Edit"}</button>
    </main>
  );
}
