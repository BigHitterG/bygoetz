"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import explorersStudio from "@/public/art/explorers-studio.jpg";
import studioRange from "@/public/art/studio-range.jpg";
import studioScale from "@/public/art/studio-scale.jpg";
import workingStudio from "@/public/art/working-studio.jpg";
import styles from "./page.module.css";

type ArtSlide = {
  image: StaticImageData;
  alt: string;
  label: string;
  note: string;
};

const slides: ArtSlide[] = [
  {
    image: studioScale,
    alt: "Original paintings by Thomas Goetz installed together in the studio",
    label: "Work at physical scale",
    note: "Studio view · Des Moines",
  },
  {
    image: explorersStudio,
    alt: "Framed prints from The Explorers Series displayed in Thomas Goetz's studio",
    label: "An editioned world inside the practice",
    note: "The Explorers Series · Studio view",
  },
  {
    image: studioRange,
    alt: "A group of geometric, gestural, and framed works in Thomas Goetz's studio",
    label: "Many visual languages, one studio",
    note: "Current work · Studio view",
  },
  {
    image: workingStudio,
    alt: "Thomas Goetz's working studio filled with drawings and paintings",
    label: "The working wall",
    note: "Process · Studio view",
  },
];

const AUTO_ADVANCE_MS = 7000;

export function ArtHeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [canAutoPlay, setCanAutoPlay] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewport = window.matchMedia("(max-width: 820px)");

    const updateAutoPlay = () => {
      setCanAutoPlay(!reducedMotion.matches && !mobileViewport.matches);
    };

    updateAutoPlay();
    reducedMotion.addEventListener("change", updateAutoPlay);
    mobileViewport.addEventListener("change", updateAutoPlay);

    return () => {
      reducedMotion.removeEventListener("change", updateAutoPlay);
      mobileViewport.removeEventListener("change", updateAutoPlay);
    };
  }, []);

  useEffect(() => {
    if (!canAutoPlay || paused) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(interval);
  }, [canAutoPlay, paused]);

  const activeSlide = slides[activeIndex];
  const isPlaying = canAutoPlay && !paused;

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % slides.length);
  }

  return (
    <section className={styles.carousel} aria-label="Art and studio views">
      <div className={styles.carouselImageFrame}>
        <Image
          key={activeSlide.image.src}
          className={styles.carouselImage}
          src={activeSlide.image}
          alt={activeSlide.alt}
          fill
          priority={activeIndex === 0}
          sizes="(max-width: 820px) 100vw, 62vw"
        />
      </div>

      <div className={styles.carouselTopline}>
        <span>Studio index</span>
        <span>
          {String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </div>

      <div className={styles.carouselCaption}>
        <p>{activeSlide.label}</p>
        <span>{activeSlide.note}</span>
      </div>

      <div className={styles.carouselControls}>
        <button type="button" onClick={showPrevious} aria-label="Show previous studio image">
          ←
        </button>
        <button type="button" onClick={showNext} aria-label="Show next studio image">
          →
        </button>
        <button
          className={styles.carouselPause}
          type="button"
          onClick={() => setPaused((current) => !current)}
          aria-label={isPlaying ? "Pause rotating artwork" : "Play rotating artwork"}
          aria-pressed={!isPlaying}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>

      <div className={styles.carouselProgress} aria-hidden="true">
        <span
          key={`${activeIndex}-${isPlaying}`}
          className={isPlaying ? styles.carouselProgressActive : undefined}
        />
      </div>
    </section>
  );
}
