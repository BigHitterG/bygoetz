export const BASIL_FUNNEL_EVENTS = [
  "session_started",
  "garden_loaded",
  "inventory_opened",
  "plant_selected",
  "first_community_plant",
  "third_community_plant",
  "my_garden_entered",
  "first_personal_plant",
  "preview_limit_reached",
  "paywall_viewed",
  "soft_paywall_viewed",
  "soft_paywall_declined",
  "preview_continued",
  "hard_paywall_viewed",
  "preview_expired",
  "signup_started",
  "verification_sent",
  "verification_completed",
  "checkout_started",
  "checkout_canceled",
  "purchase_completed",
  "garden_restoration_failed",
  "garden_action_failed",
] as const;

export type BasilFunnelEvent = (typeof BASIL_FUNNEL_EVENTS)[number];

export const BASIL_REPEATABLE_FUNNEL_EVENTS = new Set<BasilFunnelEvent>([
  "garden_restoration_failed",
  "garden_action_failed",
]);

export const BASIL_FUNNEL_METADATA_KEYS = ["failure_stage", "error_code"] as const;

export type BasilFunnelMetadata = Partial<
  Record<(typeof BASIL_FUNNEL_METADATA_KEYS)[number], string>
>;
