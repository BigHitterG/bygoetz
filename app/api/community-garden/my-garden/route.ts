import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  expandMyGarden,
  MY_GARDEN_PLANT_TYPES,
  MY_GARDEN_UPGRADES,
  plantInMyGarden,
  purchaseMyGardenUpgrade,
  uprootFromMyGarden,
  type MyGardenPlantType,
  type MyGardenUpgradeType,
} from "@/lib/communityGarden/myGarden";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isGridCoordinate(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 7;
}

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid My Garden request origin." }, { status: 403 });
  }

  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to open My Garden." }, { status: 401 });
  }

  const steward = await getGardenStewardByUserId(user.id);
  if (!steward) {
    return NextResponse.json(
      { error: "A Garden Membership is required to open My Garden." },
      { status: 403 },
    );
  }

  let payload: {
    action?: unknown;
    gridX?: unknown;
    gridY?: unknown;
    plantType?: unknown;
    plantId?: unknown;
    upgradeType?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Choose a valid My Garden action." }, { status: 400 });
  }

  try {
    if (payload.action === "plant") {
      if (
        !isGridCoordinate(payload.gridX) ||
        !isGridCoordinate(payload.gridY) ||
        !MY_GARDEN_PLANT_TYPES.includes(payload.plantType as MyGardenPlantType)
      ) {
        return NextResponse.json(
          { error: "Choose an open garden bed and an available plant." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await plantInMyGarden(
          steward.id,
          Number(payload.gridX),
          Number(payload.gridY),
          payload.plantType as MyGardenPlantType,
        ),
      );
    }

    if (payload.action === "uproot") {
      if (
        typeof payload.plantId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          payload.plantId,
        )
      ) {
        return NextResponse.json(
          { error: "Choose a plant in My Garden to uproot." },
          { status: 400 },
        );
      }
      return NextResponse.json(await uprootFromMyGarden(steward.id, payload.plantId));
    }

    if (payload.action === "expand") {
      return NextResponse.json(await expandMyGarden(steward.id));
    }

    if (payload.action === "purchase-upgrade") {
      if (
        !MY_GARDEN_UPGRADES.some(
          (upgrade) => upgrade.type === payload.upgradeType,
        )
      ) {
        return NextResponse.json(
          { error: "Choose an available My Garden upgrade." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await purchaseMyGardenUpgrade(
          steward.id,
          payload.upgradeType as MyGardenUpgradeType,
        ),
      );
    }

    return NextResponse.json({ error: "Choose a valid My Garden action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "My Garden could not be updated.",
      },
      { status: 409 },
    );
  }
}
