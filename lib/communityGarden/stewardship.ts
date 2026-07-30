import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { GardenStewardshipSummary } from "@/app/community-garden/lib/stewardshipTypes";

export async function getGardenStewardship(stewardId: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_garden_stewardship_summary_v1",
    { p_steward_id: stewardId },
  );
  if (error) throw error;
  return data as GardenStewardshipSummary;
}

export async function recordGardenStewardshipAction(input: {
  actionId: string;
  actorKey: string;
  actionType: "plant" | "water" | "weed";
  gridX?: number;
  gridY?: number;
  plantType?: string;
  plantIds?: string[];
  result: Record<string, unknown>;
  guidanceZone: "garden" | "heart" | "growth-ring" | null;
}) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "record_garden_stewardship_action_v1",
    {
      p_action_id: input.actionId,
      p_actor_key: input.actorKey,
      p_action_type: input.actionType,
      p_grid_x: input.gridX ?? null,
      p_grid_y: input.gridY ?? null,
      p_plant_type: input.plantType ?? null,
      p_plant_ids: input.plantIds ?? null,
      p_result: input.result,
      p_guidance_zone: input.guidanceZone,
    },
  );
  if (error) throw error;
  return (data ?? null) as GardenStewardshipSummary | null;
}

export async function replaceGardenStewardshipTask(
  stewardId: string,
  assignmentId: string,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "replace_garden_task_v1",
    { p_steward_id: stewardId, p_assignment_id: assignmentId },
  );
  if (error) throw error;
  return data as GardenStewardshipSummary;
}

export async function acknowledgeGardenStewardshipNotification(
  stewardId: string,
  notificationId: string,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "acknowledge_garden_stewardship_notification_v1",
    { p_steward_id: stewardId, p_notification_id: notificationId },
  );
  if (error) throw error;
  return data as GardenStewardshipSummary;
}

