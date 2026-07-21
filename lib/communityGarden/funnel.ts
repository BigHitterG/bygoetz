import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { GardenDeviceClass } from "./health";
import type { BasilFunnelEvent, BasilFunnelMetadata } from "./funnelEvents";

export type BasilLaunchAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  metaClickId: string | null;
  referringDomain: string | null;
  originalLandingPath: string | null;
};

export type BasilLaunchFunnel = {
  measuredAt: string;
  windowDays: number;
  retentionDays: number;
  uniqueSessions: number;
  steps: Array<{
    event: BasilFunnelEvent;
    label: string;
    sessions: number;
    conversionFromPrevious: number;
  }>;
  previewJourney: {
    softPaywallViews: number;
    softDeclines: number;
    continuedAfterDecline: number;
    hardPaywallViews: number;
    expiredPreviews: number;
  };
  devices: Array<{ device: GardenDeviceClass; sessions: number }>;
  attribution: Array<{
    source: string;
    medium: string;
    campaign: string;
    creative: string;
    sessions: number;
    purchases: number;
  }>;
  failures: {
    gardenActions: number;
    gardenRestorations: number;
    checkoutCanceled: number;
  };
};

export async function recordBasilFunnelEvent(input: {
  eventId?: string | null;
  launchSessionId: string;
  firstArrivalAt?: string | null;
  event: BasilFunnelEvent;
  deviceClass?: GardenDeviceClass;
  attribution?: BasilLaunchAttribution;
  metadata?: BasilFunnelMetadata;
  sourceKey?: string | null;
}) {
  const attribution = input.attribution;
  const { data, error } = await getSupabaseAdmin().rpc(
    "record_basil_funnel_event",
    {
      p_event_id: input.eventId ?? null,
      p_launch_session_id: input.launchSessionId,
      p_first_arrival_at: input.firstArrivalAt ?? null,
      p_event_name: input.event,
      p_device_class: input.deviceClass ?? "unknown",
      p_utm_source: attribution?.utmSource ?? null,
      p_utm_medium: attribution?.utmMedium ?? null,
      p_utm_campaign: attribution?.utmCampaign ?? null,
      p_utm_content: attribution?.utmContent ?? null,
      p_utm_term: attribution?.utmTerm ?? null,
      p_meta_click_id: attribution?.metaClickId ?? null,
      p_referring_domain: attribution?.referringDomain ?? null,
      p_original_landing_path: attribution?.originalLandingPath ?? null,
      p_metadata: input.metadata ?? {},
      p_source_key: input.sourceKey ?? null,
    },
  );
  if (error) throw error;
  return data === true;
}

export async function getBasilLaunchFunnelAdmin() {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_basil_launch_funnel_admin",
  );
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("The Basil launch funnel was unavailable.");
  }
  return data as BasilLaunchFunnel;
}
