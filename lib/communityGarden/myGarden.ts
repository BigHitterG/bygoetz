import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { MyGardenUpgradeType } from "@/app/community-garden/lib/myGardenCatalog";

export {
  MY_GARDEN_UPGRADES,
  type MyGardenUpgradeType,
} from "@/app/community-garden/lib/myGardenCatalog";

export const MY_GARDEN_PLANT_COST = 2;
export const MY_GARDEN_UPROOT_RETURN = 1;
export const GARDEN_DAILY_CARE_LIMIT = 20;

export const MY_GARDEN_PLANT_TYPES = [
  "rose",
  "sunflower",
  "lavender",
] as const;

export type MyGardenPlantType = (typeof MY_GARDEN_PLANT_TYPES)[number];

export type MyGardenPlant = {
  id: string;
  gridX: number;
  gridY: number;
  plantType: MyGardenPlantType;
  plantedAt: string;
};

export type MyGardenState = {
  careBalance: number;
  lifetimeCare: number;
  dailyCareLimit: number;
  plotLevel: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  plantCost: number;
  uprootReturn: number;
  nextExpansion: null | {
    level: number;
    width: number;
    height: number;
    careCost: number;
  };
  plants: MyGardenPlant[];
  upgrades: MyGardenUpgradeType[];
};

type ProgressRow = {
  care_balance: number;
  lifetime_care: number;
  plot_level: number;
};

type PersonalPlantRow = {
  id: string;
  grid_x: number;
  grid_y: number;
  plant_type: MyGardenPlantType;
  planted_at: string;
};

type PersonalUpgradeRow = {
  upgrade_type: MyGardenUpgradeType;
};

function getPlotDimensions(plotLevel: number) {
  if (plotLevel >= 3) return { width: 16, height: 20 };
  if (plotLevel === 2) return { width: 14, height: 18 };
  return { width: 12, height: 16 };
}

function getNextExpansion(plotLevel: number) {
  if (plotLevel >= 3) return null;
  if (plotLevel === 2) {
    return { level: 3, width: 16, height: 20, careCost: 50 };
  }
  return { level: 2, width: 14, height: 18, careCost: 20 };
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
    "Your current My Garden property is fully expanded.",
    "Earn more Care in the Community Garden before expanding.",
    "That My Garden upgrade is not available.",
    "That upgrade is already part of My Garden.",
    "Earn more Care in the Community Garden before adding that upgrade.",
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
    { data: upgrades, error: upgradesError },
  ] = await Promise.all([
    supabase
      .from("garden_member_progress")
      .select("care_balance,lifetime_care,plot_level")
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
      .from("garden_personal_upgrades")
      .select("upgrade_type")
      .eq("steward_id", stewardId)
      .order("purchased_at")
      .returns<PersonalUpgradeRow[]>(),
  ]);

  if (progressError) throw progressError;
  if (plantsError) throw plantsError;
  if (upgradesError) throw upgradesError;

  const dimensions = getPlotDimensions(progress.plot_level);
  return {
    careBalance: progress.care_balance,
    lifetimeCare: progress.lifetime_care,
    dailyCareLimit: GARDEN_DAILY_CARE_LIMIT,
    plotLevel: progress.plot_level,
    ...dimensions,
    maxWidth: 16,
    maxHeight: 20,
    plantCost: MY_GARDEN_PLANT_COST,
    uprootReturn: MY_GARDEN_UPROOT_RETURN,
    nextExpansion: getNextExpansion(progress.plot_level),
    plants: (plants ?? []).map((plant) => ({
      id: plant.id,
      gridX: plant.grid_x,
      gridY: plant.grid_y,
      plantType: plant.plant_type,
      plantedAt: plant.planted_at,
    })),
    upgrades: (upgrades ?? []).map((upgrade) => upgrade.upgrade_type),
  };
}

export async function claimGardenCare(stewardId: string, receiptToken: string) {
  const { data, error } = await getSupabaseAdmin().rpc("claim_garden_care", {
    p_steward_id: stewardId,
    p_receipt_token: receiptToken,
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

export async function expandMyGarden(stewardId: string) {
  const { error } = await getSupabaseAdmin().rpc("expand_my_garden", {
    p_steward_id: stewardId,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "My Garden could not be expanded."));
  }
  return getMyGarden(stewardId);
}

export async function purchaseMyGardenUpgrade(
  stewardId: string,
  upgradeType: MyGardenUpgradeType,
) {
  const { error } = await getSupabaseAdmin().rpc("purchase_my_garden_upgrade", {
    p_steward_id: stewardId,
    p_upgrade_type: upgradeType,
  });
  if (error) {
    throw new Error(getDatabaseMessage(error, "That upgrade could not be added."));
  }
  return getMyGarden(stewardId);
}
