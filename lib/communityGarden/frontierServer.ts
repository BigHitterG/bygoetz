import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function evaluateCommunityGardenFrontier(
  evaluationDate?: string,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "evaluate_community_garden_frontier_v1",
    {
      p_evaluation_date: evaluationDate ?? null,
    },
  );
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("The frontier evaluation did not return a result.");
  }
  return data as Record<string, unknown>;
}
