import { explorerDigitalBundle, explorerProducts } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "./ArtworkImage";
import styles from "./Explorers.module.css";

export function ExplorersPage() {
  const digitalBundleCta = explorerDigitalBundle.checkoutLink
    ? "Download the Collection"
    : "Preview Digital Bundle";
  const digitalBundleHref = explorerDigitalBundle.checkoutLink
    ? explorerDigitalBundle.checkoutLink
    : withSiteBasePath("/explorers/digital-downloads");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Fine art prints for curious rooms</p>
          <h1>The Explorers Series</h1>
          <p className={styles.subheadline}>
            Modern geometric animal illustrations for curious spaces.
          </p>
          <p className={styles.heroText}>
            A playful collection of museum-quality prints designed for nurseries,
            playrooms, reading corners, and creative homes.
          </p>
          <div className={styles.heroActions}>
            <a href="#collection" className={styles.primaryButton}>
              Shop the Collection
            </a>
            <a href="#story" className={styles.secondaryButton}>
              View the Story
            </a>
          </div>
        </div>
        <aside className={styles.digitalBundleCard} aria-label="Digital collection bundle">
          <div className={styles.bundleArtworkFrame}>
            <ArtworkImage src={explorerDigitalBundle.image} title="Explorer" />
          </div>
          <div className={styles.bundleCopy}>
            <p className={styles.eyebrow}>Digital files</p>
            <h2>{explorerDigitalBundle.title}</h2>
            <p>{explorerDigitalBundle.description}</p>
            <div className={styles.priceStack}>
              <span>{explorerDigitalBundle.compareAtPrice} value</span>
              <strong>{explorerDigitalBundle.price}</strong>
            </div>
            <ul className={styles.bundleList}>
              {explorerDigitalBundle.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a className={styles.primaryButton} href={digitalBundleHref}>
              {digitalBundleCta}
            </a>
          </div>
        </aside>
      </section>

      <section className={styles.collectionSection} id="collection">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>The collection</p>
          <h2>Choose your explorer.</h2>
          <p>
            Collect one favorite or build a coordinated wall of curious animals and
            characters, available as premium prints or framed art.
          </p>
        </div>
        <div className={styles.productGrid}>
          {explorerProducts.map((product) => (
            <article className={styles.productCard} key={product.slug}>
              <a
                className={styles.productArtworkLink}
                href={withSiteBasePath(`/explorers/products/${product.slug}`)}
              >
                <ArtworkImage src={product.image} title={product.title} />
              </a>
              <div className={styles.productCardBody}>
                <div>
                  <h3>{product.title}</h3>
                  <p>Prints &amp; framed prints</p>
                </div>
                <div className={styles.productMeta}>
                  <span>From {product.priceFrom}</span>
                  <a href={withSiteBasePath(`/explorers/products/${product.slug}`)}>
                    View Print
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.spacesSection}>
        <div>
          <p className={styles.eyebrow}>Designed for curious spaces</p>
          <h2>Calm enough for grown-up interiors. Bright enough for imagination.</h2>
        </div>
        <div className={styles.spaceList}>
          {[
            "Nurseries",
            "Kids rooms",
            "Playrooms",
            "Reading corners",
            "Classrooms",
            "Creative studios",
            "Modern family homes",
          ].map((space) => (
            <span key={space}>{space}</span>
          ))}
        </div>
      </section>

      <section className={styles.qualitySection}>
        {[
          "Museum-quality prints",
          "Archival paper",
          "Available framed or unframed",
          "Multiple sizes",
          "Made to order",
          "Designed as a coordinated collection",
        ].map((point) => (
          <div className={styles.qualityItem} key={point}>
            <span />
            <p>{point}</p>
          </div>
        ))}
      </section>

      <section className={styles.storySection} id="story">
        <p className={styles.eyebrow}>The story</p>
        <h2>Simple geometry, expressive linework, and bold primary color.</h2>
        <p>
          The Explorers Series uses simple geometry, expressive black linework, and
          bold primary colors to create animals and characters that feel curious,
          imaginative, and timeless. Each piece is playful without feeling overly
          sweet, minimal without losing warmth, and designed to live comfortably in
          creative homes.
        </p>
      </section>

      <section className={styles.finalCta}>
        <h2>Choose your explorer.</h2>
        <a href="#collection" className={styles.primaryButton}>
          Shop the Collection
        </a>
      </section>
    </main>
  );
}
