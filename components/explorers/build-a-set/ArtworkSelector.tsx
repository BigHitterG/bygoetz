import type { ExplorerProduct } from "@/lib/explorers/products";
import { ArtworkImage } from "../ArtworkImage";
import styles from "./BuildASet.module.css";

type ArtworkSelectorProps = {
  products: ExplorerProduct[];
  selectedSlugs: Array<string | null>;
  activeIndex: number;
  onSelect: (product: ExplorerProduct) => void;
};

export function ArtworkSelector({
  products,
  selectedSlugs,
  activeIndex,
  onSelect,
}: ArtworkSelectorProps) {
  return (
    <div className={styles.artworkPickerGrid}>
      {products.map((product) => {
        const selectionIndex = selectedSlugs.indexOf(product.slug);
        const selected = selectionIndex >= 0;
        const selectedHere = selectionIndex === activeIndex;

        return (
          <button
            className={`${styles.artworkPickerCard} ${selectedHere ? styles.artworkPickerCardSelected : ""}`}
            type="button"
            key={product.slug}
            aria-pressed={selectedHere}
            aria-label={`Choose ${product.title}${selected ? `, currently in position ${selectionIndex + 1}` : ""}`}
            onClick={() => onSelect(product)}
          >
            <span className={styles.artworkPickerImage}>
              <ArtworkImage src={product.image} title={product.title} />
            </span>
            <span className={styles.artworkPickerFooter}>
              <strong>{product.title}</strong>
              <small>
                {selectedHere
                  ? "Current selection"
                  : selected
                    ? `Position ${selectionIndex + 1} \u00b7 tap to swap`
                    : "Tap to choose"}
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

