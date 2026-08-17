export type ArtMediaRole =
  | "primary"
  | "installation"
  | "context"
  | "scale"
  | "detail"
  | "process";

export type ArtMediaTarget =
  | { kind: "practice" }
  | { kind: "series"; id: string }
  | { kind: "artwork"; id: string };

export type PublicArtMedia = {
  id: string;
  src: `/art/${string}`;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  assignments: readonly {
    target: ArtMediaTarget;
    role: ArtMediaRole;
    order: number;
  }[];
};

export type ArtSeries = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  statement: string;
  coverMediaId: string;
};

export type ArtworkDimensions = {
  artwork?: {
    width: number;
    height: number;
    depth?: number;
    unit: "in" | "cm";
  };
  framed?: {
    width: number;
    height: number;
    depth?: number;
    unit: "in" | "cm";
  };
};

export type PublicArtwork = {
  id: string;
  slug: string;
  title: string;
  seriesId?: string;
  year?: number;
  medium: string;
  dimensions?: ArtworkDimensions;
  framing?: {
    framed: boolean;
    matted?: boolean;
    glazing?: "glass" | "acrylic" | "none";
  };
  summary: string;
  description?: string;
  primaryMediaId: string;
};

export type ArtLandingPlacement = {
  kind: "series" | "artwork";
  id: string;
  layout: "lead" | "single" | "pair";
  order: number;
};
