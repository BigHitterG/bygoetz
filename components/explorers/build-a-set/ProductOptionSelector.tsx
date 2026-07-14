import {
  explorerSetOptions,
  formatUsd,
  type ExplorerSetOptionId,
} from "@/lib/explorers/buildASet";
import styles from "./BuildASet.module.css";

type ProductOptionSelectorProps = {
  selectedOptionId: ExplorerSetOptionId;
  onChange: (optionId: ExplorerSetOptionId) => void;
};

export function ProductOptionSelector({
  selectedOptionId,
  onChange,
}: ProductOptionSelectorProps) {
  return (
    <fieldset className={styles.optionFieldset}>
      <legend>Choose your print option</legend>
      <p className={styles.optionIntro}>
        Every option contains three physical prints. Select one size and finish for the
        entire set.
      </p>
      <div className={styles.optionGrid}>
        {explorerSetOptions.map((option) => (
          <label
            className={`${styles.optionCard} ${
              selectedOptionId === option.id ? styles.optionCardSelected : ""
            }`}
            key={option.id}
          >
            <input
              type="radio"
              name="explorer-set-option"
              value={option.id}
              checked={selectedOptionId === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className={styles.optionCardHeader}>
              <strong>{option.label}</strong>
              <span className={styles.optionPrice}>
                <s>{formatUsd(option.retailTotalCents)}</s>
                <strong>{formatUsd(option.totalPriceCents)}</strong>
              </span>
            </span>
            <span>{option.finishedSize}</span>
            <small>
              Save {formatUsd(option.savingsCents)} on three prints
            </small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

