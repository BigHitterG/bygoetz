import type { Metadata } from "next";
import { SocialCaptureScene } from "./SocialCaptureScene";

export const metadata: Metadata = {
  title: "Basil Social Capture",
  description: "Deterministic, non-interactive Basil gameplay capture scene.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BasilSocialCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string }>;
}) {
  const { scene = "water-chain" } = await searchParams;
  return <SocialCaptureScene scene={scene} />;
}
