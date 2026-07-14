import type { ExplorerProduct } from "@/lib/explorers/products";
import type { ExplorerSetOption } from "@/lib/explorers/buildASet";
import { ArtworkImage } from "../ArtworkImage";
import styles from "./BuildASet.module.css";

type GalleryPreviewProps = {
  products: ExplorerProduct[];
  option: ExplorerSetOption;
};

export function GalleryPreview({ products, option }: GalleryPreviewProps) {
  const isMatted = option.format === "Matted print";
  const isElevenByFourteen = option.id.startsWith("11x14");

  return (
    <section className={styles.galleryPreview} aria-labelledby="gallery-preview-title">
      <div className={styles.previewCopy}>
        <p className={styles.eyebrow}>Your gallery wall</p>
        <h2 id="gallery-preview-title">See the set together.</h2>
        <p>
          The preview keeps each artwork proportional and updates with your selected
          print and mat option. Frames are not included.
        </p>
      </div>
      <div className={styles.previewRoom}>
        <div className={styles.previewPrints}>
          {products.map((product) => (
            <div
              className={`${styles.previewSheet} ${
                isElevenByFourteen ? styles.previewElevenByFourteen : styles.previewEightByTen
              } ${isMatted ? styles.previewMatted : ""}`}
              key={product.slug}
            >
              <ArtworkImage src={product.image} title={product.title} />
            </div>
          ))}
        </div>
        <div className={styles.previewBench} aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

