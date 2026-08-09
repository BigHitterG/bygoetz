import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import coverBack from "@/public/gromas/cover-back-v3.webp";
import coverFront from "@/public/gromas/cover-front-v3.webp";
import gromasCharacter from "@/public/gromas/gromas-character-v3.webp";
import previewCharge from "@/public/gromas/preview-charge-v3.webp";
import previewDarkness from "@/public/gromas/preview-darkness-v3.webp";
import previewPowerCrisis from "@/public/gromas/preview-power-crisis-v3.webp";
import previewSpinette from "@/public/gromas/preview-spinette-v3.webp";
import {
  gromasBook,
  gromasPaperbackBook,
  gromasPaperbackPurchase,
  gromasPurchase,
  type GromasPurchaseState,
} from "@/lib/gromas/storefront";
import styles from "./gromas.module.css";

const pageDescription =
  "A playful rhyming picture-book adventure about Gromas, the Gobbledygooks, and the remarkable machine that turns ordinary footsteps into extraordinary energy.";

export const metadata: Metadata = {
  title: "Gromas and the Gobbledygooks | Hardcover and Paperback",
  description: pageDescription,
  alternates: { canonical: "/gromas" },
  openGraph: {
    title: "Gromas and the Gobbledygooks",
    description: pageDescription,
    type: "website",
    url: "/gromas",
    images: [
      {
        url: "/gromas/og-gromas-v3.webp",
        width: 1200,
        height: 630,
        alt: "Rendered Gromas and the Gobbledygooks hardcover mockup beside a warm workshop lamp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gromas and the Gobbledygooks",
    description: pageDescription,
    images: ["/gromas/og-gromas-v3.webp"],
  },
};

const previews: Array<{
  image: StaticImageData;
  label: string;
  title: string;
  description: string;
}> = [
  {
    image: previewPowerCrisis,
    label: "Sample spread · Pages 4–5",
    title: "The lights are fading",
    description:
      "Gromas gathers the hidden community and reveals that the Great Power Supply is nearly gone.",
  },
  {
    image: previewSpinette,
    label: "Sample spread · Pages 8–9",
    title: "A remarkable little machine",
    description:
      "Chet’s Spinette promises to turn an unnoticed human footstep into a much-needed charge.",
  },
  {
    image: previewDarkness,
    label: "Sample spread · Pages 20–21",
    title: "Four minutes. Three. Two. One.",
    description:
      "The grid is ready—but no machine can help until someone upstairs takes a step.",
  },
  {
    image: previewCharge,
    label: "Sample spread · Pages 26–27",
    title: "Eureka—a charge!",
    description:
      "One step becomes four, the hidden wires begin to glow, and a whole world comes back to life.",
  },
];

const bookJsonLd = {
  "@context": "https://schema.org",
  "@type": "Book",
  name: gromasBook.title,
  author: gromasBook.authors.map((name) => ({ "@type": "Person", name })),
  numberOfPages: gromasBook.pageCount,
  isbn: gromasBook.isbn,
  bookFormat: "https://schema.org/Hardcover",
  inLanguage: "en",
  audience: {
    "@type": "PeopleAudience",
    suggestedMinAge: 4,
    suggestedMaxAge: 8,
  },
  image: "https://www.bygoetz.com/gromas/cover-front-v3.webp",
  description: pageDescription,
  offers: [
    ...(gromasPurchase.status === "available"
      ? [
          {
            "@type": "Offer",
            name: "Premium color hardcover",
            url: gromasPurchase.url,
            price: "34.99",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        ]
      : []),
    ...(gromasPaperbackPurchase.status === "available"
      ? [
          {
            "@type": "Offer",
            name: "Premium color paperback",
            url: gromasPaperbackPurchase.url,
            price: "16.99",
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        ]
      : []),
  ],
};

function PurchaseButton({
  label,
  purchase,
  light = false,
}: {
  label: string;
  purchase: GromasPurchaseState;
  light?: boolean;
}) {
  const className = `${styles.purchaseButton} ${light ? styles.purchaseButtonLight : ""}`;

  if (purchase.status === "available") {
    return (
      <a
        className={className}
        href={purchase.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Buy {label} · {purchase.displayPrice}
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <button className={className} type="button" disabled>
      {label} · {purchase.displayPrice} · Publishing on Lulu
    </button>
  );
}

function PurchaseOptions({ light = false }: { light?: boolean }) {
  return (
    <div className={styles.purchaseOptions} aria-label="Choose a book format">
      <PurchaseButton label="Hardcover" purchase={gromasPurchase} light={light} />
      <PurchaseButton
        label="Paperback"
        purchase={gromasPaperbackPurchase}
        light={light}
      />
    </div>
  );
}

function BookMockup() {
  return (
    <div className={styles.bookStage}>
      <div className={styles.stageGlow} aria-hidden="true" />
      <div className={styles.bookShadow} aria-hidden="true" />
      <div className={styles.bookMockup}>
        <div className={styles.bookPageBlock} aria-hidden="true" />
        <div className={styles.bookCaseEdge} aria-hidden="true" />
        <div className={styles.bookCover}>
          <Image
            src={coverFront}
            alt="Front cover of Gromas and the Gobbledygooks"
            priority
            placeholder="blur"
            sizes="(max-width: 760px) 74vw, (max-width: 1100px) 42vw, 430px"
          />
          <span className={styles.coverSheen} aria-hidden="true" />
        </div>
      </div>
      <p className={styles.stageCaption}>
        Hardcover casewrap <span aria-hidden="true">·</span> 6 × 9 in.
      </p>
    </div>
  );
}

export default function GromasBookPage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(bookJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <a className={styles.skipLink} href="#main-content">
        Skip to book details
      </a>

      <header className={styles.header}>
        <Link className={styles.gridLink} href="/" aria-label="Return to the Lazy Grid">
          <span aria-hidden="true">←</span>
          Lazy Grid
        </Link>
        <span className={styles.headerMark} aria-hidden="true">
          G
        </span>
        <a className={styles.headerPreviewLink} href="#preview">
          Read a preview
        </a>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="book-title">
          <div className={styles.heroVisual}>
            <BookMockup />
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>A rhyming picture-book adventure</p>
            <p className={styles.heroHook}>
              One small step. One hidden world. One very big idea.
            </p>
            <h1 id="book-title">
              Gromas
              <span>and the Gobbledygooks</span>
            </h1>
            <p className={styles.byline}>
              By Thomas Raymond Goetz and William James Pahos
            </p>
            <p className={styles.heroDescription}>
              Deep beneath an ordinary apartment floor, a hidden community’s
              power is running out. Gromas has one plan, one impossible
              deadline—and a whole lot of curious Gobbledygooks ready to build.
            </p>

            <ul className={styles.quickFacts} aria-label="Book details">
              <li>Ages 4–8</li>
              <li>32 pages</li>
              <li>Premium color</li>
              <li>6 × 9 in. hardcover or paperback</li>
            </ul>

            <div className={styles.heroActions}>
              <PurchaseOptions />
              <a className={styles.previewButton} href="#preview">
                Preview the story
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            <p className={styles.purchaseNote}>
              Secure checkout and print-on-demand fulfillment through Lulu.
              Shipping and tax are calculated at checkout.
            </p>
          </div>
        </section>

        <section className={styles.promiseSection} aria-labelledby="story-heading">
          <p className={styles.sectionKicker}>Beneath the floorboards</p>
          <h2 id="story-heading">
            What if a single footstep could save an entire hidden world?
          </h2>
          <div className={styles.promiseGrid}>
            <p>
              The Gobbledygooks’ Great Power Supply is fading fast. With time
              running out, Gromas and clever Chet rally the crew to build the
              Spinette—and transform ordinary footsteps into extraordinary
              energy.
            </p>
            <p>
              Told in lively rhyme and filled with whimsical wordplay,
              teamwork, toast, and invention, the story celebrates curiosity,
              ingenuity, perseverance, and the thrill of solving a problem
              together.
            </p>
          </div>
        </section>

        <section className={styles.previewSection} id="preview" aria-labelledby="preview-heading">
          <div className={styles.sectionHeadingRow}>
            <div>
              <p className={styles.sectionKicker}>Look inside</p>
              <h2 id="preview-heading">A first step into Gromas’s world</h2>
            </div>
            <p>
              Four current v3 sample spreads from the 32-page book. Swipe on
              mobile or scroll to explore.
            </p>
          </div>

          <div className={styles.previewRail}>
            {previews.map((preview, index) => (
              <figure
                className={`${styles.previewCard} ${index === 0 ? styles.previewCardFeatured : ""}`}
                key={preview.title}
              >
                <div className={styles.previewImageFrame}>
                  <Image
                    src={preview.image}
                    alt=""
                    placeholder="blur"
                    sizes={
                      index === 0
                        ? "(max-width: 760px) 88vw, 72vw"
                        : "(max-width: 760px) 88vw, 44vw"
                    }
                  />
                </div>
                <figcaption>
                  <span>{preview.label}</span>
                  <strong>{preview.title}</strong>
                  <p>{preview.description}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={styles.characterSection} aria-labelledby="meet-heading">
          <div className={styles.characterPortrait}>
            <Image
              src={gromasCharacter}
              alt="Gromas, the green Gobbledygook leader, holding his bristled staff"
              placeholder="blur"
              sizes="(max-width: 760px) 88vw, 42vw"
            />
          </div>
          <div className={styles.characterCopy}>
            <p className={styles.sectionKicker}>Meet Gromas</p>
            <h2 id="meet-heading">A promise-keeper with a plan</h2>
            <p className={styles.characterLead}>
              When the lights begin to dim, Gromas does what good leaders do:
              he tells the truth, listens to a clever idea, and gets everyone
              moving in the same direction.
            </p>
            <div className={styles.readerReasons}>
              <article>
                <span>01</span>
                <h3>Curiosity becomes action</h3>
                <p>A hidden-world adventure built around invention and discovery.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Teamwork wins</h3>
                <p>Every Frontliner, Electrician, and Lookout has a part to play.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Made to read aloud</h3>
                <p>Playful rhyme and Gobbledygook words invite everyone to join in.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.formatSection} aria-labelledby="format-heading">
          <div className={styles.backCoverStage}>
            <div className={styles.backBook}>
              <Image
                src={coverBack}
                alt="Back cover of Gromas and the Gobbledygooks"
                placeholder="blur"
                sizes="(max-width: 760px) 74vw, 390px"
              />
            </div>
            <div className={styles.measureVertical} aria-hidden="true">
              <span>9 in.</span>
            </div>
            <div className={styles.measureHorizontal} aria-hidden="true">
              <span>6 in.</span>
            </div>
          </div>

          <div className={styles.formatCopy}>
            <p className={styles.sectionKicker}>Two premium-color editions</p>
            <h2 id="format-heading">Choose hardcover or paperback</h2>
            <p>
              Both Lulu editions pair the compact read-aloud size with
              full-page art, premium color, coated paper, and a matte cover.
            </p>
            <dl className={styles.specList}>
              <div>
                <dt>Format</dt>
                <dd>Hardcover or paperback</dd>
              </div>
              <div>
                <dt>Trim size</dt>
                <dd>6 × 9 inches</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>32 illustrated pages</dd>
              </div>
              <div>
                <dt>Interior</dt>
                <dd>Premium color</dd>
              </div>
              <div>
                <dt>Paper</dt>
                <dd>80# white coated</dd>
              </div>
              <div>
                <dt>Cover</dt>
                <dd>Matte finish</dd>
              </div>
            </dl>
            <p className={styles.formatFootnote}>
              Hardcover ISBN {gromasBook.isbn}. Paperback ISBN {gromasPaperbackBook.isbn}.
              Each copy is printed to order by Lulu.
            </p>
          </div>
        </section>

        <section className={styles.creatorsSection} aria-labelledby="creators-heading">
          <p className={styles.sectionKicker}>From the creators</p>
          <h2 id="creators-heading">A story about asking, “What could we build next?”</h2>
          <p>
            Created by Thomas Raymond Goetz and William James Pahos and
            published by Getz LLC, <em>Gromas and the Gobbledygooks</em> is a
            first-edition picture book for young readers who love hidden
            worlds, marvelous machines, and a wonderfully strange word or two.
          </p>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-heading">
          <div className={styles.faqIntro}>
            <p className={styles.sectionKicker}>Before you order</p>
            <h2 id="faq-heading">Good things to know</h2>
            <p>
              The premium hardcover is available through Lulu. The premium
              paperback is prepared at $16.99 and awaiting Lulu proof approval.
            </p>
          </div>
          <div className={styles.faqList}>
            <details>
              <summary>Which formats can I order?</summary>
              <p>
                The premium-color hardcover is available for {gromasPurchase.displayPrice}.
                The premium-color paperback is priced at {gromasPaperbackPurchase.displayPrice}
                {gromasPaperbackPurchase.status === "available"
                  ? " and is available now."
                  : " and will activate here as soon as Lulu publishes its product page."}
              </p>
            </details>
            <details>
              <summary>Where will checkout happen?</summary>
              <p>
                On the verified Lulu Bookstore product page. Bygoetz does not
                collect or store your payment details.
              </p>
            </details>
            <details>
              <summary>How will printing and shipping work?</summary>
              <p>
                Each copy will be printed to order. Lulu will show the current
                production, shipping, tax, and delivery estimates during
                checkout.
              </p>
            </details>
            <details>
              <summary>Is this the final book artwork?</summary>
              <p>
                The page uses the production v3 cover artwork and sample
                interior spreads submitted to Lulu. We have ordered a physical
                proof so the printed result can receive one final quality check.
              </p>
            </details>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-heading">
          <div>
            <p className={styles.sectionKicker}>The adventure is ready</p>
            <h2 id="final-cta-heading">Take the first step with Gromas.</h2>
            <p>
              Preview the story art, then choose the premium-color hardcover
              or paperback edition fulfilled by Lulu.
            </p>
          </div>
          <div className={styles.finalCtaActions}>
            <PurchaseOptions light />
            <a href="#preview">Return to the preview</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link href="/">Return to the Lazy Grid</Link>
        <p>
          © 2026 Thomas Raymond Goetz and William James Pahos. Published by Getz LLC.
        </p>
      </footer>
    </div>
  );
}

