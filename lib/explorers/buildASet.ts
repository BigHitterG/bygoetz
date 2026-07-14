import { explorerProducts } from "./products";

export const explorerSetSize = 3;

export type ExplorerSetOptionId =
  | "8x10-print"
  | "8x10-matted"
  | "11x14-print"
  | "11x14-matted";

export type ExplorerSetOption = {
  id: ExplorerSetOptionId;
  label: string;
  format: string;
  artworkSize: string;
  finishedSize: string;
  unitPriceCents: number;
  retailTotalCents: number;
  totalPriceCents: number;
  savingsCents: number;
  note?: string;
};

const optionIds: ExplorerSetOptionId[] = [
  "8x10-print",
  "8x10-matted",
  "11x14-print",
  "11x14-matted",
];

const setPrices: Record<ExplorerSetOptionId, number> = {
  "8x10-print": 8900,
  "8x10-matted": 12900,
  "11x14-print": 16500,
  "11x14-matted": 23900,
};

function priceToCents(price: string) {
  return Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100);
}

export const explorerSetOptions: ExplorerSetOption[] =
  explorerProducts[0].printOptions.map((option, index) => {
    const unitPriceCents = priceToCents(option.price);
    const id = optionIds[index];
    const retailTotalCents = unitPriceCents * explorerSetSize;
    const totalPriceCents = setPrices[id];

    return {
      id,
      label: option.label,
      format: option.format,
      artworkSize: option.artworkSize,
      finishedSize: option.finishedSize,
      unitPriceCents,
      retailTotalCents,
      totalPriceCents,
      savingsCents: retailTotalCents - totalPriceCents,
      note: option.note,
    };
  });

export function getExplorerSetOption(id: string) {
  return explorerSetOptions.find((option) => option.id === id);
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

