import type { Metadata } from "next";
import { SocialCaptureScene } from "./SocialCaptureScene";
import { AgentCaptureScene } from "./AgentCaptureScene";

export const metadata: Metadata = {
  title: "Basil Social Capture",
  description: "Deterministic, non-interactive Basil gameplay capture scene.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BasilSocialCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string; captureMode?: string }>;
}) {
  const { scene = "watering-how-to", captureMode } = await searchParams;
  if (captureMode === "live_gameplay") {
    return <AgentCaptureScene scene={scene} />;
  }
  return <SocialCaptureScene scene={scene} />;
}
