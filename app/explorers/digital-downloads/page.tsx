import type { Metadata } from "next";
import { DigitalDownloadsPage } from "@/components/explorers/DigitalDownloadsPage";

export const metadata: Metadata = {
  title: "Digital Downloads | The Explorers Series",
  description:
    "Preview the complete Explorers Series digital download bundle with high-resolution artwork files for personal printing and decor projects.",
};

export default function Page() {
  return <DigitalDownloadsPage />;
}
