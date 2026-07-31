import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MY_GARDEN_PLANTS,
  type MyGardenElementType,
  type MyGardenPlantType,
} from "@/app/community-garden/lib/myGardenCatalog";
import {
  evaluateLivingGardenHabitats,
  isLivingGardenHabitatKey,
  type LivingGardenDiscovery,
  type LivingGardenHabitat,
  type LivingGardenHabitatKey,
} from "@/app/community-garden/lib/livingGarden";

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

export type MyGardenParcel = {
  parcelX: number;
  parcelY: number;
  minX: number;
  minY: number;
  width: 4;
  height: 4;
  careCost: number;
  purchaseOrdinal: number;
  source: "starter" | "legacy" | "classic" | "freeform";
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
  freeformExpansion?: boolean;
  landReturnUnlocked?: boolean;
  unlockedParcels?: MyGardenParcel[];
  expansionCandidates?: Array<MyGardenParcel & { careCost: number }>;
  reclaimCandidates?: Array<MyGardenParcel & { careCost: number }>;
  selectedParcel?: MyGardenParcel;
  plants: MyGardenPlant[];
  paths: MyGardenPath[];
  elements: MyGardenElement[];
  livingGardenDiscoveries?: LivingGardenDiscovery[];
  livingGardenHabitats?: LivingGardenHabitat[];
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

type ParcelRow = {
  parcel_x: number;
  parcel_y: number;
  purchase_ordinal: number | null;
  care_cost: number;
  source: "starter" | "legacy" | "classic" | "freeform";
};

type ReturnedParcelRow = {
  parcel_x: number;
  parcel_y: number;
  purchase_ordinal: number | null;
  care_cost: number;
  source: "legacy" | "classic" | "freeform";
};

type HabitatDiscoveryRow = {
  habitat_key: string;
  discovered_at: string;
  first_center_x: number;
  first_center_y: number;
  acknowledged_at: string | null;
};

type StewardshipProfileRow = {
  ordinary_footprint_capacity: number;
};

async function getLivingGardenState(
  stewardId: string,
  plants: MyGardenPlant[],
  elements: MyGardenElement[],
) {
  const supabase = getSupabaseAdmin();
  const habitats = evaluateLivingGardenHabitats(plants, elements);
  if (habitats.length > 0) {
    const { error: insertError } = await supabase
      .from("my_garden_habitat_discoveries")
      .upsert(
        habitats.map((habitat) => ({
          steward_id: stewardId,
          habitat_key: habitat.key,
          first_center_x: habitat.gridX,
          first_center_y: habitat.gridY,
          trigger_signature: habitat.signature,
        })),
        { onConflict: "steward_id,habitat_key", ignoreDuplicates: true },
      );
    if (insertError) throw insertError;
  }

  const { data, error } = await supabase
    .from("my_garden_habitat_discoveries")
    .select(
      "habitat_key,discovered_at,first_center_x,first_center_y,acknowledged_at",
    )
    .eq("steward_id", stewardId)
    .order("discovered_at")
    .returns<HabitatDiscoveryRow[]>();
  if (error) throw error;

  const discoveries = (data ?? []).flatMap((row) =>
    isLivingGardenHabitatKey(row.habitat_key)
      ? [
          {
            habitatKey: row.habitat_key,
            discoveredAt: row.discovered_at,
            firstCenterX: row.first_center_x,
            firstCenterY: row.first_center_y,
            acknowledgedAt: row.acknowledged_at,
          } satisfies LivingGardenDiscovery,
        ]
      : [],
  );
  return { discoveries, habitats };
}

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

export function getClassicExpansionParcelCount(plotLevel: number) {
  const current = getPlotBounds(plotLevel);
  const next = getPlotBounds(plotLevel + 1);
  return Math.max(
    1,
    (next.width * next.height - current.width * current.height) / 16,
  );
}

export function getFreeformParcelCareCost(plotLevel: number) {
  return Math.max(
    1,
    Math.ceil(
      getExpansionCareCost(plotLevel) /
        getClassicExpansionParcelCount(plotLevel),
    ),
  );
}

function getNextExpansion(plotLevel: number) {
  return {
    level: plotLevel + 1,
    ...getPlotBounds(plotLevel + 1),
    careCost: getExpansionCareCost(plotLevel),
  };
}

function mapParcel(row: ParcelRow): MyGardenParcel {
  return {
    parcelX: row.parcel_x,
    parcelY: row.parcel_y,
    minX: row.parcel_x * 4,
    minY: row.parcel_y * 4,
    width: 4,
    height: 4,
    careCost: row.care_cost,
    purchaseOrdinal: row.purchase_ordinal ?? 0,
    source: row.source,
  };
}

function getParcelBounds(parcels: MyGardenParcel[], fallbackLevel: number) {
  if (parcels.length === 0) return getPlotBounds(fallbackLevel);
  const minX = Math.min(...parcels.map((parcel) => parcel.minX));
  const minY = Math.min(...parcels.map((parcel) => parcel.minY));
  const maxX = Math.max(...parcels.map((parcel) => parcel.minX + 3));
  const maxY = Math.max(...parcels.map((parcel) => parcel.minY + 3));
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function getExpansionCandidates(parcels: MyGardenParcel[], plotLevel: number) {
  const owned = new Set(
    parcels.map((parcel) => `${parcel.parcelX}:${parcel.parcelY}`),
  );
  const candidates = new Map<string, MyGardenParcel & { careCost: number }>();
  for (const parcel of parcels) {
    for (const [offsetX, offsetY] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const parcelX = parcel.parcelX + offsetX;
      const parcelY = parcel.parcelY + offsetY;
      const key = `${parcelX}:${parcelY}`;
      if (owned.has(key) || candidates.has(key)) continue;
      candidates.set(key, {
        parcelX,
        parcelY,
        minX: parcelX * 4,
        minY: parcelY * 4,
        width: 4,
        height: 4,
        careCost: getFreeformParcelCareCost(plotLevel),
        purchaseOrdinal: plotLevel,
        source: "freeform",
      });
    }
  }
  return Array.from(candidates.values()).sort(
    (left, right) =>
      Math.abs(left.parcelX) + Math.abs(left.parcelY) -
        (Math.abs(right.parcelX) + Math.abs(right.parcelY)) ||
      left.parcelY - right.parcelY ||
      left.parcelX - right.parcelX,
  );
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
    "Choose a valid Builder action.",
    "Choose a valid Builder string.",
    "Builder strings can use between 1 and 10 tiles.",
    "A Builder string cannot cross itself.",
    "Each Builder tile must touch the previous tile.",
    "That Builder action identifier was already used.",
    "Choose a valid Builder path.",
    "Builder Mode supports one-tile items only.",
    "Every Builder tile must contain a plant to uproot.",
    "Every Builder tile must contain a path to remove.",
    "Every Builder tile must contain a one-tile item to pick up.",
    "One of those Builder tiles is already occupied.",
    "One of those Builder tiles is occupied.",
    "Reach Caretaker to shape freeform garden clearings.",
    "Open the starter garden parcels first.",
    "Choose a forest clearing touching your garden.",
    "That clearing is already part of My Garden.",
    "That clearing is not part of My Garden.",
    "Your original garden clearing always stays.",
    "Clear every plant, path, and item before returning this land.",
    "My Garden must keep its original clearing.",
    "That clearing connects two parts of My Garden and cannot be returned yet.",
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

  const [parcelInitialization, stewardshipInitialization] = await Promise.all([
    supabase.rpc("ensure_my_garden_parcels_v1", { p_steward_id: stewardId }),
    supabase.rpc("ensure_garden_stewardship_profile_v1", {
      p_steward_id: stewardId,
    }),
  ]);
  if (parcelInitialization.error) throw parcelInitialization.error;
  if (stewardshipInitialization.error) throw stewardshipInitialization.error;

  const [
    { data: progress, error: progressError },
    { data: plants, error: plantsError },
    { data: paths, error: pathsError },
    { data: elements, error: elementsError },
    { data: parcels, error: parcelsError },
    { data: returnedParcels, error: returnedParcelsError },
    { data: stewardshipProfile, error: stewardshipProfileError },
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
    supabase
      .from("garden_unlocked_parcels")
      .select("parcel_x,parcel_y,purchase_ordinal,care_cost,source")
      .eq("steward_id", stewardId)
      .order("parcel_y")
      .order("parcel_x")
      .returns<ParcelRow[]>(),
    supabase
      .from("garden_returned_parcels")
      .select("parcel_x,parcel_y,purchase_ordinal,care_cost,source")
      .eq("steward_id", stewardId)
      .order("returned_at", { ascending: false })
      .returns<ReturnedParcelRow[]>(),
    supabase
      .from("garden_stewardship_profiles")
      .select("ordinary_footprint_capacity")
      .eq("steward_id", stewardId)
      .single<StewardshipProfileRow>(),
  ]);

  if (progressError) throw progressError;
  if (plantsError) throw plantsError;
  if (pathsError) throw pathsError;
  if (elementsError) throw elementsError;
  if (parcelsError) throw parcelsError;
  if (returnedParcelsError) throw returnedParcelsError;
  if (stewardshipProfileError) throw stewardshipProfileError;

  const mappedPlants: MyGardenPlant[] = (plants ?? []).map((plant) => ({
    id: plant.id,
    gridX: plant.grid_x,
    gridY: plant.grid_y,
    plantType: plant.plant_type,
    plantedAt: plant.planted_at,
  }));
  const mappedElements: MyGardenElement[] = (elements ?? []).map((element) => ({
    id: element.id,
    gridX: element.grid_x,
    gridY: element.grid_y,
    elementType: element.element_type,
    careCost: element.care_cost,
    placedAt: element.placed_at,
  }));
  const livingGarden = await getLivingGardenState(
    stewardId,
    mappedPlants,
    mappedElements,
  );
  const unlockedParcels = (parcels ?? []).map(mapParcel);
  const reclaimCandidates = (returnedParcels ?? []).map(mapParcel);
  const dimensions = getParcelBounds(unlockedParcels, progress.plot_level);
  const stewardshipCapacity = Number(
    stewardshipProfile.ordinary_footprint_capacity ?? 100,
  );
  const freeformExpansion =
    progress.plot_level >= 5 && stewardshipCapacity >= 125;
  const landReturnUnlocked =
    progress.plot_level >= 5 && stewardshipCapacity >= 175;
  const expansionCandidates = freeformExpansion
    ? getExpansionCandidates(unlockedParcels, progress.plot_level)
    : [];
  // Classic Care-funded expansion never disappears. Caretaker adds the
  // freeform option; it does not replace the familiar next parcel.
  const nextExpansion = getNextExpansion(progress.plot_level);
  return {
    careBalance: progress.care_balance,
    lifetimeCare: progress.lifetime_care,
    inventorySeenLifetimeCare: progress.inventory_seen_lifetime_care,
    dailyCareLimit: GARDEN_DAILY_CARE_LIMIT,
    plotLevel: progress.plot_level,
    ...dimensions,
    maxWidth: nextExpansion?.width ?? dimensions.width + 8,
    maxHeight: nextExpansion?.height ?? dimensions.height + 8,
    plantCost: MY_GARDEN_PLANT_COST,
    uprootReturn: MY_GARDEN_UPROOT_RETURN,
    nextExpansion,
    freeformExpansion,
    landReturnUnlocked,
    unlockedParcels,
    expansionCandidates,
    reclaimCandidates,
    plants: mappedPlants,
    paths: (paths ?? []).map((path) => ({
      gridX: path.grid_x,
      gridY: path.grid_y,
    })),
    elements: mappedElements,
    livingGardenDiscoveries: livingGarden.discoveries,
    livingGardenHabitats: livingGarden.habitats,
  };
}

export async function acknowledgeLivingGardenDiscovery(
  stewardId: string,
  habitatKey: LivingGardenHabitatKey,
) {
  const { error } = await getSupabaseAdmin()
    .from("my_garden_habitat_discoveries")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("steward_id", stewardId)
    .eq("habitat_key", habitatKey)
    .is("acknowledged_at", null);
  if (error) throw error;
  return getMyGarden(stewardId);
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

export async function expandMyGarden(
  stewardId: string,
  gridX?: number,
  gridY?: number,
) {
  const supabase = getSupabaseAdmin();
  const freeform = Number.isInteger(gridX) && Number.isInteger(gridY);
  const { error } = freeform
    ? await supabase.rpc("expand_my_garden_freeform_v1", {
        p_steward_id: stewardId,
        p_parcel_x: Math.floor(Number(gridX) / 4),
        p_parcel_y: Math.floor(Number(gridY) / 4),
      })
    : await supabase.rpc("expand_my_garden_with_parcels_v1", {
        p_steward_id: stewardId,
      });
  if (error) {
    throw new Error(getDatabaseMessage(error, "My Garden could not be expanded."));
  }
  return getMyGarden(stewardId);
}

export async function returnMyGardenClearing(
  stewardId: string,
  gridX: number,
  gridY: number,
) {
  const { error } = await getSupabaseAdmin().rpc(
    "return_my_garden_clearing_v1",
    {
      p_steward_id: stewardId,
      p_parcel_x: Math.floor(gridX / 4),
      p_parcel_y: Math.floor(gridY / 4),
    },
  );
  if (error) {
    throw new Error(
      getDatabaseMessage(error, "That clearing could not be returned."),
    );
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

export async function applyMyGardenBuilderAction(
  stewardId: string,
  input: {
    actionId: string;
    mode: "place" | "remove";
    category: "plant" | "path" | "element";
    itemType: MyGardenPlantType | MyGardenElementType | "path" | null;
    cells: Array<{ gridX: number; gridY: number }>;
  },
) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("apply_my_garden_builder_action", {
    p_steward_id: stewardId,
    p_action_id: input.actionId,
    p_mode: input.mode,
    p_category: input.category,
    p_item_type: input.itemType,
    p_cells: input.cells,
  });
  if (error) {
    throw new Error(
      getDatabaseMessage(error, "That Builder string could not be applied."),
    );
  }
  return getMyGarden(stewardId);
}
