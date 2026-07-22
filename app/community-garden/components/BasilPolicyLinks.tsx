import Link from "next/link";
import { getBasilUrl } from "@/lib/communityGarden/urls";

type BasilPolicyLinksProps = {
  compact?: boolean;
};

const LINKS = [
  ["Privacy", getBasilUrl("/community-garden/privacy")],
  ["Terms", getBasilUrl("/community-garden/terms")],
  ["Refunds", getBasilUrl("/community-garden/refunds")],
  ["Support", getBasilUrl("/community-garden/support")],
  ["Delete account", getBasilUrl("/community-garden/delete-account")],
] as const;

export function BasilPolicyLinks({ compact = false }: BasilPolicyLinksProps) {
  return (
    <nav
      className={`cg-policy-links${compact ? " is-compact" : ""}`}
      aria-label="Basil policies and support"
    >
      {LINKS.map(([label, href]) => (
        <Link key={href} href={href}>{label}</Link>
      ))}
    </nav>
  );
}
