import type { ExplorerProduct } from "@/lib/explorers/products";
import {
  formatUsd,
  getExplorerOrderPrice,
  type ExplorerFrameColor,
  type ExplorerOrderQuantity,
  type ExplorerSetOption,
} from "@/lib/explorers/buildASet";
import styles from "./BuildASet.module.css";

type MobileSetSummaryProps = {
  products: ExplorerProduct[];
  option: ExplorerSetOption;
  quantity: ExplorerOrderQuantity;
  frameColor: ExplorerFrameColor;
  busy: boolean;
  checkoutConfigured: boolean;
  onAction: () => void;
};

export function MobileSetSummary({
  products,
  option,
  quantity,
  frameColor,
  busy,
  checkoutConfigured,
  onAction,
}: MobileSetSummaryProps) {
  const ready = products.length === quantity;
  const price = getExplorerOrderPrice(option, quantity);
  const finish =
    option.format === "Framed" ? frameColor + " frame" : "print only";

  return (
    <aside className={styles.mobileSummary} aria-label="Purchase summary">
      <div>
        <strong>
          {ready
            ? products.map((product) => product.title).join(", ")
            : products.length + " of " + quantity + " selected"}
        </strong>
        <span>
          {ready
            ? option.size + " " + finish + " \u00b7 " + formatUsd(price.totalPriceCents)
            : "Choose your Explorers"}
        </span>
      </div>
      <button type="button" onClick={onAction} disabled={busy}>
        {busy
          ? "Opening..."
          : ready && checkoutConfigured
            ? "Checkout"
            : ready
              ? "Review"
              : "Choose"}
      </button>
    </aside>
  );
}

