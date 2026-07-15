export const explorerOrderQuantities = [1, 3] as const;

export type ExplorerOrderQuantity = (typeof explorerOrderQuantities)[number];
export type ExplorerFrameColor = "natural" | "black" | "white";
export type ExplorerSetOptionId =
  | "8x10-print"
  | "8x10-framed"
  | "8x10-framed-mat"
  | "11x14-print"
  | "11x14-framed"
  | "11x14-framed-mat";

export type ExplorerSetOption = {
  id: ExplorerSetOptionId;
  label: string;
  format: "Print only" | "Framed";
  size: "8x10" | "11x14";
  artworkSize: string;
  finishedSize: string;
  finishedWidth: number;
  finishedHeight: number;
  isMatted: boolean;
  singlePriceCents: number;
  setPriceCents: number;
  note: string;
};

export const explorerSetOptions: ExplorerSetOption[] = [
  {
    id: "8x10-print",
    label: "8x10 print",
    format: "Print only",
    size: "8x10",
    artworkSize: "8 x 10 in artwork",
    finishedSize: "8 x 10 in print",
    finishedWidth: 8,
    finishedHeight: 10,
    isMatted: false,
    singlePriceCents: 2900,
    setPriceCents: 7395,
    note: "Archival art print, ready for your own frame",
  },
  {
    id: "8x10-framed",
    label: "8x10 framed print",
    format: "Framed",
    size: "8x10",
    artworkSize: "8 x 10 in artwork",
    finishedSize: "8 x 10 in frame",
    finishedWidth: 8,
    finishedHeight: 10,
    isMatted: false,
    singlePriceCents: 6500,
    setPriceCents: 16575,
    note: "Ready to hang with optical-grade clear acrylic",
  },
  {
    id: "8x10-framed-mat",
    label: "8x10 framed print with mat",
    format: "Framed",
    size: "8x10",
    artworkSize: "8 x 10 in artwork",
    finishedSize: "11 x 14 in finished frame",
    finishedWidth: 11,
    finishedHeight: 14,
    isMatted: true,
    singlePriceCents: 7900,
    setPriceCents: 20145,
    note: "White mat and optical-grade clear acrylic",
  },
  {
    id: "11x14-print",
    label: "11x14 print",
    format: "Print only",
    size: "11x14",
    artworkSize: "11 x 14 in artwork",
    finishedSize: "11 x 14 in print",
    finishedWidth: 11,
    finishedHeight: 14,
    isMatted: false,
    singlePriceCents: 3900,
    setPriceCents: 9945,
    note: "Larger archival art print, ready for your own frame",
  },
  {
    id: "11x14-framed",
    label: "11x14 framed print",
    format: "Framed",
    size: "11x14",
    artworkSize: "11 x 14 in artwork",
    finishedSize: "11 x 14 in frame",
    finishedWidth: 11,
    finishedHeight: 14,
    isMatted: false,
    singlePriceCents: 8900,
    setPriceCents: 22695,
    note: "Ready to hang with optical-grade clear acrylic",
  },
  {
    id: "11x14-framed-mat",
    label: "11x14 framed print with mat",
    format: "Framed",
    size: "11x14",
    artworkSize: "11 x 14 in artwork",
    finishedSize: "16 x 20 in finished frame",
    finishedWidth: 16,
    finishedHeight: 20,
    isMatted: true,
    singlePriceCents: 11900,
    setPriceCents: 30345,
    note: "White mat and optical-grade clear acrylic",
  },
];

export function getExplorerSetOption(id: string) {
  return explorerSetOptions.find((option) => option.id === id);
}

export function findExplorerSetOption(
  size: ExplorerSetOption["size"],
  format: ExplorerSetOption["format"],
  isMatted: boolean,
) {
  return explorerSetOptions.find(
    (option) =>
      option.size === size &&
      option.format === format &&
      option.isMatted === (format === "Framed" ? isMatted : false),
  );
}

export function getExplorerOrderPrice(
  option: ExplorerSetOption,
  quantity: ExplorerOrderQuantity,
) {
  const retailTotalCents = option.singlePriceCents * quantity;
  const totalPriceCents = quantity === 3 ? option.setPriceCents : option.singlePriceCents;

  return {
    retailTotalCents,
    totalPriceCents,
    savingsCents: retailTotalCents - totalPriceCents,
  };
}

export function formatUsd(cents: number) {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

