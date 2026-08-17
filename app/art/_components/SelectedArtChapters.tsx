import Image from "next/image";
import Link from "next/link";
import { artLandingPlacements } from "@/lib/art/catalog";
import {
  getArtSeriesById,
  getArtworkById,
  getArtMedia,
  getMediaForTarget,
} from "@/lib/art/selectors";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "./SelectedArtChapters.module.css";

function formatDimensions(width: number, height: number, unit: "in" | "cm") {
  return `${width} × ${height} ${unit}.`;
}

export function SelectedArtChapters() {
  return (
    <div className={styles.chapters}>
      {artLandingPlacements.map((placement) => {
        if (placement.kind === "artwork") {
          const artwork = getArtworkById(placement.id);
          if (!artwork) return null;

          const media = getArtMedia(artwork.primaryMediaId);
          if (!media) return null;

          return (
            <article className={`${styles.chapter} ${styles.singleChapter}`} key={artwork.id}>
              <Link
                className={styles.singleImage}
                href={`/art/works/${artwork.slug}`}
                aria-label={`View ${artwork.title}`}
              >
                <Image
                  src={withSiteBasePath(media.src)}
                  alt={media.alt}
                  width={media.width}
                  height={media.height}
                  sizes="(max-width: 820px) 100vw, 48vw"
                />
              </Link>

              <div className={styles.chapterCopy}>
                <p className={styles.code}>Individual work / 02</p>
                <h3>{artwork.title}</h3>
                <p className={styles.summary}>{artwork.summary}</p>
                <dl className={styles.facts}>
                  <div>
                    <dt>Medium</dt>
                    <dd>{artwork.medium}</dd>
                  </div>
                  {artwork.dimensions?.artwork ? (
                    <div>
                      <dt>Artwork</dt>
                      <dd>
                        {formatDimensions(
                          artwork.dimensions.artwork.width,
                          artwork.dimensions.artwork.height,
                          artwork.dimensions.artwork.unit,
                        )}
                      </dd>
                    </div>
                  ) : null}
                  {artwork.dimensions?.framed ? (
                    <div>
                      <dt>Presented</dt>
                      <dd>
                        Matted under glass in an{" "}
                        {formatDimensions(
                          artwork.dimensions.framed.width,
                          artwork.dimensions.framed.height,
                          artwork.dimensions.framed.unit,
                        )}{" "}
                        frame
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <Link className={styles.textLink} href={`/art/works/${artwork.slug}`}>
                  View the work <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>
          );
        }

        const series = getArtSeriesById(placement.id);
        if (!series) return null;

        const media = getMediaForTarget({ kind: "series", id: series.id });

        if (placement.layout === "lead") {
          const [cover, ...details] = media;
          if (!cover) return null;

          return (
            <article className={`${styles.chapter} ${styles.leadChapter}`} key={series.id}>
              <div className={styles.leadMedia}>
                <Link
                  className={styles.leadImage}
                  href={`/art/series/${series.slug}`}
                  aria-label={`Enter the ${series.title} body of work`}
                >
                  <Image
                    src={withSiteBasePath(cover.src)}
                    alt={cover.alt}
                    width={cover.width}
                    height={cover.height}
                    sizes="(max-width: 820px) 100vw, 66vw"
                  />
                </Link>
                <div
                  className={styles.detailRail}
                  role="group"
                  aria-label={`${series.title} material details`}
                >
                  {details.slice(0, 2).map((detail) => (
                    <figure key={detail.id}>
                      <Image
                        src={withSiteBasePath(detail.src)}
                        alt={detail.alt}
                        width={detail.width}
                        height={detail.height}
                        sizes="(max-width: 820px) 50vw, 22vw"
                      />
                    </figure>
                  ))}
                </div>
              </div>

              <div className={styles.leadCopy}>
                <p className={styles.code}>Body of work / 01</p>
                <h3>{series.title}</h3>
                <p className={styles.summary}>{series.summary}</p>
                <p>{series.statement}</p>
                <Link className={styles.textLink} href={`/art/series/${series.slug}`}>
                  Enter the body of work <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>
          );
        }

        return (
          <article className={`${styles.chapter} ${styles.pairChapter}`} key={series.id}>
            <div className={styles.pairHeading}>
              <p className={styles.code}>Ongoing series / 03</p>
              <h3>{series.title}</h3>
              <p className={styles.summary}>{series.summary}</p>
              <Link className={styles.textLink} href={`/art/series/${series.slug}`}>
                View the series <span aria-hidden="true">↗</span>
              </Link>
            </div>

            <div className={styles.pairMedia}>
              {media.slice(0, 2).map((item) => (
                <Link
                  key={item.id}
                  href={`/art/series/${series.slug}`}
                  aria-label={`View ${item.caption ?? series.title}`}
                >
                  <Image
                    src={withSiteBasePath(item.src)}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                    sizes="(max-width: 820px) 100vw, 36vw"
                  />
                  <span>{item.caption}</span>
                </Link>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
