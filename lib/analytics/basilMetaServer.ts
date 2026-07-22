import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import {
  buildBasilPurchaseConversion,
  getBasilCheckoutMetaEventId,
  getBasilPurchaseMetaEventId,
  isBasilMetaPurchaseEligible,
  type BasilLaunchAttribution,
} from "./basilMetaConversion";

export { getBasilCheckoutMetaEventId, getBasilPurchaseMetaEventId };

const GRAPH_VERSION_PATTERN = /^v\d{1,2}\.0$/;
function safeMetaErrorCode(body: unknown, status: number) {
  if (!body || typeof body !== "object") return `http_${status}`;
  const error = (body as { error?: { code?: unknown; error_subcode?: unknown } }).error;
  if (!error) return `http_${status}`;
  const code = typeof error.code === "number" ? error.code : status;
  const subcode = typeof error.error_subcode === "number" ? `_${error.error_subcode}` : "";
  return `meta_${code}${subcode}`;
}

async function finishDelivery(input: {
  eventId: string;
  success: boolean;
  responseStatus?: number | null;
  errorCode?: string | null;
}) {
  const { error } = await getSupabaseAdmin().rpc("finish_basil_meta_purchase_event", {
    p_event_id: input.eventId,
    p_success: input.success,
    p_response_status: input.responseStatus ?? null,
    p_error_code: input.errorCode ?? null,
  });
  if (error) {
    console.error("Basil Meta delivery ledger update failed", {
      eventId: input.eventId,
      message: error.message,
    });
  }
}

export async function sendBasilPurchaseConversion(input: {
  stripeSessionId: string;
  launchSessionId?: string | null;
  email: string;
  orderType?: string | null;
  paymentStatus?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}) {
  const eventId = getBasilPurchaseMetaEventId(input.stripeSessionId);
  if (!isBasilMetaPurchaseEligible(input)) {
    return { status: "ineligible" as const, eventId };
  }
  if (process.env.META_CONVERSIONS_API_ENABLED !== "true") {
    return { status: "disabled" as const, eventId };
  }

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN?.trim();
  if (!pixelId || !accessToken) {
    console.error("Basil Meta Conversions API is enabled but its server credentials are incomplete.");
    return { status: "misconfigured" as const, eventId };
  }

  const supabase = getSupabaseAdmin();
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_basil_meta_purchase_event",
    {
      p_event_id: eventId,
      p_stripe_session_id: input.stripeSessionId,
      p_launch_session_id: input.launchSessionId ?? null,
    },
  );
  if (claimError) throw claimError;
  if (!claimed) return { status: "duplicate" as const, eventId };

  try {
    let attribution: BasilLaunchAttribution | null = null;
    if (input.launchSessionId) {
      const { data } = await supabase
        .from("basil_launch_sessions")
        .select("first_arrival_at,meta_click_id")
        .eq("launch_session_id", input.launchSessionId)
        .maybeSingle();
      attribution = data as BasilLaunchAttribution | null;
    }

    const graphVersion = GRAPH_VERSION_PATTERN.test(
      process.env.META_GRAPH_API_VERSION ?? "",
    )
      ? process.env.META_GRAPH_API_VERSION!
      : "v25.0";
    const sourceUrl = getBasilUrl();
    const requestBody: Record<string, unknown> = {
      data: [
        buildBasilPurchaseConversion({
          eventId,
          eventTime: Math.floor(Date.now() / 1000),
          email: input.email,
          launchSessionId: input.launchSessionId,
          attribution,
          sourceUrl,
        }),
      ],
    };
    const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
    if (testEventCode) requestBody.test_event_code = testEventCode;

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(8_000),
      },
    );
    const body = (await response.json().catch(() => null)) as
      | { events_received?: number; error?: unknown }
      | null;
    const success = response.ok && body?.events_received === 1;
    await finishDelivery({
      eventId,
      success,
      responseStatus: response.status,
      errorCode: success ? null : safeMetaErrorCode(body, response.status),
    });
    if (!success) {
      console.error("Basil Meta Purchase delivery was not accepted", {
        eventId,
        status: response.status,
      });
      return { status: "failed" as const, eventId };
    }
    return { status: "sent" as const, eventId };
  } catch (error) {
    const errorCode = error instanceof DOMException && error.name === "TimeoutError"
      ? "network_timeout"
      : "network_error";
    await finishDelivery({ eventId, success: false, errorCode });
    console.error("Basil Meta Purchase delivery failed", {
      eventId,
      code: errorCode,
    });
    return { status: "failed" as const, eventId };
  }
}
