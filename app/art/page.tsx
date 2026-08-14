import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import explorersStudio from "@/public/art/explorers-studio.jpg";
import studioRange from "@/public/art/studio-range.jpg";
import studioScale from "@/public/art/studio-scale.jpg";
import workingStudio from "@/public/art/working-studio.jpg";
import portrait from "@/public/images/about/tj-goetz-founder.jpg";
import { ArtHeroCarousel } from "./ArtHeroCarousel";
import styles from "./page.module.css";

const description =
  "Original artwork, studio practice, selected work, and gallery materials from Des Moines artist Thomas Raymond Goetz.";

export const metadata: Metadata = {
  title: "Original Artwork | Thomas Raymond Goetz",
  description,
  alternates: { canonical: "/art" },
  openGraph: {
    title: "Original Artwork | Thomas Raymond Goetz",
    description,
    type: "website",
    url: "/art",
    siteName: "By Goetz",
    images: [
      {
        url: "/art/working-studio.jpg",
        width: 1368,
        height: 2048,
        alt: "The working studio of artist Thomas Raymond Goetz",
      },
    ],
  },
};

const directoryItems = [
  { index: "01", label: "Work", detail: "Selected paintings, drawings, and visual experiments", href: "#works" },
  { index: "02", label: "Studio", detail: "Process, scale, materials, and the working environment", href: "#studio" },
  { index: "03", label: "Available", detail: "Current work, pricing, and studio appointments", href: "#available" },
  { index: "04", label: "Portfolio", detail: "A concise view for galleries and curators", href: "#portfolio" },
  { index: "05", label: "About", detail: "Statement, biography, exhibitions, and CV", href: "#about" },
  { index: "06", label: "Contact", detail: "Collector, gallery, and general inquiries", href: "#contact" },
];

