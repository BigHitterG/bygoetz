import "server-only";

import {
  buildExplorersInitiateCheckoutConversion,
  buildExplorersPurchaseConversion,
  getExplorersCheckoutMetaEventId,
  getExplorersPurchaseMetaEventId,
} from "./explorersMetaConversion";

export { getExplorersCheckoutMetaEventId, getExplorersPurchaseMetaEventId };

const GRAPH_VERSION_PATTERN = /^v\d{1,2}\.0$/;

type SendResult = {
  status: "disabled" | "misconfigured" | "sent" | "failed";
  eventId: string;
};

type ExplorerOrderInput = {
  stripeSessionId: string;
  sourceUrl: string;
  value: number;
  currency: string;
  artworkSlugs: string[];
  optionId: string;
  frameColor: string;
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

async function sendConversion(
  eventId: string,
  conversion: Record<string, unknown>,
): Promise<SendResult> {
  if (process.env.EXPLORERS_META_CONVERSIONS_API_ENABLED !== "true") {
    return { status: "disabled", eventId };
  }

  const pixelId = process.env.NEXT_PUBLIC_EXPLORERS_META_PIXEL_ID?.trim();
  const accessToken = process.env.EXPLORERS_META_CONVERSIONS_API_TOKEN?.trim();
  if (!pixelId || !accessToken) {
    console.error(
      "Explorers Meta Conversions API is enabled but its dedicated credentials are incomplete.",
    );
    return { status: "misconfigured", eventId };
  }

  const graphVersion = GRAPH_VERSION_PATTERN.test(
    process.env.EXPLORERS_META_GRAPH_API_VERSION ?? "",
  )
    ? process.env.EXPLORERS_META_GRAPH_API_VERSION!
    : "v25.0";
  const requestBody: Record<string, unknown> = { data: [conversion] };
  const testEventCode = process.env.EXPLORERS_META_TEST_EVENT_CODE?.trim();
  if (testEventCode) requestBody.test_event_code = testEventCode;

  try {
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
      | { events_received?: number }
      | null;
    if (response.ok && body?.events_received === 1) {
      return { status: "sent", eventId };
    }
    console.error("Explorers Meta conversion was not accepted", {
      eventId,
      status: response.status,
    });
    return { status: "failed", eventId };
  } catch (error) {
    console.error("Explorers Meta conversion delivery failed", {
      eventId,
      code:
        error instanceof DOMException && error.name === "TimeoutError"
          ? "network_timeout"
          : "network_error",
    });
    return { status: "failed", eventId };
  }
}

export async function sendExplorersInitiateCheckoutConversion(
  input: ExplorerOrderInput,
) {
  const eventId = getExplorersCheckoutMetaEventId(input.stripeSessionId);
  const conversion = buildExplorersInitiateCheckoutConversion({
    ...input,
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
  });
  return sendConversion(eventId, conversion);
}

export async function sendExplorersPurchaseConversion(input: ExplorerOrderInput) {
  const eventId = getExplorersPurchaseMetaEventId(input.stripeSessionId);
  const conversion = buildExplorersPurchaseConversion({
    ...input,
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
  });
  return sendConversion(eventId, conversion);
}
