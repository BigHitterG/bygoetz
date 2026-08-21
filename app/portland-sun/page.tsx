import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetail } from "@/app/art/prints/[slug]/PrintDetail";
import { getArtPrint, getArtPrintImage } from "@/lib/art/prints";

const print = getArtPrint("portland-sun");
const artwork = print ? getArtPrintImage(print, "artwork") : undefined;

export const metadata: Metadata = {
  title: "Portland Sun — 8 × 8 Art Print | Thomas Goetz",
  description:
    "Portland Sun by Thomas Raymond Goetz, available as an open-edition 8 × 8 inch print for $45.",
  alternates: { canonical: "/art/prints/portland-sun" },
  openGraph: {
    title: "Portland Sun — 8 × 8 Art Print | Thomas Goetz",
    description: print?.summary,
    type: "website",
    url: "/art/prints/portland-sun",
    siteName: "By Goetz",
    images: artwork
      ? [{ url: artwork.src, width: artwork.width, height: artwork.height, alt: artwork.alt }]
      : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: "Portland Sun — 8 × 8 Art Print | Thomas Goetz",
    description: print?.summary,
    images: artwork ? [artwork.src] : undefined,
  },
};

export default function PortlandSunPage() {
  if (!print) notFound();
  return <PrintDetail print={print} />;
}
