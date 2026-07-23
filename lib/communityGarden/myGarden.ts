import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MY_GARDEN_PLANTS,
  type MyGardenElementType,
  type MyGardenPlantType,
} from "@/app/community-garden/lib/myGardenCatalog";

export {
  MY_GARDEN_ELEMENTS,
  MY_GARDEN_PLANTS,
  type MyGardenElementType,
  type MyGardenPlantType,
} from "@/app/community-garden/lib/myGardenCatalog";

export const MY_GARDEN_PLANT_COST = 2;
export const MY_GARDEN_UPROOT_RETURN = 1;
export const GARDEN_DAILY_CARE_LIMIT = 20;

export const MY_GARDEN_PLANT_TYPES = MY_GARDEN_PLANTS.map(
  (plant) => plant.type,
);

export type MyGardenPlant = {
  id: string;
  gridX: number;
  gridY: number;
  plantType: MyGardenPlantType;
  plantedAt: string;
};

export type MyGardenPath = {
  gridX: number;
  gridY: number;
};

export type MyGardenElement = {
  id: string;
  gridX: number;
  gridY: number;
  elementType: MyGardenElementType;
  careCost: number;
  placedAt: string;
};

export type MyGardenPreviewImport = {
  careBalance: number;
  plants: Array<{
    gridX: number;
    gridY: number;
    plantType: MyGardenPlantType;
  }>;
  paths: MyGardenPath[];
};

export type MyGardenState = {
  careBalance: number;
  lifetimeCare: number;
  inventorySeenLifetimeCare: number;
  dailyCareLimit: number;
  plotLevel: number;
  minX: number;
  minY: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  plantCost: number;
  uprootReturn: number;
  nextExpansion: null | {
    level: number;
    minX: number;
    minY: number;
    width: number;
    height: number;
    careCost: number;
  };
  plants: MyGardenPlant[];
  paths: MyGardenPath[];
  elements: MyGardenElement[];
  preview?: {
    plantingLimit: number;
    plantingsUsed: number;
  };
};

type ProgressRow = {
  care_balance: number;
  lifetime_care: number;
  inventory_seen_lifetime_care: number;
  plot_level: number;
};

type PersonalPlantRow = {
  id: string;
  grid_x: number;
  grid_y: number;
  plant_type: MyGardenPlantType;
  planted_at: string;
};

type PersonalPathRow = {
  grid_x: number;
  grid_y: number;
};

type PersonalElementRow = {
  id: string;
  grid_x: number;
  grid_y: number;
  element_type: MyGardenElementType;
  care_cost: number;
  placed_at: string;
};

export function getPlotBounds(plotLevel: number) {
  const expansions = Math.max(0, Math.floor(plotLevel) - 1);
  const right = Math.floor((expansions + 3) / 4);
  const down = Math.floor((expansions + 2) / 4);
  const left = Math.floor((expansions + 1) / 4);
  const up = Math.floor(expansions / 4);
  const minX = -left * 4;
  const minY = -up * 4;
  const width = 12 + (left + right) * 4;
  const height = 16 + (up + down) * 4;
  return { minX, minY, width, height };
}

export function getExpansionCareCost(plotLevel: number) {
  if (plotLevel === 1) return 30;
  if (plotLevel === 2) return 50;
  if (plotLevel === 3) return 75;
  if (plotLevel === 4) return 100;
  const ringStep = plotLevel - 4;
  return Math.min(
    2_000_000_000,
    100 + 25 * ringStep + (5 * ringStep * (ringStep + 1)) / 2,
  );
}

function getNextExpansion(plotLevel: number) {
  return {
    level: plotLevel + 1,
    ...getPlotBounds(plotLevel + 1),
    careCost: getExpansionCareCost(plotLevel),
  };
}

