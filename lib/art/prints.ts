export type ArtPrintAvailability = "available" | "sold-out" | "unavailable";

export type ArtPrintImage = {
  role: "artwork" | "context" | "wall-mockup" | "desk-mockup";
  src: `/art/${string}`;
  width: number;
  height: number;
  alt: string;
  caption?: string;
};

export type ArtPrintCatalogItem = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  year: number;
  medium: string;
  summary: string;
  story: string;
  edition: {
    kind: "open";
    label: string;
  };
  dimensions: {
    width: number;
    height: number;
    unit: "in";
  };
  presentation: {
    framed: false;
    label: string;
  };
  unitAmount: number;
  currency: "usd";
  availability: ArtPrintAvailability;
  canonicalPath: `/art/prints/${string}`;
  shortPath: `/${string}`;
  images: readonly ArtPrintImage[];
};

export const artPrints = [
  {
    id: "portland-sun-print",
    slug: "portland-sun",
    title: "Portland Sun",
    artist: "Thomas Raymond Goetz",
    year: 2026,
    medium: "Digital artwork",
    summary:
      "A small square world of red sky, orange heat, a low blue horizon, and an eye rising at the edge.",
    story:
      "Portland Sun began as a drawing made directly on a phone. The finished image keeps that immediacy: a few broad shapes becoming weather, water, distance, and a character looking back.",
    edition: {
      kind: "open",
      label: "Open edition",
    },
    dimensions: {
      width: 8,
      height: 8,
      unit: "in",
    },
    presentation: {
      framed: false,
      label: "Print only · unframed",
    },
    unitAmount: 4500,
    currency: "usd",
    availability: "available",
    canonicalPath: "/art/prints/portland-sun",
    shortPath: "/portland-sun",
    images: [
      {
        role: "artwork",
        src: "/art/portland-sun/artwork.jpg",
        width: 1280,
        height: 1280,
        alt: "Portland Sun, a square digital artwork with a red sky, orange forms, a cream eye, and a deep blue horizon",
      },
      {
        role: "context",
        src: "/art/portland-sun/forest-phone.jpg",
        width: 960,
        height: 1280,
        alt: "Thomas Goetz holding a phone displaying Portland Sun on a wooded path",
        caption: "Made on a phone, carried into the landscape.",
      },
      {
        role: "wall-mockup",
        src: "/art/portland-sun/mockup-wall.jpg",
        width: 1024,
        height: 1536,
        alt: "Scale visualization of the Portland Sun print on a wall",
        caption: "Scale visualization · frame not included",
      },
      {
        role: "desk-mockup",
        src: "/art/portland-sun/mockup-desk.jpg",
        width: 1122,
        height: 1402,
        alt: "Scale visualization of the Portland Sun print in a desk setting",
        caption: "Scale visualization · print is sold unframed",
      },
    ],
  },
] as const satisfies readonly ArtPrintCatalogItem[];

export function getArtPrint(slug: string) {
  return artPrints.find((print) => print.slug === slug);
}

export function getAvailableArtPrints() {
  return artPrints.filter((print) => print.availability === "available");
}

export function getArtPrintImage(
  print: ArtPrintCatalogItem,
  role: ArtPrintImage["role"],
) {
  return print.images.find((image) => image.role === role);
}

export function formatArtPrintPrice(
  unitAmount: number,
  currency: ArtPrintCatalogItem["currency"],
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(unitAmount / 100);
}
