import styles from "@/components/explorers/Explorers.module.css";
import { withSiteBasePath } from "@/lib/sitePath";

export default function ExplorersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.explorersShell}>
      <header className={styles.explorersHeader}>
        <a className={styles.explorersLogoLink} href={withSiteBasePath("/explorers")}>
          <img
            src={withSiteBasePath("/concepts/images/Logo-01.png")}
            alt="Goetz"
            draggable="false"
          />
        </a>
      </header>
      {children}
    </div>
  );
}
