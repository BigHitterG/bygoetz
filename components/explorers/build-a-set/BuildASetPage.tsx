"use client";

import { useEffect, useMemo, useState } from "react";
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/analytics/metaPixel";
import {
  explorerSetOptions,
  formatUsd,
  type ExplorerSetOptionId,
} from "@/lib/explorers/buildASet";
import { explorerProducts, type ExplorerProduct } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "../ArtworkImage";
import { ArtworkSelector } from "./ArtworkSelector";
import { GalleryPreview } from "./GalleryPreview";
import { MobileSetSummary } from "./MobileSetSummary";
import { ProductOptionSelector } from "./ProductOptionSelector";
import styles from "./BuildASet.module.css";

type BuildASetPageProps = {
  checkoutConfigured: boolean;
};

export function BuildASetPage({ checkoutConfigured }: BuildASetPageProps) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<ExplorerSetOptionId>(
    explorerSetOptions[0].id,
  );
  const [announcement, setAnnouncement] = useState("Choose three Explorers.");
  const [checkoutError, setCheckoutError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedProducts = useMemo(
    () =>
      selectedSlugs
        .map((slug) => explorerProducts.find((product) => product.slug === slug))
        .filter((product): product is ExplorerProduct => Boolean(product)),
    [selectedSlugs],
  );
  const selectedOption =
    explorerSetOptions.find((option) => option.id === selectedOptionId) ??
    explorerSetOptions[0];
  const ready = selectedProducts.length === 3;
  const progressLabel = ready ? "Ready to Checkout" : `${selectedProducts.length} of 3 Selected`;

  useEffect(() => {
    trackMetaEvent("ViewContent", {
      content_name: "Build Your Own Explorers Print Set",
      content_category: "Physical Print Set",
      content_type: "product_group",
    });
  }, []);

  function handleToggle(product: ExplorerProduct) {
    setCheckoutError("");
    setSelectedSlugs((current) => {
      const existingIndex = current.indexOf(product.slug);
      let next: string[];
      let action: "select" | "deselect" | "replace";

      if (existingIndex >= 0) {
        next = current.filter((slug) => slug !== product.slug);
        action = "deselect";
        setAnnouncement(`${product.title} removed. ${next.length} of 3 selected.`);
      } else if (current.length < 3) {
        next = [...current, product.slug];
        action = "select";
        setAnnouncement(
          next.length === 3
            ? `${product.title} selected. Your set is ready to review.`
            : `${product.title} selected. ${next.length} of 3 selected.`,
        );
      } else {
        const replaced = explorerProducts.find((item) => item.slug === current[0]);
        next = [...current.slice(1), product.slug];
        action = "replace";
        setAnnouncement(`${product.title} replaced ${replaced?.title ?? "the first artwork"}.`);
      }

      trackMetaCustomEvent("ArtworkSelection", {
        artwork: product.title,
        artwork_slug: product.slug,
        action,
        selected_count: next.length,
        content_ids: next,
      });
      return next;
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    setSelectedSlugs((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;

      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      setAnnouncement(
        `${selectedProducts[index]?.title ?? "Artwork"} moved to position ${destination + 1}.`,
      );
      return next;
    });
  }

  async function beginCheckout() {
    if (!ready) {
      document.getElementById("artwork-choices")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!checkoutConfigured) {
      document.getElementById("set-checkout")?.scrollIntoView({ behavior: "smooth" });
      setCheckoutError(
        "Checkout is being prepared for this new three-print set. Individual physical prints remain available now.",
      );
      return;
    }

    setBusy(true);
    setCheckoutError("");
    trackMetaEvent("InitiateCheckout", {
      value: selectedOption.totalPriceCents / 100,
      currency: "USD",
      content_type: "product_group",
      content_ids: selectedSlugs,
      num_items: 3,
      print_option: selectedOption.id,
    });

    try {
      const response = await fetch("/api/stripe/explorers-set/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedSlugs, optionId: selectedOption.id }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Checkout could not open.");
      window.location.assign(result.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout could not open.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="build-a-set-title">
        <div className={styles.heroRoom} aria-hidden="true">
          <div className={styles.heroPrints}>
            {[explorerProducts[0], explorerProducts[6], explorerProducts[4]].map(
              (product, index) => (
                <span className={styles.heroPrint} key={product.slug}>
                  <ArtworkImage
                    src={product.image}
                    title={product.title}
                    loading={index === 1 ? "eager" : "lazy"}
                    fetchPriority={index === 1 ? "high" : "auto"}
                  />
                </span>
              ),
            )}
          </div>
          <span className={styles.heroShelf} />
          <span className={styles.heroRug} />
          <span className={styles.heroTable} />
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Three prints {"\u00b7"} chosen by you</p>
          <h1 id="build-a-set-title">Build Your Own Explorers Print Set</h1>
          <p>
            Choose your favorite Explorers and build a gallery wall that grows with
            imagination.
          </p>
          <p className={styles.heroOffer}>Sets from $89 {"\u00b7"} save $16 or more</p>
          <a className={styles.primaryButton} href="#builder">
            Build My Set
          </a>
        </div>
      </section>

      <section className={styles.builder} id="builder" aria-labelledby="builder-title">
        <div className={styles.builderHeader}>
          <div>
            <p className={styles.eyebrow}>Step 1</p>
            <h2 id="builder-title">Choose 3 Prints</h2>
            <p>Tap any artwork to add it. Tap a selected artwork to remove it.</p>
          </div>
          <div className={styles.progress} aria-live="polite">
            <span>{selectedProducts.length}</span>
            <strong>{progressLabel}</strong>
          </div>
        </div>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </p>
        <div id="artwork-choices">
          <ArtworkSelector
            products={explorerProducts}
            selectedSlugs={selectedSlugs}
            onToggle={handleToggle}
          />
        </div>

        {ready ? (
          <div className={styles.readyArea}>
            <ProductOptionSelector
              selectedOptionId={selectedOptionId}
              onChange={setSelectedOptionId}
            />
            <GalleryPreview
              products={selectedProducts}
              option={selectedOption}
              onMove={handleMove}
            />
            <section className={styles.checkoutSummary} id="set-checkout">
              <div>
                <p className={styles.eyebrow}>Your set</p>
                <h2>{selectedProducts.map((product) => product.title).join(" \u00b7 ")}</h2>
                <p>
                  Three {selectedOption.label.toLowerCase()} {"\u00b7"}{" "}
                  <s>{formatUsd(selectedOption.retailTotalCents)}</s>{" "}
                  <strong>{formatUsd(selectedOption.totalPriceCents)}</strong> total
                </p>
                <p className={styles.savingsNote}>
                  Bundle savings: {formatUsd(selectedOption.savingsCents)}
                </p>
              </div>
              <div className={styles.checkoutAction}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={beginCheckout}
                  disabled={busy || !checkoutConfigured}
                >
                  {busy
                    ? "Opening Checkout..."
                    : checkoutConfigured
                      ? `Checkout \u00b7 ${formatUsd(selectedOption.totalPriceCents)}`
                      : "Set Checkout Coming Soon"}
                </button>
                {!checkoutConfigured ? (
                  <p>
                    Dedicated set checkout is not live yet. You can still buy each
                    artwork individually from the collection.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <div className={styles.selectionPrompt}>
            <strong>{3 - selectedProducts.length} more to choose</strong>
            <p>Your print options and gallery preview will appear here.</p>
          </div>
        )}
        {checkoutError ? (
          <p className={styles.checkoutError} role="alert">
            {checkoutError} <a href={withSiteBasePath("/explorers#collection")}>Shop individual prints.</a>
          </p>
        ) : null}
      </section>

      <section className={styles.qualityBand} aria-label="Product qualities">
        {[
          ["One coordinated series", "Created by Goetz as a collection"],
          ["Museum-quality printing", "Made for lasting display"],
          ["Archival paper", "Available unmatted or professionally matted"],
        ].map(([title, detail]) => (
          <div key={title}>
            <span aria-hidden="true" />
            <strong>{title}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </section>

      <section className={styles.perfectFor}>
        <div>
          <p className={styles.eyebrow}>Perfect for</p>
          <h2>Curious rooms of every kind.</h2>
        </div>
        <div className={styles.roomUses}>
          {["Nursery", "Playroom", "Reading Nook", "Bedroom", "Kids Room", "Creative Space"].map(
            (room, index) => (
              <span key={room}>
                <i aria-hidden="true">0{index + 1}</i>
                {room}
              </span>
            ),
          )}
        </div>
      </section>

      <section className={styles.artistSection}>
        <img src={withSiteBasePath("/concepts/images/Logo-01.png")} alt="Goetz" />
        <div>
          <p className={styles.eyebrow}>Meet the artist</p>
          <h2>Made as one original, expressive world.</h2>
          <p>
            Goetz created The Explorers Series with simple geometry, expressive black
            linework, and bold primary color. Each character belongs together while
            keeping a personality of its own.
          </p>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <p className={styles.eyebrow}>Questions</p>
        <h2 id="faq-title">Before you build your set.</h2>
        <div className={styles.faqList}>
          <details>
            <summary>Can I choose any three Explorers?</summary>
            <p>Yes. Choose any three of the eight existing artworks, in any combination.</p>
          </details>
          <details>
            <summary>Do frames come included?</summary>
            <p>
              No. Choose unmatted prints or matted prints. The 8x10 matted option fits
              an 11x14 frame, and the 11x14 matted option fits a 16x20 frame.
            </p>
          </details>
          <details>
            <summary>What print sizes exist?</summary>
            <p>
              The existing physical options are 8x10 prints and 11x14 prints, each
              available unmatted or matted.
            </p>
          </details>
          <details>
            <summary>Can I buy one artwork individually?</summary>
            <p>
              Yes. <a href={withSiteBasePath("/explorers#collection")}>Visit the full collection</a> to choose one physical print or an individual digital file.
            </p>
          </details>
          <details>
            <summary>Do digital downloads still exist?</summary>
            <p>
              Yes. The <a href={withSiteBasePath("/explorers/digital-downloads")}>Complete Digital Collection</a> remains available separately from this physical set.
            </p>
          </details>
        </div>
      </section>

      <MobileSetSummary
        products={selectedProducts}
        option={selectedOption}
        busy={busy}
        checkoutConfigured={checkoutConfigured}
        onAction={beginCheckout}
      />
    </main>
  );
}

