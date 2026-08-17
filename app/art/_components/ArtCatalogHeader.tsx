import Link from "next/link";
import styles from "./ArtCatalogHeader.module.css";

export function ArtCatalogHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.wordmark} href="/art" aria-label="Thomas Goetz art home">
        <strong>Thomas Goetz</strong>
        <span>Art</span>
      </Link>

      <nav aria-label="Art catalog navigation">
        <Link href="/art#works">Work</Link>
        <Link href="/art#studio">Studio</Link>
        <Link href="/art#available">Available</Link>
        <Link href="/art#portfolio">Portfolio</Link>
      </nav>

      <Link className={styles.gridLink} href="/">
        By Goetz Grid
      </Link>
    </header>
  );
}
