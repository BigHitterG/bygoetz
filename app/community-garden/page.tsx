import type { Metadata } from "next";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import { CommunityGardenApp } from "./components/CommunityGardenApp";

export const metadata: Metadata = {
  alternates: { canonical: getBasilUrl() },
};

export default function CommunityGardenPage() {
  return <CommunityGardenApp />;
}

