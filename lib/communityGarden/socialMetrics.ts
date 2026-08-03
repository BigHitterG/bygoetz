import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type BasilSocialMetricWindow = "1h" | "24h" | "7d";

export type BasilSocialMetricSnapshot = {
  variantId: string;
  windowKey: BasilSocialMetricWindow;
  measuredAt?: string;
  impressions?: number;
  views?: number;
  engagedViews?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  tutorialStarts?: number;
  memberships?: number;
  watchSeconds?: number;
  choseToViewRate?: number | null;
  averagePercentageViewed?: number | null;
  completionRate?: number | null;
  replayRate?: number | null;
  profileActions?: number;
  gameStarts?: number;
  firstFlowersPlanted?: number;
  followerDelta?: number;
  raw?: Record<string, unknown>;
};

function nonnegative(value: number | undefined) {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Social metric counts must be finite and nonnegative.");
  }
  return value;
}

function optionalRate(value: number | null | undefined) {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Social metric rates must be finite and nonnegative.");
  }
  return value;
}

/**
 * Stores one comparable observation window. This is service-only and uses the
 * variant/window uniqueness key so a scheduled review updates an observation
 * instead of inflating the sample with duplicate rows.
 */
export async function recordBasilSocialMetricSnapshot(
  snapshot: BasilSocialMetricSnapshot,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("basil_social_metrics")
    .upsert({
      variant_id: snapshot.variantId,
      window_key: snapshot.windowKey,
      measured_at: snapshot.measuredAt ?? new Date().toISOString(),
      impressions: nonnegative(snapshot.impressions),
      views: nonnegative(snapshot.views),
      engaged_views: nonnegative(snapshot.engagedViews),
      reactions: nonnegative(snapshot.reactions),
      comments: nonnegative(snapshot.comments),
      shares: nonnegative(snapshot.shares),
      saves: nonnegative(snapshot.saves),
      clicks: nonnegative(snapshot.clicks),
      tutorial_starts: nonnegative(snapshot.tutorialStarts),
      memberships: nonnegative(snapshot.memberships),
      watch_seconds: nonnegative(snapshot.watchSeconds),
      chose_to_view_rate: optionalRate(snapshot.choseToViewRate),
      average_percentage_viewed: optionalRate(snapshot.averagePercentageViewed),
      completion_rate: optionalRate(snapshot.completionRate),
      replay_rate: optionalRate(snapshot.replayRate),
      profile_actions: nonnegative(snapshot.profileActions),
      game_starts: nonnegative(snapshot.gameStarts),
      first_flowers_planted: nonnegative(snapshot.firstFlowersPlanted),
      follower_delta: snapshot.followerDelta ?? 0,
      raw: snapshot.raw ?? {},
    }, { onConflict: "variant_id,window_key" })
    .select("id,variant_id,window_key,measured_at")
    .single();
  if (error) throw error;
  return data;
}
