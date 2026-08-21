import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { artPrints, getArtPrint, getArtPrintImage } from "@/lib/art/prints";
import { PrintDetail } from "./PrintDetail";

type ArtPrintPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return artPrints.map((print) => ({ slug: print.slug }));
}

export async function generateMetadata({ params }: ArtPrintPageProps): Promise<Metadata> {
  const { slug } = await params;
  const print = getArtPrint(slug);

  if (!print) return { title: "Print Not Found | Thomas Goetz" };

  const artwork = getArtPrintImage(print, "artwork");
  const title = `${print.title} — 8 × 8 Art Print | Thomas Goetz`;

  return {
    title,
    description: `${print.summary} Available as an open-edition 8 × 8 inch print for $45.`,
    alternates: { canonical: print.canonicalPath },
    openGraph: {
      title,
      description: print.summary,
      type: "website",
      url: print.canonicalPath,
      siteName: "By Goetz",
      images: artwork
        ? [{ url: artwork.src, width: artwork.width, height: artwork.height, alt: artwork.alt }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: print.summary,
      images: artwork ? [artwork.src] : undefined,
    },
  };
}

export default async function ArtPrintPage({ params }: ArtPrintPageProps) {
  const { slug } = await params;
  const print = getArtPrint(slug);

  if (!print) notFound();

  return <PrintDetail print={print} />;
}
