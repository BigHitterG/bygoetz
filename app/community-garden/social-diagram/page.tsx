
import type { Metadata } from "next";
import { SocialDiagramScene } from "./SocialDiagramScene";

export const metadata: Metadata = {
  title: "Basil Social Diagram",
  description: "Deterministic, game-accurate Basil social diagram.",
  robots: { index: false, follow: false, nocache: true },
};

export default function BasilSocialDiagramPage() {
  return <SocialDiagramScene />;
}

