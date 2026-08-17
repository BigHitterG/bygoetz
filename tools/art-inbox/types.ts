import type { ArtMediaRole } from "@/lib/art/types";

export type InboxPhoto = {
  id: string;
  relativePath: string;
  originalFilename: string;
  importedAt: string;
  byteLength: number;
  checksum: string;
  review: "unreviewed" | "kept" | "excluded";
};

export type InboxAssignment = {
  photoId: string;
  target:
    | { kind: "unassigned" }
    | { kind: "practice" }
    | { kind: "series"; id: string }
    | { kind: "artwork"; id: string };
  role:
    | ArtMediaRole
    | "primary-candidate"
    | "condition"
    | "back"
    | "private-reference";
  publishCandidate: boolean;
  order?: number;
};

export type InboxGroupDecision =
  | "same-artwork"
  | "same-body-of-work"
  | "separate-artworks"
  | "studio-reference";

export type InboxGroup = {
  id: string;
  photoIds: readonly string[];
  decision?: InboxGroupDecision;
  workingLabel?: string;
};

export type ArtworkInboxManifest = {
  version: 1;
  photos: readonly InboxPhoto[];
  assignments: readonly InboxAssignment[];
  groups: readonly InboxGroup[];
};