function getDatabaseMessage(error: unknown, fallback: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const allowedMessages = [
    "An active Garden Membership is required.",
    "That Care receipt has expired or was already claimed.",
    "That plant is not available in My Garden.",
    "That spot is outside your current fenced garden.",
    "Earn more Care in the Community Garden before planting here.",
    "That garden spot is already planted.",
    "That plant is no longer in My Garden.",
    "Earn more Care in the Community Garden before expanding.",
    "That item is not available in My Garden.",
    "Earn more lifetime Care to unlock this collection.",
    "That item does not fit inside your current fenced garden.",
    "That garden spot already has an item.",
    "That garden spot is occupied.",
    "Earn more Care in the Community Garden before placing that item.",
    "That item is no longer in My Garden.",
  ];
  return allowedMessages.find((candidate) => message.includes(candidate)) ?? fallback;
}

export async function getMyGarden(stewardId: string): Promise<MyGardenState> {
  const supabase = getSupabaseAdmin();
  const { error: initializeError } = await supabase
    .from("garden_member_progress")
    .upsert({ steward_id: stewardId }, {
      onConflict: "steward_id",
      ignoreDuplicates: true,
    });
  if (initializeError) throw initializeError;

  const [
    { data: progress, error: progressError },
    { data: plants, error: plantsError },
    { data: paths, error: pathsError },
    { data: elements, error: elementsError },
  ] = await Promise.all([
    supabase
      .from("garden_member_progress")
      .select(
        "care_balance,lifetime_care,inventory_seen_lifetime_care,plot_level",
      )
      .eq("steward_id", stewardId)
      .single<ProgressRow>(),
    supabase
      .from("garden_personal_plants")
      .select("id,grid_x,grid_y,plant_type,planted_at")
      .eq("steward_id", stewardId)
      .order("grid_y")
      .order("grid_x")
      .returns<PersonalPlantRow[]>(),
    supabase
      .from("garden_personal_paths")
      .select("grid_x,grid_y")
      .eq("steward_id", stewardId)
      .order("grid_y")
      .order("grid_x")
      .returns<PersonalPathRow[]>(),
    supabase
      .from("garden_personal_elements")
      .select("id,grid_x,grid_y,element_type,care_cost,placed_at")
      .eq("steward_id", stewardId)
      .order("placed_at")
      .returns<PersonalElementRow[]>(),
  ]);

  if (progressError) throw progressError;
  if (plantsError) throw plantsError;
  if (pathsError) throw pathsError;
  if (elementsError) throw elementsError;

  const dimensions = getPlotBounds(progress.plot_level);
  const nextExpansion = getNextExpansion(progress.plot_level);
  return {
    careBalance: progress.care_balance,
    lifetimeCare: progress.lifetime_care,
    inventorySeenLifetimeCare: progress.inventory_seen_lifetime_care,
    dailyCareLimit: GARDEN_DAILY_CARE_LIMIT,
    plotLevel: progress.plot_level,
    ...dimensions,
    maxWidth: nextExpansion.width,
    maxHeight: nextExpansion.height,
    plantCost: MY_GARDEN_PLANT_COST,
    uprootReturn: MY_GARDEN_UPROOT_RETURN,
    nextExpansion,
    plants: (plants ?? []).map((plant) => ({
      id: plant.id,
      gridX: plant.grid_x,
      gridY: plant.grid_y,
      plantType: plant.plant_type,
      plantedAt: plant.planted_at,
    })),
    paths: (paths ?? []).map((path) => ({
      gridX: path.grid_x,
      gridY: path.grid_y,
    })),
    elements: (elements ?? []).map((element) => ({
      id: element.id,
      gridX: element.grid_x,
      gridY: element.grid_y,
      elementType: element.element_type,
      careCost: element.care_cost,
      placedAt: element.placed_at,
    })),
  };
}

