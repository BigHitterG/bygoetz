"use client";

import {
  BASIL_REPEATABLE_FUNNEL_EVENTS,
  type BasilFunnelEvent,
  type BasilFunnelMetadata,
} from "@/lib/communityGarden/funnelEvents";

const STORAGE_KEY = "basil-launch-session-v1";
const SESSION_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LaunchAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  metaClickId: string | null;
  referringDomain: string | null;
  originalLandingPath: string | null;
};

type LaunchSession = {
  version: 1;
  id: string;
  firstArrivalAt: string;
  expiresAt: string;
  attribution: LaunchAttribution;
  milestoneEventIds: Partial<Record<BasilFunnelEvent, string>>;
  pendingEvents: PendingLaunchEvent[];
};

type PendingLaunchEvent = {
  eventId: string;
  event: BasilFunnelEvent;
  metadata: BasilFunnelMetadata;
};

let flushPromise: Promise<void> | null = null;

function safeValue(value: string | null, maxLength: number) {
  if (!value) return null;
  const normalized = value.trim().slice(0, maxLength);
  if (!normalized || normalized.includes("@") || /[\u0000-\u001f]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function referringDomain() {
  if (!document.referrer) return null;
  try {
    return safeValue(new URL(document.referrer).hostname.toLowerCase(), 253);
  } catch {
    return null;
  }
}

function captureAttribution(): LaunchAttribution {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: safeValue(params.get("utm_source"), 120),
    utmMedium: safeValue(params.get("utm_medium"), 120),
    utmCampaign: safeValue(params.get("utm_campaign"), 160),
    utmContent: safeValue(params.get("utm_content"), 160),
    utmTerm: safeValue(params.get("utm_term"), 160),
    metaClickId: safeValue(params.get("fbclid"), 255),
    referringDomain: referringDomain(),
    originalLandingPath: safeValue(window.location.pathname, 300),
  };
}

function readSession(): LaunchSession | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
      | LaunchSession
      | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !UUID_PATTERN.test(parsed.id) ||
      !Number.isFinite(Date.parse(parsed.expiresAt)) ||
      Date.parse(parsed.expiresAt) <= Date.now()
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      ...parsed,
      milestoneEventIds: parsed.milestoneEventIds ?? {},
      pendingEvents: Array.isArray(parsed.pendingEvents)
        ? parsed.pendingEvents.slice(-24)
        : [],
    };
  } catch {
    return null;
  }
}

function writeSession(session: LaunchSession) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The server remains idempotent when storage is unavailable.
  }
}

export function getBasilLaunchSession() {
  const existing = readSession();
  if (existing) return existing;
  const now = new Date();
  const created: LaunchSession = {
    version: 1,
    id: crypto.randomUUID(),
    firstArrivalAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
    attribution: captureAttribution(),
    milestoneEventIds: {},
    pendingEvents: [],
  };
  writeSession(created);
  return created;
}

export function getBasilLaunchSessionId() {
  return getBasilLaunchSession().id;
}

function boundedMetadata(metadata?: BasilFunnelMetadata) {
  const result: BasilFunnelMetadata = {};
  if (metadata?.failure_stage) {
    result.failure_stage = safeValue(metadata.failure_stage, 80) ?? undefined;
  }
  if (metadata?.error_code) {
    result.error_code = safeValue(metadata.error_code, 80) ?? undefined;
  }
  return result;
}

export async function trackBasilFunnelEvent(
  event: BasilFunnelEvent,
  metadata?: BasilFunnelMetadata,
) {
  const session = getBasilLaunchSession();
  const repeatable = BASIL_REPEATABLE_FUNNEL_EVENTS.has(event);
  const eventId = repeatable
    ? crypto.randomUUID()
    : session.milestoneEventIds[event] ?? crypto.randomUUID();
  if (!repeatable && !session.milestoneEventIds[event]) {
    session.milestoneEventIds[event] = eventId;
  }
  if (!session.pendingEvents.some((pending) => pending.eventId === eventId)) {
    session.pendingEvents.push({
      eventId,
      event,
      metadata: boundedMetadata(metadata),
    });
    session.pendingEvents = session.pendingEvents.slice(-24);
  }
  writeSession(session);
  await flushBasilFunnelEvents();
}

export async function flushBasilFunnelEvents() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    while (true) {
      const session = getBasilLaunchSession();
      const pending = session.pendingEvents[0];
      if (!pending) return;
      try {
        const response = await fetch("/api/community-garden/funnel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventId: pending.eventId,
            launchSessionId: session.id,
            firstArrivalAt: session.firstArrivalAt,
            event: pending.event,
            attribution: session.attribution,
            metadata: pending.metadata,
          }),
          keepalive: true,
        });
        if (!response.ok && response.status !== 400 && response.status !== 403 && response.status !== 413) {
          return;
        }
        session.pendingEvents = session.pendingEvents.filter(
          (candidate) => candidate.eventId !== pending.eventId,
        );
        writeSession(session);
      } catch {
        return;
      }
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}
