import type { Metadata } from "next";
import { SocialDailyUpdateScene } from "./SocialDailyUpdateScene";

export const metadata: Metadata = {
  title: "Basil Daily Garden Update",
  description: "Private 4:5 render surface for Basil's verified daily garden statistics.",
  robots: { index: false, follow: false, nocache: true },
};

export default function BasilSocialDailyUpdatePage() {
  return <SocialDailyUpdateScene />;
}
