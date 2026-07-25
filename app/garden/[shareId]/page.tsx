import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPublicGardenShare } from "@/lib/communityGarden/shares";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import styles from "./share.module.css";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ shareId: string }>;
};

const getSharedGarden = cache(getPublicGardenShare);

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { shareId } = await params;
  const share = await getSharedGarden(shareId);
  if (!share) {
    return {
      title: "Garden no longer shared | Basil",
      robots: { index: false, follow: false },
    };
  }

  const title = "A garden grown in Basil";
  const description =
    share.scope === "whole"
      ? "See a whole My Garden created through care shared in the Basil Community Garden."
      : "See a favorite corner of a My Garden created in Basil.";
  return {
    title,
    description,
    alternates: { canonical: share.url },
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: share.url,
      images: [
        {
          url: share.imageUrl,
          width: share.width,
          height: share.height,
          alt: "A private garden shared from Basil Community Garden",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [share.imageUrl],
    },
  };
}

export default async function SharedGardenPage({ params }: SharePageProps) {
  const { shareId } = await params;
  const share = await getSharedGarden(shareId);
  if (!share) notFound();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.rose} aria-hidden="true" />
        <div>
          <strong>Basil</strong>
          <span>Community Garden</span>
        </div>
      </header>

      <section className={styles.card}>
        <p className={styles.kicker}>
          {share.scope === "whole" ? "A whole garden" : "A favorite garden view"}
        </p>
        <h1>Grown with care</h1>
        <Image
          className={styles.image}
          src={share.imageUrl}
          width={share.width}
          height={share.height}
          priority
          unoptimized
          alt="A My Garden snapshot shared from Basil"
        />
        <p>
          This is a read-only snapshot from someone&apos;s private My Garden.
          Their account and personal information are not shared.
        </p>
        <a className={styles.cta} href={getBasilUrl()}>
          Visit the Community Garden
        </a>
      </section>
    </main>
  );
}
