type MetaPixelArguments = [command: string, eventName: string, parameters?: Record<string, unknown>];

declare global {
  interface Window {
    fbq?: (...args: MetaPixelArguments) => void;
  }
}

export function trackMetaEvent(eventName: string, parameters?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, parameters);
  }
}

export function trackMetaCustomEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", eventName, parameters);
  }
}

