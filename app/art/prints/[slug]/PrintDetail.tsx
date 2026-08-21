import Image from "next/image";
import Link from "next/link";
import { ArtCatalogHeader } from "../../_components/ArtCatalogHeader";
import {
  formatArtPrintPrice,
  getArtPrintImage,
  type ArtPrintCatalogItem,
} from "@/lib/art/prints";
import { withSiteBasePath } from "@/lib/sitePath";
import { CheckoutButton } from "./CheckoutButton";
import { CheckoutStatus } from "./CheckoutStatus";
import styles from "./page.module.css";

type PrintDetailProps = {
  print: ArtPrintCatalogItem;
};

const siteUrl = "https://www.bygoetz.com";

export function PrintDetail({ print }: PrintDetailProps) {
  const artwork = getArtPrintImage(print, "artwork");
  const context = getArtPrintImage(print, "context");
  const wallMockup = getArtPrintImage(print, "wall-mockup");
  const deskMockup = getArtPrintImage(print, "desk-mockup");
  const price = formatArtPrintPrice(print.unitAmount, print.currency);
  const dimensions = `${print.dimensions.width} × ${print.dimensions.height} ${print.dimensions.unit}.`;
  const available = print.availability === "available";
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: print.title,
    description: print.summary,
    image: artwork ? `${siteUrl}${artwork.src}` : undefined,
    brand: { "@type": "Brand", name: "By Goetz" },
    creator: { "@type": "Person", name: print.artist },
    material: print.medium,
    size: dimensions,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}${print.canonicalPath}`,
      priceCurrency: print.currency.toUpperCase(),
      price: (print.unitAmount / 100).toFixed(2),
      availability: available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (!artwork) return null;

  return (
    <div className={styles.productShell}>
      <ArtCatalogHeader />
      <main>
        <CheckoutStatus slug={print.slug} />
        <section className={styles.hero} aria-labelledby="print-title">
          <figure className={styles.artworkFigure}>
            <div className={styles.artworkFrame}>
              <Image
                src={withSiteBasePath(artwork.src)}
                alt={artwork.alt}
                width={artwork.width}
                height={artwork.height}
                priority
                sizes="(max-width: 760px) 100vw, 58vw"
              />
            </div>
            <figcaption>Artwork shown in full · square format</figcaption>
          </figure>

          <div className={styles.heroCopy}>
            <Link className={styles.breadcrumb} href="/art#available">
              ← Available work
            </Link>
            <p className={styles.eyebrow}>New print · Available now</p>
            <h1 id="print-title">{print.title}</h1>
            <p className={styles.byline}>
              {print.artist}, {print.year}
            </p>
            <p className={styles.summary}>{print.summary}</p>

            <div className={styles.priceRow}>
              <strong>{price}</strong>
              <span>{dimensions} print</span>
            </div>

            <dl className={styles.facts}>
              <div>
                <dt>Format</dt>
                <dd>{dimensions} art print</dd>
              </div>
              <div>
                <dt>Edition</dt>
                <dd>{print.edition.label}</dd>
              </div>
              <div>
                <dt>Presentation</dt>
                <dd>{print.presentation.label}</dd>
              </div>
              <div>
                <dt>Original</dt>
                <dd>{print.medium}</dd>
              </div>
            </dl>

            <div className={styles.checkout}>
              <CheckoutButton
                slug={print.slug}
                available={available}
                label={`Buy the 8 × 8 print · ${price}`}
              />
              <p>
                Secure checkout through Stripe. $8 US standard shipping; tax is
                calculated at checkout.
              </p>
            </div>
          </div>
        </section>

        {context ? (
          <section className={styles.origin} aria-labelledby="origin-title">
            <figure>
              <Image
                src={withSiteBasePath(context.src)}
                alt={context.alt}
                width={context.width}
                height={context.height}
                sizes="(max-width: 760px) 100vw, 56vw"
              />
              {context.caption ? <figcaption>{context.caption}</figcaption> : null}
            </figure>
            <div>
              <p className={styles.eyebrow}>Origin / in the hand</p>
              <h2 id="origin-title">The image began small and immediate.</h2>
              <p>{print.story}</p>
              <p>
                The context photograph is part of the work&apos;s record: the image on
                the device, held at human scale, before it becomes a physical print.
              </p>
            </div>
          </section>
        ) : null}

        {wallMockup && deskMockup ? (
          <section className={styles.scaleSection} aria-labelledby="scale-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Scale / 8 inches square</p>
              <h2 id="scale-title">A small print with a full horizon.</h2>
              <p>
                These visualizations show the footprint of an 8 × 8 inch print. The
                artwork is sold unframed, so the final presentation remains yours.
              </p>
            </div>
            <div className={styles.mockupGrid}>
              {[wallMockup, deskMockup].map((image) => (
                <figure key={image.role}>
                  <div>
                    <Image
                      src={withSiteBasePath(image.src)}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      sizes="(max-width: 760px) 100vw, 50vw"
                    />
                  </div>
                  {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div>
            <p className={styles.eyebrow}>Portland Sun / 2026</p>
            <h2 id="final-cta-title">Bring the horizon home.</h2>
          </div>
          <div className={styles.finalPurchase}>
            <p>{dimensions} · {print.edition.label} · Unframed</p>
            <CheckoutButton
              slug={print.slug}
              available={available}
              label={`Buy the print · ${price}`}
            />
            <a href="mailto:info@bygoetz.com?subject=Portland%20Sun%20print%20question">
              Ask a question about this print
            </a>
          </div>
        </section>

        <nav className={styles.footerNav} aria-label="Portland Sun page links">
          <Link href="/art">Thomas Goetz Art</Link>
          <Link href="/art#works">Selected work</Link>
          <Link href="/art#contact">Contact</Link>
          <Link href="/">By Goetz Grid</Link>
        </nav>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
