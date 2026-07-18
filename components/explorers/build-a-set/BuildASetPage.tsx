"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/analytics/metaPixel";
import {
  explorerSetOptions,
  formatUsd,
  getExplorerOrderPrice,
  type ExplorerFrameColor,
  type ExplorerOrderQuantity,
  type ExplorerSetOptionId,
} from "@/lib/explorers/buildASet";
import { explorerProducts, type ExplorerProduct } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";
import { GalleryPreview } from "./GalleryPreview";
import { MobileSetSummary } from "./MobileSetSummary";
import { ProductOptionSelector } from "./ProductOptionSelector";
import styles from "./BuildASet.module.css";

type BuildASetPageProps = {
  checkoutConfigured: boolean;
  initialArtworkSlug?: string;
  initialArtworkSlugs?: string[];
  initialFrameColor?: string;
  initialLandingMode?: string;
  initialLayoutId?: string;
  initialOptionId?: string;
  initialRoomId?: string;
};

export function BuildASetPage({
  checkoutConfigured,
  initialArtworkSlug,
  initialArtworkSlugs,
  initialFrameColor,
  initialLandingMode,
  initialLayoutId,
  initialOptionId,
  initialRoomId,
}: BuildASetPageProps) {
  const validInitialArtwork = explorerProducts.some(
    (product) => product.slug === initialArtworkSlug,
  )
    ? initialArtworkSlug
    : undefined;
  const validInitialArtworks = Array.from(
    new Set(
      (initialArtworkSlugs ?? []).filter((slug) =>
        explorerProducts.some((product) => product.slug === slug),
      ),
    ),
  ).slice(0, 3);
  const startsWithSet = validInitialArtworks.length === 3;
  const validInitialOptionId = explorerSetOptions.some(
    (option) => option.id === initialOptionId,
  )
    ? (initialOptionId as ExplorerSetOptionId)
    : "8x10-framed-mat";
  const validInitialFrameColor: ExplorerFrameColor =
    initialFrameColor === "black" || initialFrameColor === "white"
      ? initialFrameColor
      : "natural";
  const landingMode =
    initialLandingMode === "nook-set" || initialLandingMode === "explorer-single"
      ? initialLandingMode
      : undefined;
  const [quantity, setQuantity] = useState<ExplorerOrderQuantity>(
    validInitialArtwork && !startsWithSet ? 1 : 3,
  );
  const [selectedSlots, setSelectedSlots] = useState<Array<string | null>>(
    startsWithSet
      ? validInitialArtworks
      : validInitialArtwork
      ? [validInitialArtwork]
      : ["monkey", "explorer", "turtle"],
  );
  const [selectedOptionId, setSelectedOptionId] = useState<ExplorerSetOptionId>(
    validInitialOptionId,
  );
  const [frameColor, setFrameColor] =
    useState<ExplorerFrameColor>(validInitialFrameColor);
  const [announcement, setAnnouncement] = useState(
    startsWithSet
      ? "Your reading nook gallery is ready to customize."
      : validInitialArtwork
      ? "Your selected Explorer is ready to customize."
      : "Three Explorers selected.",
  );
  const [checkoutError, setCheckoutError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedSlotProducts = useMemo(
    () =>
      selectedSlots
        .map((slug) => explorerProducts.find((product) => product.slug === slug))
        .map((product) => product ?? null),
    [selectedSlots],
  );
  const selectedProducts = useMemo(
    () =>
      selectedSlotProducts.filter(
        (product): product is ExplorerProduct => Boolean(product),
      ),
    [selectedSlotProducts],
  );
  const selectedSlugs = selectedProducts.map((product) => product.slug);
  const selectedOption =
    explorerSetOptions.find((option) => option.id === selectedOptionId) ??
    explorerSetOptions[0];
  const price = getExplorerOrderPrice(selectedOption, quantity);
  const ready = selectedProducts.length === quantity;
  const progressLabel = ready
    ? "Ready to customize"
    : `${selectedProducts.length} of ${quantity} selected`;
  const hasTrackedLanding = useRef(false);

  useEffect(() => {
    if (hasTrackedLanding.current) return;
    hasTrackedLanding.current = true;

    trackMetaEvent("ViewContent", {
      content_name: "Build Your Own Explorers Print Set",
      content_category: "Physical Print Set",
      content_type: "product_group",
      landing_experience: landingMode ?? "default",
    });

    if (landingMode) {
      trackMetaCustomEvent("AdLandingExperienceView", {
        landing_experience: landingMode,
        room: initialRoomId ?? "wall",
        quantity,
        print_option: validInitialOptionId,
        frame_color: validInitialFrameColor,
      });
    }
  }, [
    initialRoomId,
    landingMode,
    quantity,
    validInitialFrameColor,
    validInitialOptionId,
  ]);

  function handleSelectArtwork(index: number, product: ExplorerProduct) {
    setCheckoutError("");
    setSelectedSlots((current) => {
      const existingIndex = current.indexOf(product.slug);
      const currentProduct = explorerProducts.find(
        (item) => item.slug === current[index],
      );

      if (existingIndex === index) {
        setAnnouncement(`${product.title} is already in position ${index + 1}.`);
        return current;
      }

      const next = [...current];
      const action = existingIndex >= 0 ? "swap" : "replace";

      if (existingIndex >= 0) {
        [next[index], next[existingIndex]] = [next[existingIndex], next[index]];
        setAnnouncement(
          `${product.title} moved to position ${index + 1}. ${currentProduct?.title ?? "Artwork"} moved to position ${existingIndex + 1}.`,
        );
      } else {
        next[index] = product.slug;
        setAnnouncement(
          `${product.title} selected for position ${index + 1}, replacing ${currentProduct?.title ?? "the previous artwork"}.`,
        );
      }

      trackMetaCustomEvent("ArtworkSelection", {
        artwork: product.title,
        artwork_slug: product.slug,
        action,
        position: index + 1,
        selected_count: next.filter(Boolean).length,
        content_ids: next.filter((slug): slug is string => Boolean(slug)),
      });
      return next;
    });
  }

  function handleQuantityChange(nextQuantity: ExplorerOrderQuantity) {
    setQuantity(nextQuantity);
    setCheckoutError("");
    setSelectedSlots((current) => {
      if (nextQuantity === 1) {
        const firstSelected = current.find((slug): slug is string => Boolean(slug));
        const next = [firstSelected ?? explorerProducts[0].slug];
        setAnnouncement("One artwork selected.");
        return next;
      }

      const next = current.filter((slug): slug is string => Boolean(slug));
      for (const product of explorerProducts) {
        if (next.length === 3) break;
        if (!next.includes(product.slug)) next.push(product.slug);
      }
      setAnnouncement("Three artworks selected. Your set includes 15% savings.");
      return next.slice(0, 3);
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    setSelectedSlots((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;

      const next = [...current];
      const movingProduct = explorerProducts.find(
        (product) => product.slug === current[index],
      );
      [next[index], next[destination]] = [next[destination], next[index]];
      setAnnouncement(
        `${movingProduct?.title ?? "Artwork"} moved to position ${destination + 1}.`,
      );
      return next;
    });
  }

  async function beginCheckout() {
    if (!ready) {
      document.getElementById("artwork-selection")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!checkoutConfigured) {
      document.getElementById("set-checkout")?.scrollIntoView({ behavior: "smooth" });
      setCheckoutError(
        "Checkout is being prepared for these new print and frame options.",
      );
      return;
    }

    setBusy(true);
    setCheckoutError("");
    trackMetaEvent("InitiateCheckout", {
      value: price.totalPriceCents / 100,
      currency: "USD",
      content_type: "product_group",
      content_ids: selectedSlugs,
      num_items: quantity,
      print_option: selectedOption.id,
      frame_color: selectedOption.format === "Framed" ? frameColor : "none",
    });

    try {
      const response = await fetch("/api/stripe/explorers-set/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedSlugs,
          optionId: selectedOption.id,
          quantity,
          frameColor,
        }),
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
      <header className={styles.productHero} aria-labelledby="build-a-set-title">
        <p className={styles.eyebrow}>
          The Explorers Series
          {landingMode ? " \u00b7 Continue from the ad" : ""}
        </p>
        <h1 id="build-a-set-title">Design Your Own Explorers Gallery</h1>
        <p>
          {landingMode === "explorer-single"
            ? "Start with the Explorer, natural frame, and white mat you saw. Change any detail while the room stays in view."
            : landingMode === "nook-set"
              ? "Start with the three-print reading nook you saw. Choose different Explorers, arrangements, sizes, mats, or frames below."
              : "Choose one favorite or a set of three. Start designing on the wall below."}
        </p>
      </header>

      <section className={styles.builder} id="builder" aria-labelledby="builder-title">
        <p className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </p>

        <div className={styles.readyArea}>
          <GalleryPreview
            products={selectedSlotProducts}
            option={selectedOption}
            quantity={quantity}
            frameColor={frameColor}
            onMove={handleMove}
            availableProducts={explorerProducts}
            onSelectArtwork={handleSelectArtwork}
            initialLayoutId={initialLayoutId}
            initialRoomId={initialRoomId}
            selectionControls={
              <section className={styles.gallerySetup} aria-labelledby="builder-title">
                <div className={styles.gallerySetupHeader}>
                  <div>
                    <p className={styles.wallControlLabel}>Step 1: Choose your gallery</p>
                    <h2 id="builder-title">Choose one or three artworks</h2>
                  </div>
                  <span aria-live="polite">
                    {selectedProducts.length}/{quantity}
                    <small>{progressLabel}</small>
                  </span>
                </div>

                <fieldset className={styles.quantityFieldset}>
                  <legend>Number of artworks</legend>
                  <div className={styles.quantityChoices}>
                    <button
                      type="button"
                      className={quantity === 1 ? styles.quantityChoiceActive : ""}
                      aria-pressed={quantity === 1}
                      onClick={() => handleQuantityChange(1)}
                    >
                      <strong>1 print</strong>
                      <small>One favorite</small>
                    </button>
                    <button
                      type="button"
                      className={quantity === 3 ? styles.quantityChoiceActive : ""}
                      aria-pressed={quantity === 3}
                      onClick={() => handleQuantityChange(3)}
                    >
                      <strong>Set of 3</strong>
                      <small>Save 15%</small>
                    </button>
                  </div>
                </fieldset>
              </section>
            }
          >
            <div className={styles.configurationColumn}>
              <div className={styles.configurationGrid}>
                <ProductOptionSelector
                  quantity={quantity}
                  option={selectedOption}
                  selectedOptionId={selectedOptionId}
                  frameColor={frameColor}
                  onChange={setSelectedOptionId}
                  onFrameColorChange={setFrameColor}
                />
              </div>
              <section className={styles.checkoutSummary} id="set-checkout">
                <div>
                  <p className={styles.eyebrow}>Step 3: Review your order</p>
                  <h2>{selectedProducts.map((product) => product.title).join(" \u00b7 ")}</h2>
                  <p>
                    {quantity === 3 ? "Three" : "One"}{" "}
                    {selectedOption.label.toLowerCase()}
                    {selectedOption.format === "Framed"
                      ? " \u00b7 " + frameColor + " frame"
                      : ""}
                    {" \u00b7 "}
                    {quantity === 3 ? <s>{formatUsd(price.retailTotalCents)}</s> : null}{" "}
                    <strong>{formatUsd(price.totalPriceCents)}</strong> total
                  </p>
                  {quantity === 3 ? (
                    <p className={styles.savingsNote}>
                      Set savings: {formatUsd(price.savingsCents)}
                    </p>
                  ) : null}
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
                        ? "Checkout \u00b7 " + formatUsd(price.totalPriceCents)
                        : "Checkout Coming Soon"}
                  </button>
                  {!checkoutConfigured ? (
                    <p>
                      Checkout is being prepared for the new framed options.
                    </p>
                  ) : null}
                </div>
              </section>
              {!ready ? (
                <div className={styles.selectionPrompt}>
                  <strong>{quantity - selectedProducts.length} more to choose</strong>
                  <p>Your empty frame is waiting above.</p>
                </div>
              ) : null}
            </div>
          </GalleryPreview>
        </div>
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
          ["Ready to display", "Print only or framed with clear acrylic"],
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
              Yes, when you select a framed option. Choose natural, black, or white,
              with or without a white mat. Print-only orders arrive unframed.
            </p>
          </details>
          <details>
            <summary>What print sizes exist?</summary>
            <p>
              Choose 8x10 or 11x14 artwork. A matted 8x10 arrives in an 11x14 frame,
              while a matted 11x14 arrives in a 16x20 frame.
            </p>
          </details>
          <details>
            <summary>Is framed artwork made with glass?</summary>
            <p>
              Framed pieces use optical-grade clear acrylic instead of traditional
              glass for safer, lighter, and more durable display.
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
        quantity={quantity}
        frameColor={frameColor}
        busy={busy}
        checkoutConfigured={checkoutConfigured}
        onAction={beginCheckout}
      />
    </main>
  );
}
