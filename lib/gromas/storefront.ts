export type GromasPurchaseState =
  | {
      status: "coming-soon";
    }
  | {
      status: "available";
      url: string;
      channel: "Lulu Bookstore" | "Lulu Direct";
      displayPrice: string;
    };

export const gromasPurchase: GromasPurchaseState = {
  status: "coming-soon",
};

export const gromasBook = {
  title: "Gromas and the Gobbledygooks",
  authors: ["Thomas Raymond Goetz", "William James Pahos"],
  publisher: "Getz LLC",
  audience: "Ages 4–8",
  pageCount: 32,
  trimSize: "6 × 9 inches",
  format: "Hardcover casewrap",
  interior: "Premium color",
  coverFinish: "Matte",
} as const;
