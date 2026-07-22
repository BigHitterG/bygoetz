const DEFAULT_BASIL_ORIGIN = "https://basilcommunitygarden.com";
const DEFAULT_BYGOETZ_ORIGIN = "https://www.bygoetz.com";

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getBasilOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_BASIL_URL) ?? DEFAULT_BASIL_ORIGIN;
}

export function getByGoetzOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_BYGOETZ_ORIGIN;
}

export function isBasilHostname(hostname: string | null | undefined) {
  if (!hostname) return false;
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  const configured = new URL(getBasilOrigin()).hostname.toLowerCase();
  return (
    normalized === configured ||
    normalized === "basilcommunitygarden.com" ||
    normalized === "www.basilcommunitygarden.com"
  );
}

export function getBasilUrl(path = "/") {
  return new URL(path, `${getBasilOrigin()}/`).toString();
}

export function getBasilGameUrlForOrigin(origin: string) {
  const normalized = normalizeOrigin(origin) ?? getBasilOrigin();
  const path = isBasilHostname(new URL(normalized).hostname) ? "/" : "/community-garden";
  return new URL(path, `${normalized}/`).toString();
}

function allowedProductionOrigins() {
  return new Set([
    getBasilOrigin(),
    getByGoetzOrigin(),
    DEFAULT_BASIL_ORIGIN,
    "https://www.basilcommunitygarden.com",
    DEFAULT_BYGOETZ_ORIGIN,
    "https://bygoetz.com",
  ]);
}

export function isAllowedBasilOrigin(value: string | null | undefined) {
  if (!value) return false;
  const origin = normalizeOrigin(value);
  if (!origin) return false;
  if (allowedProductionOrigins().has(origin)) return true;

  if (process.env.VERCEL_ENV !== "production") {
    if (
      origin === "http://localhost:3000" ||
      origin === "http://localhost:3010" ||
      origin === "http://127.0.0.1:3000" ||
      origin === "http://127.0.0.1:3010"
    ) {
      return true;
    }
    const vercelHost = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL;
    if (vercelHost && origin === normalizeOrigin(`https://${vercelHost}`)) return true;
  }

  return false;
}

export function hasAllowedBasilRequestOrigin(request: {
  headers: { get(name: string): string | null };
}) {
  const requestOrigin = request.headers.get("origin");
  return requestOrigin === null || isAllowedBasilOrigin(requestOrigin);
}
