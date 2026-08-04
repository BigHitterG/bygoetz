"use client";

import { useEffect, useRef } from "react";
import {
  trackExplorersMetaCustomEvent,
  trackExplorersMetaEvent,
} from "@/lib/analytics/explorersMetaPixel";

type ExplorersProductViewProps = {
  artworkSlug: string;
  artworkTitle: string;
  value: number;
};

export function ExplorersProductView({
  artworkSlug,
  artworkTitle,
  value,
}: ExplorersProductViewProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackExplorersMetaEvent("ViewContent", {
      content_ids: [artworkSlug],
      content_name: `${artworkTitle} | The Explorers Series`,
      content_category: "Explorers physical artwork",
      content_type: "product",
      currency: "USD",
      value,
    });
  }, [artworkSlug, artworkTitle, value]);

  return null;
}

type ExplorersBuilderLinkProps = {
  artworkSlug: string;
  artworkTitle: string;
  className: string;
  href: string;
  children: React.ReactNode;
};

export function ExplorersBuilderLink({
  artworkSlug,
  artworkTitle,
  className,
  href,
  children,
}: ExplorersBuilderLinkProps) {
  return (
    <a
      className={className}
      href={href}
      onClick={() =>
        trackExplorersMetaCustomEvent("ExplorerBuilderOpen", {
          artwork_slug: artworkSlug,
          content_ids: [artworkSlug],
          content_name: artworkTitle,
          entry_point: "product_detail",
          quantity: 1,
        })
      }
    >
      {children}
    </a>
  );
}
