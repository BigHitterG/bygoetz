import Link from "next/link";

type BasilPolicyLinksProps = {
  compact?: boolean;
};

const LINKS = [
  ["Privacy", "/community-garden/privacy"],
  ["Terms", "/community-garden/terms"],
  ["Refunds", "/community-garden/refunds"],
  ["Support", "/community-garden/support"],
  ["Delete account", "/community-garden/delete-account"],
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
