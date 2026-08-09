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
  status: "available",
  url: "https://www.lulu.com/shop/thomas-raymond-goetz-and-william-james-pahos/gromas-and-the-gobbledygooks/hardcover/product-w4gmred.html",
  channel: "Lulu Bookstore",
  displayPrice: "$34.99",
};

export const gromasBook = {
  title: "Gromas and the Gobbledygooks",
  authors: ["Thomas Raymond Goetz", "William James Pahos"],
  publisher: "Getz LLC",
  isbn: "978-0-557-96712-4",
  audience: "Ages 4â€“8",
  pageCount: 32,
  trimSize: "6 Ã— 9 inches",
  format: "Hardcover casewrap",
  interior: "Premium color",
  coverFinish: "Matte",
} as const;

