import { ArtworkImage } from "@/components/explorers/ArtworkImage";
import styles from "@/components/explorers/Explorers.module.css";
import { explorerProducts } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";

export function DigitalDownloadSuccessPage() {
  const featuredProducts = explorerProducts.slice(0, 4);

  return (
    <main className={styles.page}>
      <section className={styles.successHero}>
        <a href={withSiteBasePath("/explorers")} className={styles.backLink}>
          Back to The Explorers Series
        </a>
        <div className={styles.successPanel}>
          <p className={styles.eyebrow}>Payment received</p>
          <h1>Check your email for your download link.</h1>
          <p>
            Thank you for your purchase. We sent your download link to the email
            address used at checkout from Goetz at downloads@send.bygoetz.com.
          </p>
          <p>
            If you do not see it in a minute or two, please check your spam or junk
            folder. After you click the download button in the email, the file should
            save to your computer's Downloads folder unless your browser asks where to
            save it.
          </p>
          <p>
            If anything looks off, reply to the email and I will help get the files to
            you.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href={withSiteBasePath("/explorers")}> 
              Return to Explorers
            </a>
            <a className={styles.secondaryButton} href={withSiteBasePath("/explorers/digital-downloads")}> 
              View Digital Bundle
            </a>
          </div>
        </div>
      </section>

      <section className={styles.moreFromGoetzSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>More from Goetz</p>
          <h2>Explore more artwork.</h2>
        </div>
        <div className={styles.relatedGrid}>
          {featuredProducts.map((product) => (
            <a
              className={styles.relatedCard}
              href={withSiteBasePath(`/explorers/products/${product.slug}`)}
              key={product.slug}
            >
              <ArtworkImage src={product.image} title={product.title} />
              <span>{product.title}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
