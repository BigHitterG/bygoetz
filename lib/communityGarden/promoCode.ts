import { createHash } from "node:crypto";

const PROMO_CODE_PATTERN = /^[a-z0-9]{4,32}$/;

export function normalizeGardenPromoCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PROMO_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function hashGardenPromoCode(normalizedCode: string) {
  return createHash("sha256").update(normalizedCode).digest("hex");
}
