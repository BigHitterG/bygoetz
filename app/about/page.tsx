import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import basilImage from "@/public/community-garden/basil-social-1200.jpg";
import signatureLogo from "@/public/concepts/images/Logo-01.png";
import originalArtwork from "@/public/concepts/images/551F39B2-861F-4C86-A128-FFDC16CEB303.png";
import explorersMonkey from "@/public/explorers/Monkey.png";
import gromasCover from "@/public/gromas/cover-front-v3.webp";
import portrait from "@/public/images/about/tj-goetz-founder.jpg";
import styles from "./page.module.css";

const siteUrl = "https://www.bygoetz.com";
const description =
  "Meet Thomas Raymond Goetz, a Des Moines artist, designer, and creator making original artwork, illustrated stories, playful products, and interactive creative worlds.";

export const metadata: Metadata = {
  title: "Thomas Raymond Goetz | Artist, Designer & Creator",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Thomas Raymond Goetz | Artist, Designer & Creator",
    description,
    type: "profile",
    url: "/about",
    siteName: "By Goetz",
    images: [
      {
        url: "/images/about/tj-goetz-founder.jpg",
        width: 960,
        height: 1280,
        alt: "Thomas Raymond Goetz, artist and creator of By Goetz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thomas Raymond Goetz | Artist, Designer & Creator",
    description,
    images: ["/images/about/tj-goetz-founder.jpg"],
  },
};

const profileJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${siteUrl}/about#profile`,
  url: `${siteUrl}/about`,
  name: "Thomas Raymond Goetz | Artist, Designer & Creator",
  description,
  mainEntity: {
    "@type": "Person",
    "@id": `${siteUrl}/#thomas-raymond-goetz`,
    name: "Thomas Raymond Goetz",
    alternateName: ["TJ Goetz", "By Goetz"],
    url: `${siteUrl}/about`,
    image: `${siteUrl}/images/about/tj-goetz-founder.jpg`,
    jobTitle: "Artist, designer, and creator",
    homeLocation: {
      "@type": "Place",
      name: "Des Moines, Iowa",
    },
    sameAs: ["https://www.instagram.com/bygoetz/"],
  },
};

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className={styles.header}>
        <Link className={styles.logoLink} href="/" aria-label="Return to By Goetz">
          <Image src={signatureLogo} alt="By Goetz" priority />
        </Link>
        <nav aria-label="By Goetz projects">
          <Link href="/explorers">Explorers</Link>
          <Link href="/gromas">Gromas</Link>
          <a href="https://basilcommunitygarden.com/">Basil</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Artist · Designer · Creator</p>
          <h1>Thomas Raymond Goetz</h1>
          <p className={styles.lede}>
            I make original artwork and build playful worlds around images,
            stories, books, objects, and digital experiences.
          </p>
          <p className={styles.intro}>
            By Goetz is the home of that connected practice—from studio work and
            The Explorers Series to Gromas and the Gobbledygooks and Basil
            Community Garden. Each project begins with drawing, curiosity, and a
            desire to make art something people can live with, read, play, or help grow.
          </p>
          <div className={styles.heroLinks}>
            <a href="#work">Explore the work</a>
            <a href="https://www.instagram.com/bygoetz/" target="_blank" rel="noreferrer">
              Instagram @bygoetz
            </a>
          </div>
        </div>
        <figure className={styles.portrait}>
          <Image
            src={portrait}
            alt="Thomas Raymond Goetz in his Des Moines studio"
            priority
            sizes="(max-width: 760px) 92vw, 42vw"
          />
          <figcaption>Thomas Raymond Goetz · Des Moines, Iowa</figcaption>
        </figure>
      </section>

      <section className={styles.workSection} id="work">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Selected worlds</p>
          <h2>One creative practice, many forms.</h2>
        </div>
        <div className={styles.workGrid}>
          <Link className={`${styles.workCard} ${styles.artCard}`} href="/art">
            <div className={styles.imageFrame}>
              <Image
                src={originalArtwork}
                alt="Illuminated abstract line artwork by Thomas Raymond Goetz"
                sizes="(max-width: 760px) 92vw, 46vw"
              />
            </div>
            <div className={styles.cardCopy}>
              <p>Original artwork</p>
              <h3>The foundation of By Goetz</h3>
              <span>
                Drawing, color, light, and visual experiments made in the studio.
              </span>
            </div>
          </Link>

          <Link className={styles.workCard} href="/explorers">
            <div className={`${styles.imageFrame} ${styles.lightFrame}`}>
              <Image
                src={explorersMonkey}
                alt="Geometric monkey print from The Explorers Series"
                sizes="(max-width: 760px) 92vw, 30vw"
              />
            </div>
            <div className={styles.cardCopy}>
              <p>Art prints</p>
              <h3>The Explorers Series</h3>
              <span>Modern geometric animals for playful, creative spaces.</span>
            </div>
          </Link>

          <Link className={styles.workCard} href="/gromas">
            <div className={`${styles.imageFrame} ${styles.bookFrame}`}>
              <Image
                src={gromasCover}
                alt="Cover of Gromas and the Gobbledygooks"
                sizes="(max-width: 760px) 92vw, 30vw"
              />
            </div>
            <div className={styles.cardCopy}>
              <p>Illustrated story</p>
              <h3>Gromas and the Gobbledygooks</h3>
              <span>A rhyming adventure powered by one ordinary footstep.</span>
            </div>
          </Link>

          <a className={styles.workCard} href="https://basilcommunitygarden.com/">
            <div className={styles.imageFrame}>
              <Image
                src={basilImage}
                alt="Basil Community Garden with pixel flowers, herbs, and garden visitors"
                sizes="(max-width: 760px) 92vw, 30vw"
              />
            </div>
            <div className={styles.cardCopy}>
              <p>Interactive world</p>
              <h3>Basil Community Garden</h3>
              <span>A living shared garden where every visitor can help.</span>
            </div>
          </a>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Made in Des Moines by Thomas Raymond Goetz.</p>
        <div>
          <a href="mailto:info@bygoetz.com">info@bygoetz.com</a>
          <a href="https://www.instagram.com/bygoetz/" target="_blank" rel="noreferrer">
            Instagram
          </a>
        </div>
      </footer>
    </main>
  );
}
