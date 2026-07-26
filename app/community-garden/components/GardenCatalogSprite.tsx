"use client";

import { useEffect, useRef } from "react";
import {
  drawMyGardenElementPreview,
  drawMyGardenPlantPreview,
} from "../game/gardenRenderer";
import type {
  MyGardenElementType,
  MyGardenPlantType,
} from "../lib/myGardenCatalog";

type GardenCatalogSpriteProps =
  | { kind: "plant"; type: MyGardenPlantType; heritage?: boolean }
  | { kind: "element"; type: MyGardenElementType; heritage?: never };

const PREVIEW_WIDTH = 104;
const PREVIEW_HEIGHT = 96;

export function GardenCatalogSprite({
  kind,
  type,
  heritage = false,
}: GardenCatalogSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(PREVIEW_WIDTH * ratio);
    canvas.height = Math.round(PREVIEW_HEIGHT * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    context.imageSmoothingEnabled = false;
    const viewport = { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };
    if (kind === "plant") {
      drawMyGardenPlantPreview(context, type, viewport, Date.now(), heritage);
    } else {
      drawMyGardenElementPreview(context, type, viewport);
    }
  }, [heritage, kind, type]);

  return (
    <canvas
      ref={canvasRef}
      className="cg-catalog-sprite"
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      aria-hidden="true"
    />
  );
}
