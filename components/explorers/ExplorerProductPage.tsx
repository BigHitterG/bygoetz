import {
  ExplorerProduct,
  getRelatedExplorerProducts,
} from "@/lib/explorers/products";
import {
  ExplorersBuilderLink,
  ExplorersDigitalProductView,
  ExplorersProductView,
} from "@/components/analytics/ExplorersProductMeta";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "./ArtworkImage";
import { DigitalCheckoutButton } from "./DigitalCheckoutButton";
import styles from "./Explorers.module.css";

type ExplorerProductPageProps = {
  product: ExplorerProduct;
  digitalView?: boolean;
};

export function ExplorerProductPage({ product, digitalView = false }: ExplorerProductPageProps) {
  const relatedProducts = getRelatedExplorerProducts(product.slug);
  const digitalCheckoutLabel = product.digitalPaymentLink
    ? "Buy Digital File"
    : "Digital File Coming Soon";

  return (
    <main className={styles.page}>
      {digitalView ? (
        <ExplorersDigitalProductView
          productKey={`${product.slug}-digital-file`}
          productTitle={`${product.title} Digital File`}
          value={Number(product.digitalPrice.replace(/[^0-9.]/g, "")) || 0}
        />
      ) : (
        <ExplorersProductView
          artworkSlug={product.slug}
          artworkTitle={product.title}
          value={Number(product.priceFrom.replace(/[^0-9.]/g, "")) || 0}
        />
      )}
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
              <h2>Choose your finish</h2>
              <p>
                Available as an archival print or ready-to-hang framed artwork in
                natural, black, or white. Add a white mat for a larger finished piece.
              </p>
              <div className={styles.printOptionList}>
                {product.printOptions.map((option) => (
                  <div className={styles.printOptionCard} key={option.label}>
                    <div className={styles.printOptionHeader}>
                      <strong>{option.label}</strong>
                      <span>{option.price}</span>
                    </div>
                    <p>{option.artworkSize}</p>
                    <p>{option.finishedSize}</p>
                    <small>{option.note ?? option.format}</small>
                  </div>
                ))}
              </div>
              <p className={styles.optionNote}>
                Framed artwork uses optical-grade clear acrylic instead of traditional
                glass. Shipping and tax are shown in Stripe checkout.
              </p>
              <ExplorersBuilderLink
                className={styles.primaryButton}
                artworkSlug={product.slug}
                artworkTitle={product.title}
                href={withSiteBasePath(
                  "/explorers/build-a-set?quantity=1&artwork=" + product.slug,
                )}
              >
                Customize and Buy
              </ExplorersBuilderLink>
            </div>

            <div className={styles.singleDigitalOption} id="digital-download">
              <div>
                <p className={styles.eyebrow}>Digital file</p>
                <h2>Download this artwork</h2>
                <p>
                  High-resolution files for personal printing and creative projects.
                </p>
                <ul className={styles.cleanList}>
                  <li>4 files included for this artwork</li>
                  <li>8x10 PNG and PDF</li>
                  <li>11x14 PNG and PDF</li>
                </ul>
                <p className={styles.deliveryNote}>
                  After checkout, your download link will be emailed to the address used
                  in Stripe from Goetz at downloads@send.bygoetz.com. Please check your
                  spam or junk folder if it does not arrive within a few minutes.
                </p>
              </div>
              <strong className={styles.digitalOptionPrice}>{product.digitalPrice}</strong>
              {product.digitalPaymentLink ? (
                <DigitalCheckoutButton
                  className={styles.secondaryButton}
                  productKey={`${product.slug}-digital-file`}
                  productTitle={`${product.title} Digital File`}
                  value={Number(product.digitalPrice.replace(/[^0-9.]/g, "")) || 0}
                >
                  {digitalCheckoutLabel}
                </DigitalCheckoutButton>
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


