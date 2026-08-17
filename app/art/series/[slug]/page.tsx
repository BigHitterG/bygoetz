import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtCatalogHeader } from "../../_components/ArtCatalogHeader";
import { artSeries } from "@/lib/art/catalog";
import { getArtSeries, getMediaForTarget } from "@/lib/art/selectors";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "../../catalog.module.css";

type SeriesPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return artSeries.map((series) => ({ slug: series.slug }));
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const series = getArtSeries(slug);

  if (!series) {
    return { title: "Body of Work Not Found | Thomas Goetz" };
  }

  const media = getMediaForTarget({ kind: "series", id: series.id });
  const cover = media[0];

  return {
    title: `${series.title} | Thomas Goetz`,
    description: series.summary,
    alternates: { canonical: `/art/series/${series.slug}` },
    openGraph: {
      title: `${series.title} | Thomas Goetz`,
      description: series.summary,
      type: "website",
      url: `/art/series/${series.slug}`,
      images: cover
        ? [{ url: cover.src, width: cover.width, height: cover.height, alt: cover.alt }]
        : undefined,
    },
  };
}

export default async function ArtSeriesPage({ params }: SeriesPageProps) {
  const { slug } = await params;
  const series = getArtSeries(slug);

  if (!series) notFound();

  const media = getMediaForTarget({ kind: "series", id: series.id });
  const subject = encodeURIComponent(`${series.title} inquiry`);

  return (
    <div className={styles.subpage}>
      <ArtCatalogHeader />
      <main className={styles.catalogMain}>
        <section className={styles.pageHero}>
          <p className={styles.pageEyebrow}>Body of work</p>
          <div>
            <Link className={styles.breadcrumb} href="/art#works">
              ← Selected work
            </Link>
            <h1>{series.title}</h1>
          </div>
          <p>{series.summary}</p>
        </section>

        <section className={styles.seriesMediaGrid} aria-label={`${series.title} images`}>
          {media.map((item) => (
            <figure key={item.id}>
              <Image
                src={withSiteBasePath(item.src)}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width: 720px) 100vw, (max-width: 1100px) 58vw, 48vw"
              />
              {item.caption ? <figcaption className={styles.mediaCaption}>{item.caption}</figcaption> : null}
            </figure>
          ))}
        </section>

        <section className={styles.seriesStatement} aria-labelledby="series-statement">
          <p className={styles.pageEyebrow}>Practice note</p>
          <h2 id="series-statement">One visual idea, seen through multiple works.</h2>
          <p>{series.statement}</p>
        </section>

        <section className={styles.inquiry} aria-labelledby="series-inquiry">
          <h2 id="series-inquiry">Continue the conversation.</h2>
          <div>
            <p>
              Ask about individual works, scale, installation, current availability,
              or viewing the body of work in the studio.
            </p>
            <a href={`mailto:info@bygoetz.com?subject=${subject}`}>
              Ask about {series.title} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <nav className={styles.footerNav} aria-label="Art page links">
          <Link href="/art#works">Selected work</Link>
          <Link href="/art#portfolio">Gallery materials</Link>
          <Link href="/art#contact">Contact</Link>
        </nav>
      </main>
    </div>
  );
}
