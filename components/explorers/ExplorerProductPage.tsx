import {
  ExplorerProduct,
  getRelatedExplorerProducts,
} from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "./ArtworkImage";
import styles from "./Explorers.module.css";

type ExplorerProductPageProps = {
  product: ExplorerProduct;
};

export function ExplorerProductPage({ product }: ExplorerProductPageProps) {
  const relatedProducts = getRelatedExplorerProducts(product.slug);
  const checkoutLabel = product.stripePaymentLink ? "Add to Cart" : "Available Soon";
  const digitalCheckoutLabel = product.digitalPaymentLink
    ? "Buy Digital File"
    : "Digital File Coming Soon";

  return (
    <main className={styles.page}>
      <section className={styles.detailHero}>
        <a href={withSiteBasePath("/explorers")} className={styles.backLink}>
          Back to The Explorers Series
        </a>
        <div className={styles.detailGrid}>
          <div className={styles.detailArtworkFrame}>
            <ArtworkImage src={product.image} title={product.title} />
          </div>
          <div className={styles.detailCopy}>
            <p className={styles.eyebrow}>The Explorers Series</p>
            <h1>{product.title}</h1>
            <p>{product.description}</p>
            <p className={styles.detailPrice}>Prints from {product.priceFrom}</p>

            <div className={styles.optionGroup}>
              <h2>Sizes</h2>
              <div className={styles.optionList}>
                {product.availableSizes.map((size) => (
                  <span key={size}>{size}</span>
                ))}
              </div>
            </div>

            <div className={styles.optionGroup}>
              <h2>Formats</h2>
              <div className={styles.optionList}>
                {product.frameOptions.map((option) => (
                  <span key={option}>{option}</span>
                ))}
              </div>
            </div>

            {product.stripePaymentLink ? (
              <a className={styles.primaryButton} href={product.stripePaymentLink}>
                {checkoutLabel}
              </a>
            ) : (
              <button className={styles.disabledButton} type="button" disabled>
                {checkoutLabel}
              </button>
            )}

            <div className={styles.singleDigitalOption}>
              <div>
                <p className={styles.eyebrow}>Digital file</p>
                <h2>Download this artwork</h2>
                <p>
                  High-resolution PNG for personal printing and creative projects.
                </p>
              </div>
              <strong className={styles.digitalOptionPrice}>{product.digitalPrice}</strong>
              {product.digitalPaymentLink ? (
                <a className={styles.secondaryButton} href={product.digitalPaymentLink}>
                  {digitalCheckoutLabel}
                </a>
              ) : (
                <button className={styles.disabledButton} type="button" disabled>
                  {digitalCheckoutLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.relatedSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Related artworks</p>
          <h2>Build the collection.</h2>
        </div>
        <div className={styles.relatedGrid}>
          {relatedProducts.map((related) => (
            <a
              className={styles.relatedCard}
              href={withSiteBasePath(`/explorers/products/${related.slug}`)}
              key={related.slug}
            >
              <ArtworkImage src={related.image} title={related.title} />
              <span>{related.title}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
