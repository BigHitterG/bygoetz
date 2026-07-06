import type { Metadata } from "next";
import { ExplorersPage } from "@/components/explorers/ExplorersPage";

export const metadata: Metadata = {
  title: "The Explorers Series | Modern Geometric Animal Prints",
  description:
    "Museum-quality geometric animal prints and framed prints for nurseries, playrooms, reading corners, and creative homes.",
  openGraph: {
    title: "The Explorers Series | Modern Geometric Animal Prints",
    description:
      "Museum-quality geometric animal prints and framed prints for nurseries, playrooms, reading corners, and creative homes.",
    type: "website",
  },
};

export default function Page() {
  return <ExplorersPage />;
}
