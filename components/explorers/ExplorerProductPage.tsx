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
            <p className={styles.detailPrice}>From {product.priceFrom}</p>

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
