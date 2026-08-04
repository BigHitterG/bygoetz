"use client";

type PendingExplorersMetaEvent = {
  command: "trackSingle" | "trackSingleCustom";
  eventName: string;
  parameters?: Record<string, unknown>;
  eventId?: string;
};

type ExplorersMetaWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  __explorersPendingMetaEvents?: PendingExplorersMetaEvent[];
};

const SENT_EVENT_IDS_KEY = "explorers-meta-sent-event-ids-v1";
const MAX_SENT_EVENT_IDS = 80;

function getConfiguration() {
  return {
    enabled: process.env.NEXT_PUBLIC_EXPLORERS_META_TRACKING_ENABLED === "true",
    pixelId: process.env.NEXT_PUBLIC_EXPLORERS_META_PIXEL_ID?.trim() ?? "",
  };
}

function getMetaWindow() {
  return window as ExplorersMetaWindow;
}

function readSentEventIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(window.localStorage.getItem(SENT_EVENT_IDS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter((candidate): candidate is string => typeof candidate === "string")
          .slice(-MAX_SENT_EVENT_IDS)
      : [];
  } catch {
    return [];
  }
}

function markEventSent(eventId?: string) {
  if (!eventId || typeof window === "undefined") return;
  const ids = readSentEventIds();
  if (ids.includes(eventId)) return;
  try {
    window.localStorage.setItem(
      SENT_EVENT_IDS_KEY,
      JSON.stringify([...ids, eventId].slice(-MAX_SENT_EVENT_IDS)),
    );
  } catch {
    // Meta can still deduplicate the shared event ID when storage is unavailable.
  }
}

function dispatchExplorersMetaEvent(event: PendingExplorersMetaEvent) {
  if (typeof window === "undefined") return false;
  const { enabled, pixelId } = getConfiguration();
  if (!enabled || !pixelId) return false;
  if (event.eventId && readSentEventIds().includes(event.eventId)) return true;

  const fbq = getMetaWindow().fbq;
  if (typeof fbq !== "function") return false;
  fbq(
    event.command,
    pixelId,
    event.eventName,
    event.parameters,
    event.eventId ? { eventID: event.eventId } : undefined,
  );
  markEventSent(event.eventId);
  return true;
}

function enqueueOrDispatch(event: PendingExplorersMetaEvent) {
  if (typeof window === "undefined") return false;
  const { enabled, pixelId } = getConfiguration();
  if (!enabled || !pixelId) return false;
  if (dispatchExplorersMetaEvent(event)) return true;

  const metaWindow = getMetaWindow();
  const queue = (metaWindow.__explorersPendingMetaEvents ??= []);
  if (event.eventId && queue.some((candidate) => candidate.eventId === event.eventId)) {
    return true;
  }
  queue.push(event);
  metaWindow.__explorersPendingMetaEvents = queue.slice(-24);
  return true;
}

export function flushExplorersMetaEventQueue() {
  if (typeof window === "undefined") return;
  const metaWindow = getMetaWindow();
  if (typeof metaWindow.fbq !== "function") return;
  const pending = metaWindow.__explorersPendingMetaEvents ?? [];
  metaWindow.__explorersPendingMetaEvents = [];
  pending.forEach((event) => dispatchExplorersMetaEvent(event));
}

export function trackExplorersMetaEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
  eventId?: string,
) {
  return enqueueOrDispatch({
    command: "trackSingle",
    eventName,
    parameters,
    eventId,
  });
}

export function trackExplorersMetaCustomEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
  eventId?: string,
) {
  return enqueueOrDispatch({
    command: "trackSingleCustom",
    eventName,
    parameters,
    eventId,
  });
}
