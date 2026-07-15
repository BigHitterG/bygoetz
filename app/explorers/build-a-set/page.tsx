import type { Metadata } from "next";
import { BuildASetPage } from "@/components/explorers/build-a-set/BuildASetPage";
import { isExplorerSetCheckoutConfigured } from "@/lib/explorers/buildASetStripe";

export const metadata: Metadata = {
  title: "Design Your Own Explorers Gallery Wall | Goetz",
  description:
    "Choose one Explorer or build a set of three. Preview print size, mat, frame color, and true room scale before checkout.",
  icons: {
    icon: [{ url: "/explorers/build-a-set/icon", type: "image/png" }],
    apple: [{ url: "/explorers/build-a-set/icon", type: "image/png" }],
  },
  openGraph: {
    title: "Design Your Own Explorers Gallery Wall | Goetz",
    description:
      "Choose one Explorer or build a set of three, then preview your gallery in a thoughtfully styled room.",
    type: "website",
    url: "/explorers/build-a-set",
    images: [
      {
        url: "/explorers/build-a-set/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Three Goetz Explorers prints displayed above a warm reading nook",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Design Your Own Explorers Gallery Wall | Goetz",
    description:
      "Choose one Explorer or build a set of three, then preview your gallery in a thoughtfully styled room.",
    images: ["/explorers/build-a-set/opengraph-image"],
  },
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

