import Link from "next/link";
import type { ReactNode } from "react";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import { BasilPolicyLinks } from "./BasilPolicyLinks";

type BasilPolicyPageProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function BasilPolicyPage({ eyebrow, title, children }: BasilPolicyPageProps) {
  return (
    <main className="cg-legal-page">
      <header className="cg-legal-header">
        <Link className="cg-legal-brand" href={getBasilUrl()} aria-label="Return to Basil">
          <span aria-hidden="true" className="cg-legal-flower">✿</span>
          <span><strong>Basil</strong><small>Community Garden</small></span>
        </Link>
        <p className="cg-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="cg-legal-date">Last updated July 21, 2026</p>
        <aside className="cg-legal-draft" role="note">
          Practical, implementation-aligned draft for owner approval and optional legal review.
        </aside>
      </header>
      <article className="cg-legal-copy">{children}</article>
      <footer className="cg-legal-footer">
        <BasilPolicyLinks />
        <Link href={getBasilUrl()}>Return to the garden</Link>
        <small>© 2026 Basil by Goetz</small>
      </footer>
    </main>
  );
}
