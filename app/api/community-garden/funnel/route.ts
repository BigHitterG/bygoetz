import { NextRequest, NextResponse } from "next/server";
import {
  BASIL_FUNNEL_EVENTS,
  BASIL_FUNNEL_METADATA_KEYS,
  type BasilFunnelEvent,
  type BasilFunnelMetadata,
} from "@/lib/communityGarden/funnelEvents";
import {
  recordBasilFunnelEvent,
  type BasilLaunchAttribution,
} from "@/lib/communityGarden/funnel";
import {
  getGardenDeviceClass,
  getGardenErrorCode,
  logGardenServerEvent,
} from "@/lib/communityGarden/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_NAMES = new Set<string>(BASIL_FUNNEL_EVENTS);
const METADATA_KEYS = new Set<string>(BASIL_FUNNEL_METADATA_KEYS);

function safeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    normalized.includes("@") ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function parseAttribution(value: unknown): BasilLaunchAttribution {
  const input = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
  const metaClickId = safeString(input.metaClickId, 255);
  return {
    utmSource: safeString(input.utmSource, 120),
    utmMedium: safeString(input.utmMedium, 120),
    utmCampaign: safeString(input.utmCampaign, 160),
    utmContent: safeString(input.utmContent, 160),
    utmTerm: safeString(input.utmTerm, 160),
    metaClickId:
      metaClickId && /^[A-Za-z0-9._-]+$/.test(metaClickId)
        ? metaClickId
        : null,
    referringDomain: safeString(input.referringDomain, 253),
    originalLandingPath: safeString(input.originalLandingPath, 300),
  };
}

function parseMetadata(value: unknown): BasilFunnelMetadata | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !METADATA_KEYS.has(key))) return null;
  const metadata: BasilFunnelMetadata = {};
  for (const key of BASIL_FUNNEL_METADATA_KEYS) {
    if (input[key] === undefined) continue;
    const safe = safeString(input[key], 80);
    if (!safe) return null;
    metadata[key] = safe;
  }
  return metadata;
}

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const productionOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (
    requestOrigin &&
    requestOrigin !== request.nextUrl.origin &&
    requestOrigin !== productionOrigin
  ) {
    return NextResponse.json({ error: "Invalid funnel origin." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) {
    return NextResponse.json({ error: "Funnel event was too large." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid funnel event." }, { status: 400 });
  }

  const event = typeof body.event === "string" && EVENT_NAMES.has(body.event)
    ? (body.event as BasilFunnelEvent)
    : null;
  const eventId = typeof body.eventId === "string" && UUID_PATTERN.test(body.eventId)
    ? body.eventId
    : null;
  const launchSessionId =
    typeof body.launchSessionId === "string" && UUID_PATTERN.test(body.launchSessionId)
      ? body.launchSessionId
      : null;
  const metadata = parseMetadata(body.metadata);
  const firstArrivalAt =
    typeof body.firstArrivalAt === "string" &&
    Number.isFinite(Date.parse(body.firstArrivalAt))
      ? new Date(body.firstArrivalAt).toISOString()
      : null;
  if (!event || !eventId || !launchSessionId || !firstArrivalAt || metadata === null) {
    return NextResponse.json({ error: "Invalid funnel event." }, { status: 400 });
  }

  try {
    const recorded = await recordBasilFunnelEvent({
      eventId,
      launchSessionId,
      firstArrivalAt,
      event,
      deviceClass: getGardenDeviceClass(request.headers.get("user-agent")),
      attribution: parseAttribution(body.attribution),
      metadata,
    });
    const response = NextResponse.json({ recorded });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const errorCode = getGardenErrorCode(error);
    logGardenServerEvent("error", "launch_funnel_record_failed", {
      event,
      errorCode,
    });
    const rateLimited = errorCode === "rate_limited" ||
      (error instanceof Error && error.message.toLowerCase().includes("rate limit"));
    return NextResponse.json(
      { error: rateLimited ? "Too many funnel events." : "Funnel event was not recorded." },
      { status: rateLimited ? 429 : 503 },
    );
  }
}
