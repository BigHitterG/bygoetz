import type { Metadata } from "next";
import { ArtworkImage } from "@/components/explorers/ArtworkImage";
import styles from "@/components/explorers/Explorers.module.css";
import { explorerDigitalBundle, explorerProducts } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";

export const metadata: Metadata = {
  title: "Digital Downloads | The Explorers Series",
  description:
    "Preview the complete Explorers Series digital download bundle with high-resolution artwork files for personal printing and decor projects.",
};

export default function Page() {
  return (
    <main className={styles.page}>
      <section className={styles.downloadHero}>
        <a href={withSiteBasePath("/explorers")} className={styles.backLink}>
          Back to The Explorers Series
        </a>
        <div className={styles.downloadGrid}>
          <div className={styles.downloadPreviewPanel}>
            <div className={styles.downloadFeaturedArtwork}>
              <ArtworkImage src={explorerDigitalBundle.image} title="Explorer" />
            </div>
            <div className={styles.downloadPreviewGrid} aria-label="Digital bundle artwork previews">
              {explorerProducts.map((product) => (
                <div className={styles.downloadPreviewTile} key={product.slug}>
                  <ArtworkImage src={product.image} title={product.title} />
                  <span>{product.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.downloadCopy}>
            <p className={styles.eyebrow}>Digital files</p>
            <h1>{explorerDigitalBundle.title}</h1>
            <p>{explorerDigitalBundle.description}</p>
            <div className={styles.priceStack}>
              <span>{explorerDigitalBundle.compareAtPrice} value</span>
              <strong>{explorerDigitalBundle.price}</strong>
            </div>

            <div className={styles.checkoutPreview}>
              <h2>What you will receive</h2>
              <ul className={styles.cleanList}>
                <li>All eight Explorers Series artworks</li>
                <li>High-resolution PNG files for crisp personal printing</li>
                <li>One downloadable bundle delivered after checkout</li>
                <li>Personal-use license for home decor and gifts</li>
              </ul>
            </div>

            <div className={styles.checkoutPreview}>
              <h2>Checkout preview</h2>
              <div className={styles.checkoutRow}>
                <span>Complete Digital Collection</span>
                <strong>{explorerDigitalBundle.price}</strong>
              </div>
              <p>
                When Stripe is connected, this button will send buyers to payment and
                delivery for the download bundle.
              </p>
              {explorerDigitalBundle.checkoutLink ? (
                <a className={styles.primaryButton} href={explorerDigitalBundle.checkoutLink}>
                  Continue to Secure Checkout
                </a>
              ) : (
                <button className={styles.disabledButton} type="button" disabled>
                  Stripe Checkout Coming Soon
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
