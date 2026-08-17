import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtCatalogHeader } from "../../_components/ArtCatalogHeader";
import { artworks } from "@/lib/art/catalog";
import { getArtMedia, getArtwork } from "@/lib/art/selectors";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "../../catalog.module.css";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return artworks.map((artwork) => ({ slug: artwork.slug }));
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artwork = getArtwork(slug);

  if (!artwork) {
    return { title: "Artwork Not Found | Thomas Goetz" };
  }

  const media = getArtMedia(artwork.primaryMediaId);

  return {
    title: `${artwork.title} | Thomas Goetz`,
    description: artwork.summary,
    alternates: { canonical: `/art/works/${artwork.slug}` },
    openGraph: {
      title: `${artwork.title} | Thomas Goetz`,
      description: artwork.summary,
      type: "website",
      url: `/art/works/${artwork.slug}`,
      images: media
        ? [{ url: media.src, width: media.width, height: media.height, alt: media.alt }]
        : undefined,
    },
  };
}

function formatDimensions(width: number, height: number, unit: "in" | "cm") {
  return `${width} × ${height} ${unit}.`;
}

export default async function ArtworkPage({ params }: ArtworkPageProps) {
  const { slug } = await params;
  const artwork = getArtwork(slug);

  if (!artwork) notFound();

  const media = getArtMedia(artwork.primaryMediaId);
  if (!media) notFound();

  const subject = encodeURIComponent(`${artwork.title} artwork inquiry`);

  return (
    <div className={styles.subpage}>
      <ArtCatalogHeader />
      <main className={styles.catalogMain}>
        <section className={styles.workHero}>
          <figure className={styles.workImage}>
            <Image
              src={withSiteBasePath(media.src)}
              alt={media.alt}
              width={media.width}
              height={media.height}
              priority
              sizes="(max-width: 720px) 100vw, 58vw"
            />
            {media.caption ? <figcaption className={styles.mediaCaption}>{media.caption}</figcaption> : null}
          </figure>

          <div className={styles.workCopy}>
            <Link className={styles.breadcrumb} href="/art#works">
              ← Selected work
            </Link>
            <p className={styles.pageEyebrow}>Individual work</p>
            <h1>{artwork.title}</h1>
            <p className={styles.workSummary}>{artwork.summary}</p>
            <dl className={styles.facts}>
              <div>
                <dt>Medium</dt>
                <dd>{artwork.medium}</dd>
              </div>
              {artwork.dimensions?.artwork ? (
                <div>
                  <dt>Artwork</dt>
                  <dd>
                    {formatDimensions(
                      artwork.dimensions.artwork.width,
                      artwork.dimensions.artwork.height,
                      artwork.dimensions.artwork.unit,
                    )}
                  </dd>
                </div>
              ) : null}
              {artwork.dimensions?.framed ? (
                <div>
                  <dt>Framed</dt>
                  <dd>
                    {formatDimensions(
                      artwork.dimensions.framed.width,
                      artwork.dimensions.framed.height,
                      artwork.dimensions.framed.unit,
                    )}
                  </dd>
                </div>
              ) : null}
              {artwork.framing ? (
                <div>
                  <dt>Presentation</dt>
                  <dd>
                    {artwork.framing.matted ? "Matted" : "Unmatted"}
                    {artwork.framing.glazing === "glass" ? " under glass" : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        <section className={styles.inquiry} aria-labelledby="artwork-inquiry">
          <h2 id="artwork-inquiry">Ask about this work.</h2>
          <div>
            <p>
              Request current availability, price, shipping information, or a studio appointment.
              The inquiry will identify this artwork automatically.
            </p>
            <a href={`mailto:info@bygoetz.com?subject=${subject}`}>
              Inquire about {artwork.title} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <nav className={styles.footerNav} aria-label="Art page links">
          <Link href="/art#works">Selected work</Link>
          <Link href="/art#available">Available work</Link>
          <Link href="/art#contact">Contact</Link>
        </nav>
      </main>
    </div>
  );
}
