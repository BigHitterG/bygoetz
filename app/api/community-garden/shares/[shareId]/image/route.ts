import { NextResponse } from "next/server";
import {
  downloadGardenShareImage,
  getPublicGardenShare,
} from "@/lib/communityGarden/shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await context.params;
  try {
    const share = await getPublicGardenShare(shareId);
    if (!share) {
      return NextResponse.json({ error: "That garden is no longer shared." }, { status: 404 });
    }

    const image = await downloadGardenShareImage(share.storagePath);
    return new Response(await image.arrayBuffer(), {
      headers: {
        "content-type": "image/png",
        "content-length": String(image.size),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Basil public garden image failed", {
      tokenSuffix: shareId.slice(-6),
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "That garden image is unavailable." }, { status: 503 });
  }
}
