import {
  findExplorerSetOption,
  formatUsd,
  getExplorerOrderPrice,
  type ExplorerFrameColor,
  type ExplorerOrderQuantity,
  type ExplorerSetOption,
  type ExplorerSetOptionId,
} from "@/lib/explorers/buildASet";
import styles from "./BuildASet.module.css";

type ProductOptionSelectorProps = {
  quantity: ExplorerOrderQuantity;
  option: ExplorerSetOption;
  selectedOptionId: ExplorerSetOptionId;
  frameColor: ExplorerFrameColor;
  onChange: (optionId: ExplorerSetOptionId) => void;
  onFrameColorChange: (color: ExplorerFrameColor) => void;
};

const frameColors: { id: ExplorerFrameColor; label: string }[] = [
  { id: "natural", label: "Natural" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
];

export function ProductOptionSelector({
  quantity,
  option,
  selectedOptionId,
  frameColor,
  onChange,
  onFrameColorChange,
}: ProductOptionSelectorProps) {
  const price = getExplorerOrderPrice(option, quantity);

  function selectOption(
    size: ExplorerSetOption["size"],
    format: ExplorerSetOption["format"],
    isMatted: boolean,
  ) {
    const next = findExplorerSetOption(size, format, isMatted);
    if (next) onChange(next.id);
  }

  return (
    <section className={styles.optionPanel} aria-labelledby="finish-title">
      <div className={styles.optionPanelHeading}>
        <p className={styles.eyebrow}>Finish your order</p>
        <h2 id="finish-title">Choose size and finish</h2>
      </div>

      <fieldset className={styles.compactFieldset}>
        <legend>Format</legend>
        <div className={styles.largeSegmentedChoices}>
          {(["Print only", "Framed"] as const).map((format) => (
            <button
              type="button"
              key={format}
              className={option.format === format ? styles.largeSegmentActive : ""}
              aria-pressed={option.format === format}
              onClick={() => selectOption(option.size, format, format === "Framed" && option.isMatted)}
            >
              <strong>{format}</strong>
              <small>
                {format === "Print only"
                  ? `from ${formatUsd(quantity === 3 ? 7395 : 2900)}`
                  : `from ${formatUsd(quantity === 3 ? 16575 : 6500)}`}
              </small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.compactFieldset}>
        <legend>{option.format === "Framed" ? "Artwork size" : "Print size"}</legend>
        <div className={styles.pillChoices}>
          {(["8x10", "11x14"] as const).map((size) => (
            <button
              type="button"
              key={size}
              className={option.size === size ? styles.pillChoiceActive : ""}
              aria-pressed={option.size === size}
              onClick={() => selectOption(size, option.format, option.isMatted)}
            >
              {size}
            </button>
          ))}
        </div>
      </fieldset>

      {option.format === "Framed" ? (
        <>
          <fieldset className={styles.compactFieldset}>
            <legend>Framed print finishing</legend>
            <div className={styles.pillChoices}>
              <button
                type="button"
                className={option.isMatted ? styles.pillChoiceActive : ""}
                aria-pressed={option.isMatted}
                onClick={() => selectOption(option.size, "Framed", true)}
              >
                Mat
              </button>
              <button
                type="button"
                className={!option.isMatted ? styles.pillChoiceActive : ""}
                aria-pressed={!option.isMatted}
                onClick={() => selectOption(option.size, "Framed", false)}
              >
                No mat
              </button>
            </div>
          </fieldset>

          <fieldset className={styles.compactFieldset}>
            <legend>Frame color</legend>
            <div className={styles.frameColorChoices}>
              {frameColors.map((color) => (
                <button
                  type="button"
                  key={color.id}
                  className={frameColor === color.id ? styles.frameColorActive : ""}
                  aria-pressed={frameColor === color.id}
                  onClick={() => onFrameColorChange(color.id)}
                >
                  <i className={styles[`frameSwatch${color.id[0].toUpperCase()}${color.id.slice(1)}`]} aria-hidden="true" />
                  {color.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <div className={styles.optionDetails}>
        <div>
          <strong>{option.label}</strong>
          <span>{option.finishedSize}</span>
          <small>{option.note}</small>
        </div>
        <div className={styles.optionTotal}>
          {quantity === 3 ? <s>{formatUsd(price.retailTotalCents)}</s> : null}
          <strong>{formatUsd(price.totalPriceCents)}</strong>
          {quantity === 3 ? <small>15% set savings</small> : <small>one artwork</small>}
        </div>
      </div>

      {option.format === "Framed" ? (
        <p className={styles.acrylicNote}>
          Framed pieces arrive ready to hang with optical-grade clear acrylic instead of glass for safer, lighter display.
        </p>
      ) : null}

      <input type="hidden" value={selectedOptionId} readOnly />
    </section>
  );
}

