"use client";

import { useEffect, useRef } from "react";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "./duck-pond.module.css";

type Duck = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
};

type Pointer = { x: number; y: number; active: boolean; ripple: number };

function fitCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.floor(rect.width * dpr));
  const pixelHeight = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function drawDuck(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(size, size);
  context.lineCap = "round";
  context.lineJoin = "round";

  context.fillStyle = "rgba(28, 72, 67, 0.11)";
  context.beginPath();
  context.ellipse(-0.05, 0.43, 0.92, 0.15, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255, 255, 246, 0.5)";
  context.lineWidth = 0.034;
  for (let ring = 0; ring < 2; ring += 1) {
    context.beginPath();
    context.ellipse(
      -0.08,
      0.45,
      0.96 + ring * 0.26,
      0.19 + ring * 0.05,
      0,
      0.12,
      Math.PI - 0.1,
    );
    context.stroke();
  }

  const yellow = context.createLinearGradient(-0.45, -0.55, 0.62, 0.5);
  yellow.addColorStop(0, "#fff27a");
  yellow.addColorStop(0.55, "#f4cd29");
  yellow.addColorStop(1, "#d99f0e");
  context.fillStyle = yellow;
  context.strokeStyle = "#654c18";
  context.lineWidth = 0.042;

  context.beginPath();
  context.moveTo(-0.78, 0.1);
  context.bezierCurveTo(-0.56, -0.13, -0.16, -0.22, 0.15, -0.13);
  context.bezierCurveTo(0.45, -0.04, 0.7, 0.14, 0.7, 0.35);
  context.bezierCurveTo(0.38, 0.55, -0.39, 0.57, -0.73, 0.36);
  context.bezierCurveTo(-0.92, 0.24, -0.91, 0.16, -0.78, 0.1);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#f5d331";
  context.beginPath();
  context.moveTo(-0.55, 0.1);
  context.quadraticCurveTo(-0.9, -0.02, -0.82, -0.33);
  context.quadraticCurveTo(-0.52, -0.13, -0.33, 0.03);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(0.35, -0.33, 0.42, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.beginPath();
  context.ellipse(-0.03, 0.12, 0.42, 0.22, -0.2, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = "rgba(115, 80, 13, 0.55)";
  context.lineWidth = 0.025;
  context.beginPath();
  context.arc(-0.08, 0.12, 0.23, 0.15, Math.PI * 0.92);
  context.stroke();

  context.fillStyle = "#f18c28";
  context.strokeStyle = "#713713";
  context.lineWidth = 0.038;
  context.beginPath();
  context.moveTo(0.58, -0.26);
  context.quadraticCurveTo(0.96, -0.22, 1.03, -0.06);
  context.quadraticCurveTo(0.79, 0.06, 0.51, -0.03);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#242218";
  context.beginPath();
  context.arc(0.45, -0.44, 0.056, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "white";
  context.beginPath();
  context.arc(0.47, -0.462, 0.018, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 0.052;
  context.beginPath();
  context.arc(0.2, -0.42, 0.2, Math.PI * 1.06, Math.PI * 1.55);
  context.stroke();
  context.restore();
}

function drawPond(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const water = context.createLinearGradient(0, 0, width, height);
  water.addColorStop(0, "#edf2d8");
  water.addColorStop(0.31, "#b8dabb");
  water.addColorStop(0.68, "#82bec0");
  water.addColorStop(1, "#dce6ca");
  context.fillStyle = water;
  context.fillRect(0, 0, width, height);

  const sunX = width * 0.78;
  const sunY = height * 0.2;
  const glow = context.createRadialGradient(
    sunX,
    sunY,
    2,
    sunX,
    sunY,
    Math.min(width, height) * 0.38,
  );
  glow.addColorStop(0, "rgba(255, 243, 180, 0.94)");
  glow.addColorStop(0.22, "rgba(255, 237, 170, 0.38)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.17;
  context.lineWidth = 1.2;
  for (let row = -1; row < 13; row += 1) {
    const y = (height / 11) * row + Math.sin(time * 0.00018 + row) * 10;
    context.strokeStyle = row % 2 ? "#fbfff3" : "#397b78";
    context.beginPath();
    context.moveTo(-40, y);
    for (let x = -40; x <= width + 60; x += 70) {
      context.quadraticCurveTo(
        x + 35,
        y + Math.sin(x * 0.009 + row + time * 0.00035) * 15,
        x + 70,
        y,
      );
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.17;
  context.fillStyle = "#356c4d";
  context.beginPath();
  context.moveTo(0, 0);
  context.bezierCurveTo(width * 0.13, height * 0.08, width * 0.05, height * 0.39, 0, height * 0.53);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(width, height);
  context.bezierCurveTo(width * 0.82, height * 0.84, width * 0.94, height * 0.6, width, height * 0.54);
  context.closePath();
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = 0.065;
  context.fillStyle = "#294d40";
  for (let y = 7; y < height; y += 17) {
    for (let x = (y % 34) + 5; x < width; x += 23) {
      context.fillRect(x, y, 0.8, 0.8);
    }
  }
  context.restore();
}

export function DuckPond() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ducksRef = useRef<Duck[]>([]);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, active: false, ripple: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let previous = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const seedDucks = (width: number, height: number) => {
      if (ducksRef.current.length) return;
      const count = Math.max(8, Math.min(17, Math.round((width * height) / 88000)));
      ducksRef.current = Array.from({ length: count }, (_, index) => ({
        x: width * (0.12 + ((index * 0.271) % 0.76)),
        y: height * (0.14 + ((index * 0.417) % 0.72)),
        vx: Math.cos(index * 1.7) * 0.2,
        vy: Math.sin(index * 2.1) * 0.13,
        phase: index * 1.91,
        size: 0.82 + (index % 5) * 0.06,
      }));
    };

    const render = (time: number) => {
      const { context, width, height } = fitCanvas(canvas);
      if (!context) return;

      seedDucks(width, height);
      const delta = Math.min(2.2, (time - previous) / 16.67) * (reducedMotion ? 0.2 : 1);
      previous = time;
      drawPond(context, width, height, time);

      const pointer = pointerRef.current;
      const baseSize = Math.max(23, Math.min(39, Math.min(width, height) * 0.047));

      for (const duck of ducksRef.current) {
        duck.vx += Math.cos(time * 0.00045 + duck.phase) * 0.0025 * delta;
        duck.vy += Math.sin(time * 0.00038 + duck.phase * 1.3) * 0.0019 * delta;

        if (pointer.active) {
          const dx = duck.x - pointer.x;
          const dy = duck.y - pointer.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const radius = Math.max(125, baseSize * 4.5);
          if (distance < radius) {
            const force = (1 - distance / radius) * 0.055 * delta;
            duck.vx += (dx / distance) * force;
            duck.vy += (dy / distance) * force;
          }
        }

        const speed = Math.hypot(duck.vx, duck.vy);
        if (speed > 0.52) {
          duck.vx = (duck.vx / speed) * 0.52;
          duck.vy = (duck.vy / speed) * 0.52;
        }

        duck.vx *= 0.997;
        duck.vy *= 0.997;
        duck.x += duck.vx * delta;
        duck.y += duck.vy * delta;

        const margin = baseSize * 1.8;
        if (duck.x < -margin) duck.x = width + margin;
        if (duck.x > width + margin) duck.x = -margin;
        if (duck.y < margin) {
          duck.y = margin;
          duck.vy = Math.abs(duck.vy);
        }
        if (duck.y > height - margin) {
          duck.y = height - margin;
          duck.vy = -Math.abs(duck.vy);
        }
      }

      ducksRef.current
        .slice()
        .sort((left, right) => left.y - right.y)
        .forEach((duck) => {
          const angle = Math.atan2(duck.vy, duck.vx) * 0.23;
          const depth = 0.78 + (duck.y / height) * 0.36;
          drawDuck(
            context,
            duck.x,
            duck.y + Math.sin(time * 0.002 + duck.phase) * 2,
            baseSize * duck.size * depth,
            angle,
          );
        });

      if (pointer.active) {
        pointer.ripple = (pointer.ripple + 0.8 * delta) % 45;
        context.save();
        context.strokeStyle = `rgba(255, 255, 245, ${0.34 * (1 - pointer.ripple / 45)})`;
        context.lineWidth = 1.4;
        context.beginPath();
        context.ellipse(
          pointer.x,
          pointer.y,
          18 + pointer.ripple,
          7 + pointer.ripple * 0.28,
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
        context.restore();
      }

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  function updatePointer(clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pointerRef.current.x = clientX - bounds.left;
    pointerRef.current.y = clientY - bounds.top;
    pointerRef.current.active = true;
  }

  return (
    <main className={styles.pond}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Rubber ducks floating on an interactive pond"
        onPointerMove={(event) => updatePointer(event.clientX, event.clientY)}
        onPointerDown={(event) => updatePointer(event.clientX, event.clientY)}
        onPointerUp={() => {
          pointerRef.current.active = false;
        }}
        onPointerCancel={() => {
          pointerRef.current.active = false;
        }}
        onPointerLeave={() => {
          pointerRef.current.active = false;
        }}
      />
      <a className={styles.backLink} href={withSiteBasePath("/")} aria-label="Return to the bubble grid">
        <span aria-hidden="true">←</span> bubbles
      </a>
      <p className={styles.whisper}>move softly</p>
    </main>
  );
}
