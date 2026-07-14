import type { ExplorerProduct } from "@/lib/explorers/products";
import type { ExplorerSetOption } from "@/lib/explorers/buildASet";
import styles from "./BuildASet.module.css";

type MobileSetSummaryProps = {
  products: ExplorerProduct[];
  option: ExplorerSetOption;
  busy: boolean;
  checkoutConfigured: boolean;
  onAction: () => void;
};

export function MobileSetSummary({
  products,
  option,
  busy,
  checkoutConfigured,
  onAction,
}: MobileSetSummaryProps) {
  const ready = products.length === 3;

  return (
    <aside className={styles.mobileSummary} aria-label="Set purchase summary">
      <div>
        <strong>{ready ? products.map((product) => product.title).join(", ") : `${products.length} of 3 selected`}</strong>
        <span>{ready ? `${option.label} · ${(option.totalPriceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : "Choose three Explorers"}</span>
      </div>
      <button type="button" onClick={onAction} disabled={busy}>
        {busy
          ? "Opening..."
          : ready && checkoutConfigured
            ? "Checkout"
            : ready
              ? "Review Set"
              : "Choose Prints"}
      </button>
    </aside>
  );
}

