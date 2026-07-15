import type { Metadata } from "next";
import { BuildASetPage } from "@/components/explorers/build-a-set/BuildASetPage";
import { isExplorerSetCheckoutConfigured } from "@/lib/explorers/buildASetStripe";

export const metadata: Metadata = {
  title: "Design Your Own Explorers Gallery Wall | Goetz",
  description:
    "Choose one Explorer or build a set of three. Preview print size, mat, frame color, and true room scale before checkout.",
};

type PageProps = {
  searchParams: Promise<{ artwork?: string; quantity?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialArtworkSlug =
    params.quantity === "1" ? params.artwork : undefined;

  return (
    <BuildASetPage
      checkoutConfigured={isExplorerSetCheckoutConfigured()}
      initialArtworkSlug={initialArtworkSlug}
    />
  );
}

