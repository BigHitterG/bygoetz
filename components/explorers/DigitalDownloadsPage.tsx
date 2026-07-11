"use client";

import { useState } from "react";
import { ArtworkImage } from "@/components/explorers/ArtworkImage";
import styles from "@/components/explorers/Explorers.module.css";
import { explorerDigitalBundle, explorerProducts } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";

export function DigitalDownloadsPage() {
  const [selectedSlug, setSelectedSlug] = useState("explorer");
  const selectedProduct =
    explorerProducts.find((product) => product.slug === selectedSlug) ??
    explorerProducts.find((product) => product.slug === "explorer") ??
    explorerProducts[0];

  return (
    <main className={styles.page}>
      <section className={styles.downloadHero}>
        <a href={withSiteBasePath("/explorers")} className={styles.backLink}>
          Back to The Explorers Series
        </a>
        <div className={styles.downloadGrid}>
          <div className={styles.downloadPreviewPanel}>
            <div className={styles.downloadFeaturedArtwork}>
              <ArtworkImage src={selectedProduct.image} title={selectedProduct.title} />
            </div>
            <div className={styles.downloadPreviewGrid} aria-label="Digital bundle artwork previews">
              {explorerProducts.map((product) => (
                <button
                  className={`${styles.downloadPreviewTile} ${
                    product.slug === selectedProduct.slug ? styles.selectedPreviewTile : ""
                  }`}
                  key={product.slug}
                  type="button"
                  onClick={() => setSelectedSlug(product.slug)}
                  aria-pressed={product.slug === selectedProduct.slug}
                >
                  <ArtworkImage src={product.image} title={product.title} />
                  <span>{product.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.downloadCopy}>
            <p className={styles.eyebrow}>Digital files</p>
            <h1>{explorerDigitalBundle.title}</h1>
            <p>{explorerDigitalBundle.description}</p>
            <p className={styles.deliveryNote}>
              After checkout, your download link will be emailed to the address used in
              Stripe from Goetz at downloads@send.bygoetz.com. Please check your spam
              or junk folder if it does not arrive within a few minutes.
            </p>
            <div className={styles.priceStack}>
              <span>{explorerDigitalBundle.compareAtPrice} value</span>
              <strong>{explorerDigitalBundle.price}</strong>
            </div>

            <div className={styles.checkoutPreview}>
              <h2>What you will receive</h2>
              <ul className={styles.cleanList}>
                <li>All eight Explorers Series artworks</li>
                <li>32 total files: 4 files for each artwork</li>
                <li>8x10 PNG and PDF for every artwork</li>
                <li>11x14 PNG and PDF for every artwork</li>
                <li>One downloadable bundle delivered by email after checkout</li>
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
                Stripe will process payment securely, then Goetz will email your
                download link for the 32-file bundle to the email address used at
                checkout.
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
