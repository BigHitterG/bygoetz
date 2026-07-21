import Image from "next/image";
import { withSiteBasePath } from "@/lib/sitePath";

export function GardenFounder() {
  return (
    <section className="cg-founder" aria-labelledby="cg-founder-title">
      <div className="cg-founder-portrait">
        <Image
          src={withSiteBasePath("/images/about/tj-goetz-founder.jpg")}
          alt="TJ Goetz holding a drink decorated with three blue droplets"
          width={960}
          height={1280}
          sizes="(max-width: 520px) calc(100vw - 56px), 520px"
          draggable={false}
        />
      </div>

      <Image
        className="cg-founder-logo"
        src={withSiteBasePath("/concepts/images/Logo-01.png")}
        alt="Goetz"
        width={591}
        height={417}
        sizes="150px"
        draggable={false}
      />

      <div className="cg-founder-copy">
        <p className="cg-kicker">About the founder</p>
        <h3 id="cg-founder-title">A garden inspired at home.</h3>
        <p>
          I&apos;m TJ Goetz. Basil began with my wife and her love for ecosystems,
          gardening, buying local, and practical choices that make everyday life
          better. She also has the cozy-gamer instinct that helped shape the art,
          pace, and feeling of this garden.
        </p>
        <p>
          We continue to shape Basil together. I build and update the game, and I
          return to her often for the honest feedback that keeps it grounded. Thank
          you for playing, caring for the community garden, and helping this small
          world grow.
        </p>
      </div>

      <nav className="cg-founder-links" aria-label="More from TJ Goetz">
        <a href="https://www.bygoetz.com" target="_blank" rel="noreferrer">
          Visit my website
        </a>
        <a href="https://www.instagram.com/bygoetz/" target="_blank" rel="noreferrer">
          Instagram
        </a>
      </nav>
    </section>
  );
}
