export type ExplorerProduct = {
  title: string;
  slug: string;
  image: string;
  description: string;
  priceFrom: string;
  digitalPrice: string;
  availableSizes: string[];
  frameOptions: string[];
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

export const explorerSizes = ["8x10", "11x14"];

export const explorerFrameOptions = ["Print", "Matted print"];

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
  checkoutLink: "",
};

// TODO: Add final artwork files to public/explorers/ as they become available.
export const explorerProducts: ExplorerProduct[] = [
  {
    title: "Monkey",
    slug: "monkey",
    image: "/explorers/Monkey.png",
    description:
      "A bright geometric companion with expressive linework and a curious, playful presence.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
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
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Horse",
    slug: "horse",
    image: "/explorers/Horse.png",
    description:
      "Architectural shapes and confident lines give this explorer a quiet sense of motion.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Cow",
    slug: "cow",
    image: "/explorers/Cow.png",
    description:
      "A calm, graphic portrait made for bright rooms and thoughtful collections.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Turtle",
    slug: "turtle",
    image: "/explorers/Turtle.png",
    description:
      "A steady little explorer built from clean geometry and cheerful primary color.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Owl",
    slug: "owl",
    image: "/explorers/Owl.png",
    description:
      "A watchful modern owl with minimal forms, crisp contrast, and a wise gaze.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Explorer",
    slug: "explorer",
    image: "/explorers/Explorer.png",
    description:
      "A character print for rooms where imagination, learning, and discovery meet.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
    stripePaymentLink: "",
    digitalPaymentLink: "",
  },
  {
    title: "Snorkeler",
    slug: "snorkeler",
    image: "/explorers/Snorkeler.png",
    description:
      "An aquatic explorer with bright shapes, expressive details, and a sense of wonder.",
    priceFrom: "$28",
    digitalPrice: "$2",
    availableSizes: explorerSizes,
    frameOptions: explorerFrameOptions,
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
