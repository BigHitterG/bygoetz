export function choosePlantingSuggestion<T>(
  candidates: readonly T[],
  randomValue = Math.random(),
): T | null {
  if (candidates.length === 0) return null;
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;
  return candidates[Math.floor(normalizedRandom * candidates.length)] ?? null;
}
