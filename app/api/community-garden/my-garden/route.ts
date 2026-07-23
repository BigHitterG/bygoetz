import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  acknowledgeMyGardenInventory,
  expandMyGarden,
  importMyGardenPreview,
  MY_GARDEN_ELEMENTS,
  MY_GARDEN_PLANT_TYPES,
  placeMyGardenElement,
  plantInMyGarden,
  removeMyGardenElement,
  toggleMyGardenPath,
  uprootFromMyGarden,
  type MyGardenElementType,
  type MyGardenPlantType,
} from "@/lib/communityGarden/myGarden";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_PLANT_TYPES: readonly MyGardenPlantType[] = [
  "rose",
  "sunflower",
  "lavender",
];

function isGridCoordinate(value: unknown, minimum: number, maximum: number) {
  return (
    Number.isInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  );
}

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
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
    elementType?: unknown;
    elementId?: unknown;
    careBalance?: unknown;
    plants?: unknown;
    paths?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Choose a valid My Garden action." }, { status: 400 });
  }

  try {
    if (payload.action === "acknowledge-inventory") {
      return NextResponse.json(
        await acknowledgeMyGardenInventory(steward.id),
      );
    }

    if (payload.action === "import-preview") {
      const plants = Array.isArray(payload.plants) ? payload.plants : [];
      const paths = Array.isArray(payload.paths) ? payload.paths : [];
      const validPlants = plants.every(
        (candidate) =>
          candidate &&
          typeof candidate === "object" &&
          isGridCoordinate((candidate as { gridX?: unknown }).gridX, 0, 11) &&
          isGridCoordinate((candidate as { gridY?: unknown }).gridY, 0, 15) &&
          PREVIEW_PLANT_TYPES.includes(
            (candidate as { plantType?: unknown })
              .plantType as MyGardenPlantType,
          ),
      );
      const validPaths = paths.every(
        (candidate) =>
          candidate &&
          typeof candidate === "object" &&
          isGridCoordinate((candidate as { gridX?: unknown }).gridX, 0, 11) &&
          isGridCoordinate((candidate as { gridY?: unknown }).gridY, 0, 15),
      );
      if (
        !Number.isInteger(payload.careBalance) ||
        Number(payload.careBalance) < 0 ||
        Number(payload.careBalance) > 20 ||
        plants.length > 10 ||
        paths.length > 64 ||
        !validPlants ||
        !validPaths
      ) {
        return NextResponse.json(
          { error: "Choose a valid temporary garden to keep." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await importMyGardenPreview(steward.id, {
          careBalance: Number(payload.careBalance),
          plants: plants as Array<{
            gridX: number;
            gridY: number;
            plantType: MyGardenPlantType;
          }>,
          paths: paths as Array<{ gridX: number; gridY: number }>,
        }),
      );
    }

    if (payload.action === "plant") {
      if (
        !isGridCoordinate(payload.gridX, -100_000, 100_000) ||
        !isGridCoordinate(payload.gridY, -100_000, 100_000) ||
        !MY_GARDEN_PLANT_TYPES.includes(payload.plantType as MyGardenPlantType)
      ) {
        return NextResponse.json(
          { error: "Choose an open spot inside the fence and an available plant." },
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

    if (payload.action === "toggle-path") {
      if (
        !isGridCoordinate(payload.gridX, -100_000, 100_000) ||
        !isGridCoordinate(payload.gridY, -100_000, 100_000)
      ) {
        return NextResponse.json(
          { error: "Choose a spot inside the fence for the path." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await toggleMyGardenPath(
          steward.id,
          Number(payload.gridX),
          Number(payload.gridY),
        ),
      );
    }

    if (payload.action === "expand") {
      return NextResponse.json(await expandMyGarden(steward.id));
    }

    if (payload.action === "place-element") {
      if (
        !isGridCoordinate(payload.gridX, -100_000, 100_000) ||
        !isGridCoordinate(payload.gridY, -100_000, 100_000) ||
        !MY_GARDEN_ELEMENTS.some(
          (element) => element.type === payload.elementType,
        )
      ) {
        return NextResponse.json(
          { error: "Choose an open spot and an available My Garden item." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await placeMyGardenElement(
          steward.id,
          Number(payload.gridX),
          Number(payload.gridY),
          payload.elementType as MyGardenElementType,
        ),
      );
    }

    if (payload.action === "remove-element") {
      if (
        typeof payload.elementId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          payload.elementId,
        )
      ) {
        return NextResponse.json(
          { error: "Choose an item in My Garden to remove." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await removeMyGardenElement(steward.id, payload.elementId),
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
