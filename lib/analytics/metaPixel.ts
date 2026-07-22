type MetaPixelArguments = [
  command: string,
  eventName: string,
  parameters?: Record<string, unknown>,
  options?: { eventID?: string },
];

type PendingMetaEvent = {
  command: "track" | "trackCustom";
  eventName: string;
  parameters?: Record<string, unknown>;
  eventId?: string;
};

const SENT_EVENT_IDS_KEY = "basil-meta-sent-event-ids-v1";
const MAX_SENT_EVENT_IDS = 80;

declare global {
  interface Window {
    fbq?: (...args: MetaPixelArguments) => void;
    __basilPendingMetaEvents?: PendingMetaEvent[];
  }
}

function readSentEventIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const value = JSON.parse(window.localStorage.getItem(SENT_EVENT_IDS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((candidate): candidate is string => typeof candidate === "string").slice(-MAX_SENT_EVENT_IDS)
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
    // Meta still deduplicates the event ID if browser storage is unavailable.
  }
}

function dispatchMetaEvent(event: PendingMetaEvent) {
  if (typeof window === "undefined") return false;
  if (event.eventId && readSentEventIds().includes(event.eventId)) return true;
  if (typeof window.fbq !== "function") return false;
  window.fbq(
    event.command,
    event.eventName,
    event.parameters,
    event.eventId ? { eventID: event.eventId } : undefined,
  );
  markEventSent(event.eventId);
  return true;
}

function enqueueOrDispatch(event: PendingMetaEvent) {
  if (typeof window === "undefined") return;
  if (dispatchMetaEvent(event)) return;
  const queue = (window.__basilPendingMetaEvents ??= []);
  if (event.eventId && queue.some((candidate) => candidate.eventId === event.eventId)) return;
  queue.push(event);
  window.__basilPendingMetaEvents = queue.slice(-24);
}

export function flushMetaEventQueue() {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const pending = window.__basilPendingMetaEvents ?? [];
  window.__basilPendingMetaEvents = [];
  pending.forEach((event) => dispatchMetaEvent(event));
}

export function trackMetaEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
  eventId?: string,
) {
  enqueueOrDispatch({ command: "track", eventName, parameters, eventId });
}

export function trackMetaCustomEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
  eventId?: string,
) {
  enqueueOrDispatch({ command: "trackCustom", eventName, parameters, eventId });
}

