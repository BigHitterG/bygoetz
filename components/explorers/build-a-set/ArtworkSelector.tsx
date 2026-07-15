import type { ExplorerProduct } from "@/lib/explorers/products";
import { ArtworkImage } from "../ArtworkImage";
import styles from "./BuildASet.module.css";

type ArtworkSelectorProps = {
  products: ExplorerProduct[];
  selectedSlugs: Array<string | null>;
  onToggle: (product: ExplorerProduct) => void;
};

export function ArtworkSelector({
  products,
  selectedSlugs,
  onToggle,
}: ArtworkSelectorProps) {
  return (
    <div className={styles.artworkGrid}>
      {products.map((product) => {
        const selectionIndex = selectedSlugs.indexOf(product.slug);
        const selected = selectionIndex >= 0;

        return (
          <button
            className={`${styles.artworkCard} ${selected ? styles.artworkCardSelected : ""}`}
            type="button"
            key={product.slug}
            aria-pressed={selected}
            aria-label={`${selected ? "Remove" : "Select"} ${product.title}`}
            onClick={() => onToggle(product)}
          >
            <span className={styles.artworkCardImage}>
              <ArtworkImage src={product.image} title={product.title} />
            </span>
            <span className={styles.artworkCardFooter}>
              <span>{product.title}</span>
              <span className={styles.selectionMark} aria-hidden="true">
                {selected ? selectionIndex + 1 : "+"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