export default function ArtPage() {
  return (
    <main className={styles.artPage}>
      <header className={styles.siteHeader}>
        <Link className={styles.artWordmark} href="/art" aria-label="Thomas Goetz art home">
          <strong>Thomas Goetz</strong>
          <span>Art</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Art site navigation">
          <a href="#works">Work</a>
          <a href="#studio">Studio</a>
          <a href="#available">Available</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>

        <Link className={styles.backLink} href="/">
          Back to By Goetz
        </Link>

        <details className={styles.mobileMenu}>
          <summary>Menu</summary>
          <nav aria-label="Mobile art site navigation">
            <a href="#works">Work</a>
            <a href="#studio">Studio</a>
            <a href="#available">Available</a>
            <a href="#portfolio">Portfolio</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <Link href="/">Back to By Goetz</Link>
          </nav>
        </details>
      </header>

      <section className={styles.hero}>
        <article className={styles.identityPanel}>
          <figure className={styles.portraitFrame}>
            <Image
              src={portrait}
              alt="Thomas Raymond Goetz, artist and creator of By Goetz"
              priority
              sizes="(max-width: 820px) 100vw, 38vw"
            />
            <figcaption>Thomas Raymond Goetz · Des Moines, Iowa</figcaption>
          </figure>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Artist · Studio index 2026</p>
            <h1>Structure, instinct, and the worlds between.</h1>
            <p className={styles.heroLede}>
              Paintings, drawings, and visual worlds shaped through geometry,
              repeated marks, invented figures, and play.
            </p>
            <div className={styles.heroActions}>
              <a href="#works">Explore the work</a>
              <a href="#portfolio">View portfolio</a>
            </div>
          </div>
        </article>

        <ArtHeroCarousel />
      </section>

      <section className={styles.directory} aria-labelledby="directory-title">
        <svg className={styles.doodleThread} viewBox="0 0 1400 760" aria-hidden="true">
          <path d="M-40 120 C120 20 200 250 340 160 S540 40 625 175 S760 330 855 225 S1010 70 1120 215 S1260 390 1450 270" />
          <path d="M165 520 q42 -90 84 0 t84 0 t84 0" />
          <circle cx="1070" cy="545" r="48" />
          <path d="M1035 545 h70 M1070 510 v70" />
        </svg>
        <div className={styles.sectionIntro}>
          <p className={styles.sectionCode}>Index / 00</p>
          <h2 id="directory-title">One practice. Clear ways in.</h2>
          <p>
            The art remains the center. Everything around it makes the work easier
            to see, understand, collect, and discuss.
          </p>
        </div>

        <div className={styles.directoryList}>
          {directoryItems.map((item) => (
            <a key={item.index} className={styles.directoryRow} href={item.href}>
              <span className={styles.directoryIndex}>{item.index}</span>
              <strong>{item.label}</strong>
              <span className={styles.directoryDetail}>{item.detail}</span>
              <span className={styles.directoryArrow} aria-hidden="true">↘</span>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.worksSection} id="works" aria-labelledby="works-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionCode}>Selected work / 01</p>
            <h2 id="works-title">The catalog begins in the studio.</h2>
          </div>
          <p>
            Individual records are being photographed and assembled. For now,
            these views show the range, scale, and visual language of the work.
          </p>
        </div>

        <div className={styles.workMosaic}>
          <figure className={styles.workLead}>
            <div className={styles.workImageFrame}>
              <Image
                src={studioScale}
                alt="Blue circular painting installed among original works in Thomas Goetz's studio"
                sizes="(max-width: 820px) 100vw, 58vw"
              />
            </div>
            <figcaption>
              <span>Studio view / 001</span>
              <strong>A blue field at physical scale</strong>
              <small>Installation and context</small>
            </figcaption>
          </figure>

          <figure className={styles.workTall}>
            <div className={styles.workImageFrame}>
              <Image
                src={workingStudio}
                alt="Paintings and drawings covering the working walls of Thomas Goetz's studio"
                sizes="(max-width: 820px) 100vw, 34vw"
              />
            </div>
            <figcaption>
              <span>Studio view / 002</span>
              <strong>The working wall</strong>
              <small>Process and environment</small>
            </figcaption>
          </figure>

          <figure className={styles.workWide}>
            <div className={styles.workImageFrame}>
              <Image
                src={studioRange}
                alt="Geometric, gestural, and framed works in the studio"
                sizes="(max-width: 820px) 100vw, 70vw"
              />
            </div>
            <figcaption>
              <span>Studio view / 003</span>
              <strong>Many visual languages, one practice</strong>
              <small>Current studio overview</small>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.studioSection} id="studio" aria-labelledby="studio-title">
        <div className={styles.studioStatement}>
          <p className={styles.sectionCode}>Practice / 02</p>
          <h2 id="studio-title">A practice between structure and instinct.</h2>
          <p>
            The work moves between controlled systems and improvisation: geometric
            fields, repeated marks, figures, animals, stories, and objects developed
            through drawing and play.
          </p>
          <span>Working studio statement</span>
        </div>

        <figure className={styles.studioHeroImage}>
          <Image
            src={workingStudio}
            alt="Thomas Goetz's studio with paintings and drawings covering the working walls"
            sizes="(max-width: 820px) 100vw, 62vw"
          />
          <figcaption>The working studio · Des Moines, Iowa</figcaption>
        </figure>
      </section>

      <section className={styles.professionalSection} aria-label="Collector and gallery information">
        <article className={styles.professionalCard} id="available">
          <p className={styles.sectionCode}>Collect / 03</p>
          <h2>Available work</h2>
          <p>
            For current availability, pricing, shipping, or a studio appointment,
            request the current works list.
          </p>
          <ul>
            <li>Original work</li>
            <li>Editioned work</li>
            <li>Studio appointments</li>
          </ul>
          <a href="mailto:info@bygoetz.com?subject=Available%20works%20inquiry">
            Request current availability <span aria-hidden="true">↗</span>
          </a>
        </article>

        <article className={`${styles.professionalCard} ${styles.portfolioCard}`} id="portfolio">
          <p className={styles.sectionCode}>For galleries / 04</p>
          <h2>Portfolio and materials</h2>
          <p>
            A focused presentation of selected work, artist statement, biography,
            CV, and image list for exhibitions and representation.
          </p>
          <ul>
            <li>Selected portfolio</li>
            <li>Statement and biography</li>
            <li>CV and image list</li>
          </ul>
          <a href="mailto:info@bygoetz.com?subject=Gallery%20portfolio%20request">
            Request gallery materials <span aria-hidden="true">↗</span>
          </a>
        </article>
      </section>

      <section className={styles.explorersSection} aria-labelledby="explorers-title">
        <figure>
          <Image
            src={explorersStudio}
            alt="The Explorers Series prints displayed in Thomas Goetz's studio"
            sizes="(max-width: 820px) 100vw, 58vw"
          />
        </figure>
        <div>
          <p className={styles.sectionCode}>Editioned world / 05</p>
          <h2 id="explorers-title">The Explorers Series</h2>
          <p>
            An ongoing family of geometric characters—an accessible, editioned
            branch of the wider studio practice.
          </p>
          <Link href="/explorers">Enter The Explorers Series <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className={styles.aboutSection} id="about" aria-labelledby="about-title">
        <div>
          <p className={styles.sectionCode}>About / 06</p>
          <h2 id="about-title">Thomas Raymond Goetz</h2>
        </div>
        <div className={styles.aboutCopy}>
          <p>
            Thomas Raymond Goetz is a Des Moines artist, designer, and creator
            working across original artwork, illustrated stories, products, and
            interactive creative worlds.
          </p>
          <Link href="/about">Read the full biography <span aria-hidden="true">↗</span></Link>
        </div>
        <dl className={styles.aboutFacts}>
          <div><dt>Based</dt><dd>Des Moines, Iowa</dd></div>
          <div><dt>Practice</dt><dd>Painting, drawing, stories, objects</dd></div>
          <div><dt>Studio</dt><dd>Visits by appointment</dd></div>
        </dl>
      </section>

      <section className={styles.contactSection} id="contact" aria-labelledby="contact-title">
        <p className={styles.sectionCode}>Contact / 07</p>
        <h2 id="contact-title">Start with the work.</h2>
        <p>Collector, gallery, press, collaboration, or studio-visit inquiries are welcome.</p>
        <div className={styles.contactLinks}>
          <a href="mailto:info@bygoetz.com">info@bygoetz.com</a>
          <a href="https://www.instagram.com/bygoetz/" target="_blank" rel="noreferrer">Instagram</a>
        </div>
        <div className={styles.otherWorlds}>
          <span>Other By Goetz worlds</span>
          <Link href="/explorers">Explorers</Link>
          <Link href="/gromas">Gromas</Link>
          <a href="https://basilcommunitygarden.com/">Basil</a>
          <Link href="/">LazyGrid</Link>
        </div>
      </section>
    </main>
  );
}
