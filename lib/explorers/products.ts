export type ExplorerPrintOption = {
  label: string;
  format: string;
  artworkSize: string;
  finishedSize: string;
  price: string;
  checkoutLink: string;
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

type ExplorerPrintLinks = {
  print8x10: string;
  matted8x10: string;
  print11x14: string;
  matted11x14: string;
};

function createExplorerPrintOptions(links: ExplorerPrintLinks): ExplorerPrintOption[] {
  return [
    {
      label: "8x10 print",
      format: "Unmatted print",
      artworkSize: "8 x 10 in artwork",
      finishedSize: "Ships as an 8 x 10 in print",
      price: "$35",
      checkoutLink: links.print8x10,
    },
    {
      label: "8x10 print, matted",
      format: "Matted print",
      artworkSize: "8 x 10 in artwork",
      finishedSize: "Matted to fit an 11 x 14 in frame",
      price: "$50",
      checkoutLink: links.matted8x10,
    },
    {
      label: "11x14 print",
      format: "Unmatted print",
      artworkSize: "11 x 14 in artwork",
      finishedSize: "Ships as an 11 x 14 in print",
      price: "$65",
      checkoutLink: links.print11x14,
      note: "Larger wall-friendly size",
    },
    {
      label: "11x14 print, matted",
      format: "Matted print",
      artworkSize: "11 x 14 in artwork",
      finishedSize: "Matted to fit a 16 x 20 in frame",
      price: "$95",
      checkoutLink: links.matted11x14,
      note: "Standard larger frame-ready size",
    },
  ];
}

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
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/eVqaEX9G956u4NNgy8gw001",
      matted8x10: "https://buy.stripe.com/bJe9AT3hL0Qe2FFeq0gw002",
      print11x14: "https://buy.stripe.com/7sYaEXdWp1Ui7ZZ4Pqgw003",
      matted11x14: "https://buy.stripe.com/4gM5kDbOh8iGdkja9Kgw004",
    }),
    digitalPaymentLink: "https://buy.stripe.com/00wbJ1cSl9mK94395Ggw00x",
    featured: true,
  },
  {
    title: "Dog",
    slug: "dog",
    image: "/explorers/Dog.png",
    description:
      "A loyal study in bold color, simple form, and warm modern character.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/28E5kDg4xcyW943gy8gw005",
      matted8x10: "https://buy.stripe.com/7sY6oH3hL42q0xx6Xygw006",
      print11x14: "https://buy.stripe.com/6oU28r5pTdD0bcb1Degw007",
      matted11x14: "https://buy.stripe.com/dRmeVdaKddD0a8795Ggw008",
    }),
    digitalPaymentLink: "https://buy.stripe.com/dRmeVd9G99mK5RRdlWgw00y",
  },
  {
    title: "Horse",
    slug: "horse",
    image: "/explorers/Horse.png",
    description:
      "Architectural shapes and confident lines give this explorer a quiet sense of motion.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/aFabJ12dHbuS5RRchSgw009",
      matted8x10: "https://buy.stripe.com/8x24gz5pT0QecgfchSgw00a",
      print11x14: "https://buy.stripe.com/14A5kDbOh2Ymfsr0zagw00b",
      matted11x14: "https://buy.stripe.com/9B65kDcSl42q2FF95Ggw00c",
    }),
    digitalPaymentLink: "https://buy.stripe.com/3cI8wP5pT42q4NNdlWgw00z",
  },
  {
    title: "Cow",
    slug: "cow",
    image: "/explorers/Cow.png",
    description:
      "A calm, graphic portrait made for bright rooms and thoughtful collections.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/4gM4gz7y1gPc943chSgw00d",
      matted8x10: "https://buy.stripe.com/fZuaEXbOh6ay3JJ3Lmgw00e",
      print11x14: "https://buy.stripe.com/9B6fZh4lPeH4fsr1Degw00f",
      matted11x14: "https://buy.stripe.com/00weVd7y1cyW5RRbdOgw00g",
    }),
    digitalPaymentLink: "https://buy.stripe.com/14A14n6tX7eC3JJbdOgw00A",
  },
  {
    title: "Turtle",
    slug: "turtle",
    image: "/explorers/Turtle.png",
    description:
      "A steady little explorer built from clean geometry and cheerful primary color.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/cNifZh9G9dD00xxdlWgw00h",
      matted8x10: "https://buy.stripe.com/eVqcN519DgPcdkj81Cgw00i",
      print11x14: "https://buy.stripe.com/8x214n2dH7eC2FFgy8gw00j",
      matted11x14: "https://buy.stripe.com/7sY7sLf0t1Ui9433Lmgw00k",
    }),
    digitalPaymentLink: "https://buy.stripe.com/9B6eVd2dH56u5RR3Lmgw00B",
  },
  {
    title: "Owl",
    slug: "owl",
    image: "/explorers/Owl.png",
    description:
      "A watchful modern owl with minimal forms, crisp contrast, and a wise gaze.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/28EbJ105z7eCcgfeq0gw00l",
      matted8x10: "https://buy.stripe.com/8x2aEXg4xeH47ZZ6Xygw00m",
      print11x14: "https://buy.stripe.com/aFa14n19D9mKdkjfu4gw00n",
      matted11x14: "https://buy.stripe.com/8x24gzcSlgPcfsrchSgw00o",
    }),
    digitalPaymentLink: "https://buy.stripe.com/4gMbJ17y1gPc3JJ0zagw00C",
  },
  {
    title: "Explorer",
    slug: "explorer",
    image: "/explorers/Explorer.png",
    description:
      "A character print for rooms where imagination, learning, and discovery meet.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/6oU6oH05zgPc94381Cgw00p",
      matted8x10: "https://buy.stripe.com/aFa28rdWpfL82FFfu4gw00q",
      print11x14: "https://buy.stripe.com/dRm7sL7y11Ui943dlWgw00r",
      matted11x14: "https://buy.stripe.com/aFaaEX3hL0Qegwv3Lmgw00s",
    }),
    digitalPaymentLink: "https://buy.stripe.com/aFa5kDf0t0Qe4NN5Tugw00D",
  },
  {
    title: "Snorkeler",
    slug: "snorkeler",
    image: "/explorers/Snorkeler.png",
    description:
      "An aquatic explorer with bright shapes, expressive details, and a sense of wonder.",
    priceFrom: "$35",
    digitalPrice: "$3",
    printOptions: createExplorerPrintOptions({
      print8x10: "https://buy.stripe.com/cNi00j7y142q5RR2Higw00t",
      matted8x10: "https://buy.stripe.com/aFa7sLf0teH45RRa9Kgw00u",
      print11x14: "https://buy.stripe.com/8x27sL7y16ay1BBdlWgw00v",
      matted11x14: "https://buy.stripe.com/8x27sLcSlbuSeon5Tugw00w",
    }),
    digitalPaymentLink: "https://buy.stripe.com/3cIfZhg4x42q4NN5Tugw00E",
  },
];

export function getExplorerProduct(slug: string) {
  return explorerProducts.find((product) => product.slug === slug);
}

export function getRelatedExplorerProducts(slug: string, limit = 3) {
  return explorerProducts.filter((product) => product.slug !== slug).slice(0, limit);
}
