­r‡^Ñf¥–Ø¦{ìyÊ'vÃ®¶›­export type DigitalDownloadProduct = {
  key: string;
  title: string;
  priceCents: number;
  stripeProductIds: string[];
  storagePath: string;
};

export const explorerDigitalDownloadProducts: DigitalDownloadProduct[] = [
  {
    key: "explorers-complete-bundle",
    title: "Complete Explorers Digital Collection",
    priceCents: 999,
    stripeProductIds: ["prod_UqGrhnqtYzBN0Q"],
    storagePath: "bundles/Explorers_Complete_Digital_Collection.zip",
  },
  {
    key: "monkey-digital-file",
    title: "Monkey Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-monkey-digital-file"],
    storagePath: "individual/Monkey.zip",
  },
  {
    key: "dog-digital-file",
    title: "Dog Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-dog-digital-file"],
    storagePath: "individual/Dog.zip",
  },
  {
    key: "horse-digital-file",
    title: "Horse Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-horse-digital-file"],
    storagePath: "individual/Horse.zip",
  },
  {
    key: "cow-digital-file",
    title: "Cow Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-cow-digital-file"],
    storagePath: "individual/Cow.zip",
  },
  {
    key: "turtle-digital-file",
    title: "Turtle Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-turtle-digital-file"],
    storagePath: "individual/Turtle.zip",
  },
  {
    key: "owl-digital-file",
    title: "Owl Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-owl-digital-file"],
    storagePath: "individual/Owl.zip",
  },
  {
    key: "explorer-digital-file",
    title: "Explorer Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-explorer-digital-file"],
    storagePath: "individual/Explorer.zip",
  },
  {
    key: "snorkeler-digital-file",
    title: "Snorkeler Digital File",
    priceCents: 300,
    stripeProductIds: ["explorers-snorkeler-digital-file"],
    storagePath: "individual/Snorkeler.zip",
  },
];

const productsByStripeProductId = new Map(
  explorerDigitalDownloadProducts.flatMap((product) =>
    product.stripeProductIds.map((stripeProductId) => [stripeProductId, product] as const),
  ),
);

const productsByKey = new Map(
  explorerDigitalDownloadProducts.map((product) => [product.key, product] as const),
);

export function getDigitalDownloadProductByStripeProductId(stripeProductId: string) {
  return productsByStripeProductId.get(stripeProductId);
}

export function getDigitalDownloadProductByKey(productKey: string) {
  return productsByKey.get(productKey);
}
