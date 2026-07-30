import type { Metadata } from "next";
import { SocialStudio } from "./SocialStudio";

export const metadata: Metadata = {
  title: "Basil Social Studio",
  description: "Private approval workspace for Basil's daily social stories.",
  robots: { index: false, follow: false, nocache: true },
};

export default function BasilSocialStudioPage() {
  return <SocialStudio />;
}
