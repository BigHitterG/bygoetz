import type { Metadata } from "next";
import { BuildASetPage } from "@/components/explorers/build-a-set/BuildASetPage";
import { isExplorerSetCheckoutConfigured } from "@/lib/explorers/buildASetStripe";

export const metadata: Metadata = {
  title: "Build Your Own Explorers Print Set | Goetz",
  description:
    "Choose any three Explorers artworks and build a coordinated physical print set for a nursery, playroom, reading nook, or creative room.",
};

export default function Page() {
  return <BuildASetPage checkoutConfigured={isExplorerSetCheckoutConfigured()} />;
}

