export function getFrameStableCameraEase(
  deltaSeconds: number,
  responsePerSecond = 7,
) {
  const safeDelta = Math.max(0, deltaSeconds);
  const safeResponse = Math.max(0, responsePerSecond);
  return 1 - Math.exp(-safeResponse * safeDelta);
}