export async function acknowledgeMyGardenInventory(stewardId: string) {
  const supabase = getSupabaseAdmin();
  const { data: progress, error: progressError } = await supabase
    .from("garden_member_progress")
    .select("lifetime_care,inventory_seen_lifetime_care")
    .eq("steward_id", stewardId)
    .single<Pick<
      ProgressRow,
      "lifetime_care" | "inventory_seen_lifetime_care"
    >>();
  if (progressError) throw progressError;

  if (progress.inventory_seen_lifetime_care < progress.lifetime_care) {
    const { error: updateError } = await supabase
      .from("garden_member_progress")
      .update({ inventory_seen_lifetime_care: progress.lifetime_care })
      .eq("steward_id", stewardId);
    if (updateError) throw updateError;
  }

  return getMyGarden(stewardId);
}

export async function claimGardenCare(
  stewardId: string,
  receiptToken: string,
  actorKey: string,
) {
  const { data, error } = await getSupabaseAdmin().rpc("claim_garden_care", {
    p_steward_id: stewardId,
    p_receipt_token: receiptToken,
    p_actor_key: actorKey,
  });
  if (error) {
    throw new Error(
      getDatabaseMessage(error, "That Community Garden action could not earn Care."),
    );
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("The garden did not return a Care award.");
  return {
    awardedCare: Number(result.awarded_care ?? 0),
    careBalance: Number(result.care_balance ?? 0),
    lifetimeCare: Number(result.lifetime_care ?? 0),
    earningMode: result.earning_phase === "daily" ? "daily" : "standard",
    earningPhase: String(result.earning_phase ?? "full"),
  };
}

export async function plantInMyGarden(
  stewardId: string,
  gridX: number,
  gridY: number,
  plantType: MyGardenPlantType,
) {
  const { error } = await getSupabaseAdmin().rpc("plant_my_garden", {
    p_steward_id: stewardId,
    p_grid_x: gridX,
    p_grid_y: gridY,
    p_plant_type: plantType,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "That plant could not be placed."));
  }
  return getMyGarden(stewardId);
}

export async function uprootFromMyGarden(stewardId: string, plantId: string) {
  const { error } = await getSupabaseAdmin().rpc("uproot_my_garden", {
    p_steward_id: stewardId,
    p_plant_id: plantId,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "That plant could not be uprooted."));
  }
  return getMyGarden(stewardId);
}

export async function toggleMyGardenPath(
  stewardId: string,
  gridX: number,
  gridY: number,
) {
  const { error } = await getSupabaseAdmin().rpc("toggle_my_garden_path", {
    p_steward_id: stewardId,
    p_grid_x: gridX,
    p_grid_y: gridY,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "That path could not be changed."));
  }
  return getMyGarden(stewardId);
}

export async function importMyGardenPreview(
  stewardId: string,
  preview: MyGardenPreviewImport,
) {
  const { error } = await getSupabaseAdmin().rpc("import_my_garden_preview", {
    p_steward_id: stewardId,
    p_care_balance: preview.careBalance,
    p_plants: preview.plants,
    p_paths: preview.paths,
  });
  if (error) {
    throw new Error(
      getDatabaseMessage(error, "That garden preview could not be saved."),
    );
  }
  return getMyGarden(stewardId);
}

export async function expandMyGarden(stewardId: string) {
  const { error } = await getSupabaseAdmin().rpc("expand_my_garden", {
    p_steward_id: stewardId,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "My Garden could not be expanded."));
  }
  return getMyGarden(stewardId);
}

export async function placeMyGardenElement(
  stewardId: string,
  gridX: number,
  gridY: number,
  elementType: MyGardenElementType,
) {
  const { error } = await getSupabaseAdmin().rpc("place_my_garden_element", {
    p_steward_id: stewardId,
    p_grid_x: gridX,
    p_grid_y: gridY,
    p_element_type: elementType,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "That item could not be placed."));
  }
  return getMyGarden(stewardId);
}

export async function removeMyGardenElement(
  stewardId: string,
  elementId: string,
) {
  const { error } = await getSupabaseAdmin().rpc("remove_my_garden_element", {
    p_steward_id: stewardId,
    p_element_id: elementId,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "That item could not be removed."));
  }
  return getMyGarden(stewardId);
}
