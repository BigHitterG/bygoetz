import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  createGardenShare,
  GARDEN_SHARE_MAX_BYTES,
  GARDEN_SHARE_MAX_DIMENSION,
  GARDEN_SHARE_MIN_HEIGHT,
  GARDEN_SHARE_MIN_WIDTH,
  GARDEN_SHARE_SCOPES,
  listGardenShares,
  type GardenShareScope,
} from "@/lib/communityGarden/shares";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

async function getMember(request: NextRequest) {
  const user = await getGardenUser(request);
  if (!user) return null;
  return getGardenStewardByUserId(user.id);
}

export async function GET(request: NextRequest) {
  const steward = await getMember(request);
  if (!steward) {
    return NextResponse.json(
      { error: "An active Garden Membership is required." },
      { status: 401 },
    );
  }

  try {
    return NextResponse.json({ shares: await listGardenShares(steward.id) });
  } catch (error) {
    console.error("Basil garden shares could not be listed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Your shared gardens could not be loaded." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid garden share origin." }, { status: 403 });
  }

  const steward = await getMember(request);
  if (!steward) {
    return NextResponse.json(
      { error: "An active Garden Membership is required." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a valid garden image." }, { status: 400 });
  }

  const rawScope = form.get("scope");
  const scope = GARDEN_SHARE_SCOPES.includes(rawScope as GardenShareScope)
    ? (rawScope as GardenShareScope)
    : null;
  const image = form.get("image");
  if (
    !scope ||
    !(image instanceof File) ||
    image.type !== "image/png" ||
    image.size < 100 ||
    image.size > GARDEN_SHARE_MAX_BYTES
  ) {
    return NextResponse.json(
      { error: "Choose a Whole Garden or Current View image under 2.5 MB." },
      { status: 400 },
    );
  }

  const bytes = await image.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8));
  const pngView = bytes.byteLength >= 24 ? new DataView(bytes) : null;
  const width = pngView?.getUint32(16) ?? 0;
  const height = pngView?.getUint32(20) ?? 0;
  if (
    signature.length !== PNG_SIGNATURE.length ||
    !PNG_SIGNATURE.every((value, index) => signature[index] === value) ||
    !pngView ||
    width < GARDEN_SHARE_MIN_WIDTH ||
    height < GARDEN_SHARE_MIN_HEIGHT ||
    width > GARDEN_SHARE_MAX_DIMENSION ||
    height > GARDEN_SHARE_MAX_DIMENSION
  ) {
    return NextResponse.json(
      { error: "The garden image is not a valid Basil snapshot." },
      { status: 400 },
    );
  }

  try {
    const share = await createGardenShare({
      stewardId: steward.id,
      scope,
      image: bytes,
      width,
      height,
    });
    return NextResponse.json(
      {
        share: {
          ...share,
          width,
          height,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The garden snapshot could not be shared.";
    const expected =
      message === "Stop sharing an older garden before creating another." ||
      message === "That is plenty of garden snapshots for now. Try again later.";
    console.error("Basil garden snapshot creation failed", {
      expected,
      message,
    });
    return NextResponse.json(
      { error: expected ? message : "The garden snapshot could not be shared." },
      { status: expected ? 429 : 503 },
    );
  }
}
