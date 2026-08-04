import type { Metadata } from "next";
import { SocialDiagramScene } from "./SocialDiagramScene";

export const metadata: Metadata = {
  title: "Basil Social Diagram",
  description: "Deterministic, game-accurate Basil social diagram.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BasilSocialDiagramPage({ searchParams }: { searchParams: Promise<{ concept?: string }> }) {
  const { concept } = await searchParams;
  return <SocialDiagramScene concept={concept === "trellis" ? "trellis" : "live-map"} />;
}

