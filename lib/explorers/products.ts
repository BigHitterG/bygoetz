export type ExplorerPrintOption = {
  label: string;
  format: string;
  artworkSize: string;
  finishedSize: string;
  price: string;
  note?: string;
};

export type ExplorerProduct = {
  title: string;
  slug: string;
  image: string;
  description: string;
  priceFrom: string;
  digitalPrice: string;
  printOptions: ExplorerPrintOption[];
  stripePaymentLink: string;
  digitalPaymentLink: string;
  featured?: boolean;
};

export type ExplorerDigitalBundle = {
  title: string;
  price: string;
  compareAtPrice: string;
  image: string;
  description: string;
  includes: string[];
  checkoutLink: string;
};

export const explorerPrintOptions: ExplorerPrintOption[] = [
  {
    label: "8x10 print",
    format: "Unmatted print",
    artworkSize: "8 x 10 in artwork",
    finishedSize: "Ships as an 8 x 10 in print",
    price: "$35",
  },
  {
    label: "8x10 print, matted",
    format: "Matted print",
    artworkSize: "8 x 10 in artwork",
    finishedSize: "Matted to fit an 11 x 14 in frame",
    price: "$50",
  },
  {
    label: "11x14 print",
    format: "Unmatted print",
    artworkSize: "11 x 14 in artwork",
    finishedSize: "Ships as an 11 x 14 in print",
    price: "Coming soon",
    note: "Larger wall-friendly size",
  },
  {
    label: "11x14 print, matted",
    format: "Matted print",
    artworkSize: "11 x 14 in artwork",
    finishedSize: "Matted to fit a 16 x 20 in frame",
    price: "Coming soon",
    note: "Standard larger frame-ready size",
  },
];

export const explorerDigitalBundle: ExplorerDigitalBundle = {
  title: "Complete Digital Collection",
  price: "$9.99",
  compareAtPrice: "$19.99",
  image: "/explorers/Explorer.png",
  description:
    "Get the full Explorers Series as high-resolution digital files for personal printing and creative projects.",
  includes: [
    "All eight Explorers artworks",
    "High-resolution PNG files",
    "Ready for personal prints and decor projects",
  ],
  checkoutLink: "https://buy.stripe.com/9B68wPbOh9mKgwv95Ggw000",
};

// TODO: Add final artwork files to public/explorers/ as they become available.
export const explorerProducts: ExplorerProduct[] = [
  {
    title: "Monkey",
    slug: "monkey",
    image: "/explorers/Monkey.png",
    description:
      "A bright geometric companion with expressive linework and a curious, playful presence.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
    featured: true,
  },
  {
    title: "Dog",
    slug: "dog",
    image: "/explorers/Dog.png",
    description:
      "A loyal study in bold color, simple form, and warm modern character.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Horse",
    slug: "horse",
    image: "/explorers/Horse.png",
    description:
      "Architectural shapes and confident lines give this explorer a quiet sense of motion.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Cow",
    slug: "cow",
    image: "/explorers/Cow.png",
    description:
      "A calm, graphic portrait made for bright rooms and thoughtful collections.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Turtle",
    slug: "turtle",
    image: "/explorers/Turtle.png",
    description:
      "A steady little explorer built from clean geometry and cheerful primary color.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Owl",
    slug: "owl",
    image: "/explorers/Owl.png",
    description:
      "A watchful modern owl with minimal forms, crisp contrast, and a wise gaze.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Explorer",
    slug: "explorer",
    image: "/explorers/Explorer.png",
    description:
      "A character print for rooms where imagination, learning, and discovery meet.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Snorkeler",
    slug: "snorkeler",
    image: "/explorers/Snorkeler.png",
    description:
      "An aquatic explorer with bright shapes, expressive details, and a sense of wonder.",
    priceFrom: "$35",
    digitalPrice: "$2",
    printOptions: explorerPrintOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
];

export function getExplorerProduct(slug: string) {
  return explorerProducts.find((product) => product.slug === slug);
}

export function getRelatedExplorerProducts(slug: string, limit = 3) {
  return explorerProducts.filter((product) => product.slug !== slug).slice(0, limit);
}
