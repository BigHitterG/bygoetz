import { artLandingPlacements, artMedia, artSeries, artworks } from "./catalog";
import type { ArtMediaTarget } from "./types";

export function getArtMedia(mediaId: string) {
  return artMedia.find((media) => media.id === mediaId);
}

export function getArtSeries(slug: string) {
  return artSeries.find((series) => series.slug === slug);
}

export function getArtSeriesById(seriesId: string) {
  return artSeries.find((series) => series.id === seriesId);
}

export function getArtwork(slug: string) {
  return artworks.find((artwork) => artwork.slug === slug);
}

export function getArtworkById(artworkId: string) {
  return artworks.find((artwork) => artwork.id === artworkId);
}

export function getMediaForTarget(target: ArtMediaTarget) {
  return artMedia
    .flatMap((media) =>
      media.assignments
        .filter((assignment) => {
          const assignmentTarget = assignment.target as ArtMediaTarget;
          if (target.kind === "practice") return assignmentTarget.kind === "practice";
          return (
            assignmentTarget.kind === target.kind &&
            "id" in assignmentTarget &&
            assignmentTarget.id === target.id
          );
        })
        .map((assignment) => ({ media, assignment })),
    )
    .sort((left, right) => left.assignment.order - right.assignment.order)
    .map(({ media }) => media);
}

export function getLandingCatalogEntries() {
  return artLandingPlacements
    .toSorted((left, right) => left.order - right.order)
    .flatMap((placement) => {
      const entity =
        placement.kind === "series"
          ? getArtSeriesById(placement.id)
          : getArtworkById(placement.id);

      return entity ? [{ placement, entity }] : [];
    });
}
