"use client";

import { useState } from "react";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "./Explorers.module.css";

type ArtworkImageProps = {
  src: string;
  title: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
};

export function ArtworkImage({
  src,
  title,
  className,
  loading = "lazy",
  fetchPriority = "auto",
}: ArtworkImageProps) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div className={`${styles.artworkPlaceholder} ${className ?? ""}`}>
        <span>{title}</span>
      </div>
    );
  }

  return (
    <img
      className={`${styles.artworkImage} ${className ?? ""}`}
      src={withSiteBasePath(src)}
      alt={`${title} artwork from The Explorers Series`}
      loading={loading}
      fetchPriority={fetchPriority}
      draggable="false"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onError={() => setMissing(true)}
    />
  );
}

