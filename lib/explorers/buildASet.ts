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
  totalPriceCents: number;
  note?: string;
};

const optionIds: ExplorerSetOptionId[] = [
  "8x10-print",
  "8x10-matted",
  "11x14-print",
  "11x14-matted",
];

function priceToCents(price: string) {
  return Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100);
}

export const explorerSetOptions: ExplorerSetOption[] =
  explorerProducts[0].printOptions.map((option, index) => {
    const unitPriceCents = priceToCents(option.price);

    return {
      id: optionIds[index],
      label: option.label,
      format: option.format,
      artworkSize: option.artworkSize,
      finishedSize: option.finishedSize,
      unitPriceCents,
      totalPriceCents: unitPriceCents * explorerSetSize,
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

