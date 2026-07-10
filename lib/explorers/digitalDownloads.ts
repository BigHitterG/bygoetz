export type DigitalDownloadProduct = {
  key: string;
  title: string;
  stripeProductIds: string[];
  storagePath: string;
};

export const explorerDigitalDownloadProducts: DigitalDownloadProduct[] = [
  {
    key: "explorers-complete-bundle",
    title: "Complete Explorers Digital Collection",
    stripeProductIds: ["prod_UqGrhnqtYzBN0Q"],
    storagePath: "bundles/Explorers_Complete_Digital_Collection.zip",
  },
  {
    key: "monkey-digital-file",
    title: "Monkey Digital File",
    stripeProductIds: ["explorers-monkey-digital-file"],
    storagePath: "individual/Monkey.zip",
  },
  {
    key: "dog-digital-file",
    title: "Dog Digital File",
    stripeProductIds: ["explorers-dog-digital-file"],
    storagePath: "individual/Dog.zip",
  },
  {
    key: "horse-digital-file",
    title: "Horse Digital File",
    stripeProductIds: ["explorers-horse-digital-file"],
    storagePath: "individual/Horse.zip",
  },
  {
    key: "cow-digital-file",
    title: "Cow Digital File",
    stripeProductIds: ["explorers-cow-digital-file"],
    storagePath: "individual/Cow.zip",
  },
  {
    key: "turtle-digital-file",
    title: "Turtle Digital File",
    stripeProductIds: ["explorers-turtle-digital-file"],
    storagePath: "individual/Turtle.zip",
  },
  {
    key: "owl-digital-file",
    title: "Owl Digital File",
    stripeProductIds: ["explorers-owl-digital-file"],
    storagePath: "individual/Owl.zip",
  },
  {
    key: "explorer-digital-file",
    title: "Explorer Digital File",
    stripeProductIds: ["explorers-explorer-digital-file"],
    storagePath: "individual/Explorer.zip",
  },
  {
    key: "snorkeler-digital-file",
    title: "Snorkeler Digital File",
    stripeProductIds: ["explorers-snorkeler-digital-file"],
    storagePath: "individual/Snorkeler.zip",
  },
];

const productsByStripeProductId = new Map(
  explorerDigitalDownloadProducts.flatMap((product) =>
    product.stripeProductIds.map((stripeProductId) => [stripeProductId, product] as const),
  ),
);

export function getDigitalDownloadProductByStripeProductId(stripeProductId: string) {
  return productsByStripeProductId.get(stripeProductId);
}
