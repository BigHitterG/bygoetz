import Image from "next/image";
import cribScene from "@/public/explorers/rooms/crib.jpg";
import dresserScene from "@/public/explorers/rooms/dresser.jpg";
import heroMobileScene from "@/public/explorers/rooms/explorers-hero-mobile-v2.webp";
import heroScene from "@/public/explorers/rooms/explorers-hero-v2.webp";
import twinBedScene from "@/public/explorers/rooms/twin-bed.jpg";
import { explorerDigitalBundle, explorerProducts } from "@/lib/explorers/products";
import { withSiteBasePath } from "@/lib/sitePath";
import { ArtworkImage } from "./ArtworkImage";
import { DigitalCheckoutButton } from "./DigitalCheckoutButton";
import styles from "./Explorers.module.css";

const heroProducts = [explorerProducts[0], explorerProducts[6], explorerProducts[2]];

export function ExplorersPage() {
  const digitalBundleCta = explorerDigitalBundle.checkoutLink
    ? "Download the Collection"
    : "Preview Digital Bundle";
  const digitalBundleHref = explorerDigitalBundle.checkoutLink
    ? explorerDigitalBundle.checkoutLink
    : withSiteBasePath("/explorers/digital-downloads");

  return (
    <main className={`${styles.page} ${styles.landingPage}`}>
      <section className={styles.hero} aria-labelledby="explorers-hero-title">
        <Image
          className={`${styles.heroBackdrop} ${styles.heroBackdropDesktop}`}
          src={heroScene}
          alt="A warm children's reading room with a child moving past a low sofa"
          fill
          priority
          placeholder="blur"
          sizes="100vw"
        />
        <Image
          className={`${styles.heroBackdrop} ${styles.heroBackdropMobile}`}
          src={heroMobileScene}
          alt="A warm children's reading room with a child walking beside a low sofa"
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 620px) 100vw, 1px"
        />
        <div className={styles.heroVeil} aria-hidden="true" />

        <div className={styles.heroWallArt} aria-label="Featured Explorers prints shown in a room">
          {heroProducts.map((product, index) => (
            <a
              className={styles.heroWallFrame}
              href={withSiteBasePath(`/explorers/products/${product.slug}`)}
              key={product.slug}
              aria-label={`View the ${product.title} print`}
            >
              <ArtworkImage
                src={product.image}
                title={product.title}
                loading="eager"
                fetchPriority={index === 1 ? "high" : "auto"}
              />
            </a>
          ))}
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>Original art for curious rooms</p>
          <h1 id="explorers-hero-title">The Explorers Series</h1>
          <p className={styles.heroTagline}>Art for rooms where imagination lives.</p>
          <div className={styles.heroActions}>
            <a
              href={withSiteBasePath("/explorers/build-a-set")}
              className={styles.primaryButton}
            >
              Design Your Wall
            </a>
            <a href="#collection" className={styles.heroSecondaryButton}>
              Shop the Collection
            </a>
          </div>
          <p className={styles.heroProof}>8 original artworks · prints from $29</p>
        </div>

        <a className={styles.heroScrollCue} href="#collection">
          <span>Explore the collection</span>
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section className={styles.collectionSection} id="collection">
        <div className={styles.sectionIntroRow}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>The collection</p>
            <h2>Meet the Explorers.</h2>
            <p>Choose one favorite, or bring home a crew.</p>
          </div>
          <a
            className={styles.collectionBundleLink}
            href={withSiteBasePath("/explorers/build-a-set")}
          >
            Preview prints and frames on your wall <span aria-hidden="true">→</span>
          </a>
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
                  <p>Prints, framed artwork &amp; digital files</p>
                </div>
                <div className={styles.productMeta}>
                  <span>From {product.priceFrom}</span>
                  <a href={withSiteBasePath(`/explorers/products/${product.slug}`)}>
                    View Artwork
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.roomStories} aria-labelledby="room-stories-title">
        <div className={styles.roomStoriesHeader}>
          <p className={styles.eyebrow}>See them at home</p>
          <h2 id="room-stories-title">A little wonder changes the whole room.</h2>
        </div>

        <div className={styles.roomStoryGrid}>
          <article className={`${styles.roomStory} ${styles.roomStoryWide}`}>
            <Image
              className={styles.roomStoryImage}
              src={twinBedScene}
              alt="A bright child's bedroom with Explorers prints above the bed"
              fill
              placeholder="blur"
              sizes="(max-width: 900px) 100vw, 67vw"
            />
            <div className={`${styles.roomArtwork} ${styles.twinBedArtwork}`}>
              {[explorerProducts[1], explorerProducts[2], explorerProducts[5]].map((product) => (
                <a
                  className={styles.roomFrame}
                  href={withSiteBasePath(`/explorers/products/${product.slug}`)}
                  key={product.slug}
                  aria-label={`View the ${product.title} print`}
                >
                  <ArtworkImage src={product.image} title={product.title} />
                </a>
              ))}
            </div>
            <div className={styles.roomStoryCaption}>
              <span>Bright bedroom</span>
              <strong>Build a trio</strong>
            </div>
          </article>

          <article className={styles.roomStory}>
            <Image
              className={styles.roomStoryImage}
              src={cribScene}
              alt="A calm nursery with an Explorer print above the crib"
              fill
              placeholder="blur"
              sizes="(max-width: 900px) 100vw, 33vw"
            />
            <div className={`${styles.roomArtwork} ${styles.cribArtwork}`}>
              <a
                className={styles.roomFrame}
                href={withSiteBasePath("/explorers/products/explorer")}
                aria-label="View the Explorer print"
              >
                <ArtworkImage
                  src={explorerProducts[6].image}
                  title={explorerProducts[6].title}
                />
              </a>
            </div>
            <div className={styles.roomStoryCaption}>
              <span>Calm nursery</span>
              <strong>One bright focal point</strong>
            </div>
          </article>

          <article className={styles.roomStory}>
            <Image
              className={styles.roomStoryImage}
              src={dresserScene}
              alt="A warm playroom with two Explorers prints above a wooden dresser"
              fill
              placeholder="blur"
              sizes="(max-width: 900px) 100vw, 33vw"
            />
            <div className={`${styles.roomArtwork} ${styles.dresserArtwork}`}>
              {[explorerProducts[3], explorerProducts[4]].map((product) => (
                <a
                  className={styles.roomFrame}
                  href={withSiteBasePath(`/explorers/products/${product.slug}`)}
                  key={product.slug}
                  aria-label={`View the ${product.title} print`}
                >
                  <ArtworkImage src={product.image} title={product.title} />
                </a>
              ))}
            </div>
            <div className={styles.roomStoryCaption}>
              <span>Playroom corner</span>
              <strong>Pair their favorites</strong>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.digitalBundleSection} aria-label="Digital collection bundle">
        <aside className={styles.digitalBundleCard}>
          <div className={styles.bundleArtworkFrame}>
            <ArtworkImage src={explorerDigitalBundle.image} title="Explorer" />
          </div>
          <div className={styles.bundleCopy}>
            <p className={styles.eyebrow}>The whole world, instantly</p>
            <h2>{explorerDigitalBundle.title}</h2>
            <p>{explorerDigitalBundle.description}</p>
            <div className={styles.priceStack}>
              <span>{explorerDigitalBundle.compareAtPrice} value</span>
              <strong>{explorerDigitalBundle.price}</strong>
            </div>
            <div className={styles.bundleFacts} aria-label="Bundle contents">
              <span><strong>8</strong> artworks</span>
              <span><strong>32</strong> files</span>
              <span><strong>2</strong> print sizes</span>
            </div>
            {explorerDigitalBundle.checkoutLink ? (
              <DigitalCheckoutButton
                className={styles.primaryButton}
                productKey="explorers-complete-bundle"
                productTitle="Complete Explorers Digital Collection"
                value={9.99}
              >
                {digitalBundleCta}
              </DigitalCheckoutButton>
            ) : (
              <a className={styles.primaryButton} href={digitalBundleHref}>{digitalBundleCta}</a>
            )}
          </div>
        </aside>
      </section>

      <section className={styles.qualitySection} aria-label="Print and framing details">
        {[
          "Museum-quality prints",
          "Archival paper",
          "Three frame finishes",
          "Designed as a collection",
        ].map((point) => (
          <div className={styles.qualityItem} key={point}>
            <span />
            <p>{point}</p>
          </div>
        ))}
      </section>

      <section className={styles.finalCta}>
        <p className={styles.eyebrow}>Make the room theirs</p>
        <h2>Start with one Explorer.</h2>
        <div className={styles.finalCtaActions}>
          <a href={withSiteBasePath("/explorers/build-a-set")} className={styles.primaryButton}>
            Design Your Wall
          </a>
          <a href="#collection" className={styles.secondaryButton}>
            Shop All Prints
          </a>
        </div>
      </section>
    </main>
  );
}
