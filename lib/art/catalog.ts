import type {
  ArtLandingPlacement,
  ArtSeries,
  PublicArtMedia,
  PublicArtwork,
} from "./types";

export const artMedia = [
  {
    id: "rebar-hands-overview",
    src: "/art/series/rebar-hands/overview.jpg",
    width: 1374,
    height: 1800,
    alt: "Wall-mounted open hand constructed from welded rebar",
    caption: "Rebar Hands · studio installation view",
    assignments: [
      {
        target: { kind: "series", id: "rebar-hands" },
        role: "installation",
        order: 1,
      },
    ],
  },
  {
    id: "rebar-hands-form-detail",
    src: "/art/series/rebar-hands/form-detail.jpg",
    width: 1200,
    height: 1600,
    alt: "Close view of welded rebar fingers and the outline of a palm",
    caption: "Form detail",
    assignments: [
      {
        target: { kind: "series", id: "rebar-hands" },
        role: "detail",
        order: 2,
      },
    ],
  },
  {
    id: "rebar-hands-weld-detail",
    src: "/art/series/rebar-hands/weld-detail.jpg",
    width: 1200,
    height: 1600,
    alt: "Close view of welded joints in a rebar hand sculpture",
    caption: "Weld and surface detail",
    assignments: [
      {
        target: { kind: "series", id: "rebar-hands" },
        role: "detail",
        order: 3,
      },
    ],
  },
  {
    id: "rebar-hands-joint-detail",
    src: "/art/series/rebar-hands/joint-detail.jpg",
    width: 960,
    height: 1280,
    alt: "Rebar segments joined to create a drawn line in physical space",
    caption: "Construction detail",
    assignments: [
      {
        target: { kind: "series", id: "rebar-hands" },
        role: "process",
        order: 4,
      },
    ],
  },
  {
    id: "rebar-hands-cut-detail",
    src: "/art/series/rebar-hands/cut-detail.jpg",
    width: 900,
    height: 1200,
    alt: "Cut end and textured surface of a rebar hand sculpture",
    caption: "Cut and material detail",
    assignments: [
      {
        target: { kind: "series", id: "rebar-hands" },
        role: "process",
        order: 5,
      },
    ],
  },
  {
    id: "process-sketch-horizontal",
    src: "/art/series/process-sketches/horizontal-study.jpg",
    width: 1600,
    height: 1095,
    alt: "Horizontal framed ink drawing from the Process Sketches series",
    caption: "Process Sketch · horizontal drawing",
    assignments: [
      {
        target: { kind: "series", id: "process-sketches" },
        role: "context",
        order: 1,
      },
    ],
  },
  {
    id: "process-sketch-vertical",
    src: "/art/series/process-sketches/vertical-study.jpg",
    width: 1234,
    height: 1600,
    alt: "Vertical framed ink drawing from the Process Sketches series",
    caption: "Process Sketch · vertical drawing",
    assignments: [
      {
        target: { kind: "series", id: "process-sketches" },
        role: "context",
        order: 2,
      },
    ],
  },
  {
    id: "smiling-shell-context",
    src: "/art/works/smiling-shell/context.jpg",
    width: 1200,
    height: 1600,
    alt: "Smiling Shell, an ink drawing presented in a black frame",
    caption: "Smiling Shell · framed studio view",
    assignments: [
      {
        target: { kind: "artwork", id: "smiling-shell" },
        role: "context",
        order: 1,
      },
    ],
  },
] as const satisfies readonly PublicArtMedia[];

export const artSeries = [
  {
    id: "rebar-hands",
    slug: "rebar-hands",
    title: "Rebar Hands",
    summary:
      "A developing body of wall-mounted hands assembled from welded rebar.",
    statement:
      "The Rebar Hands turn a drawn outline into a physical object. Repetition creates a typology; close views keep the weight, heat, welds, and rough surface visible.",
    coverMediaId: "rebar-hands-overview",
  },
  {
    id: "process-sketches",
    slug: "process-sketches",
    title: "Process Sketches",
    summary:
      "An ongoing group of framed ink drawings, held together as a body of work.",
    statement:
      "The Process Sketches preserve imagined objects, structures, and visual problems in their drawn state. Each sheet remains an individual work while contributing to the larger studio language.",
    coverMediaId: "process-sketch-horizontal",
  },
] as const satisfies readonly ArtSeries[];

export const artworks = [
  {
    id: "smiling-shell",
    slug: "smiling-shell",
    title: "Smiling Shell",
    medium: "Ink on paper",
    dimensions: {
      artwork: { width: 8, height: 10, unit: "in" },
      framed: { width: 11, height: 14, unit: "in" },
    },
    framing: {
      framed: true,
      matted: true,
      glazing: "glass",
    },
    summary:
      "A smiling, shell-like figure built from simple line, repeated marks, and black shapes.",
    primaryMediaId: "smiling-shell-context",
  },
] as const satisfies readonly PublicArtwork[];

export const artLandingPlacements = [
  { kind: "series", id: "rebar-hands", layout: "lead", order: 1 },
  { kind: "artwork", id: "smiling-shell", layout: "single", order: 2 },
  { kind: "series", id: "process-sketches", layout: "pair", order: 3 },
] as const satisfies readonly ArtLandingPlacement[];
