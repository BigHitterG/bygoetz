import type { Metadata } from "next";
import { MetaPurchaseTracker } from "@/components/analytics/MetaPurchaseTracker";
import { explorerProducts } from "@/lib/explorers/products";
import { getStripe } from "@/lib/stripe";
import styles from "@/components/explorers/build-a-set/BuildASet.module.css";
import { withSiteBasePath } from "@/lib/sitePath";

export const metadata: Metadata = {
  title: "Your Explorers Set | Goetz",
  robots: { index: false, follow: false },
};

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function Page({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  let purchase:
    | { value: number; currency: string; artworkSlugs: string[]; optionId: string }
    | undefined;

  if (sessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (
        session.payment_status === "paid" &&
        session.metadata?.order_type === "explorers_print_set"
      ) {
        purchase = {
          value: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? "usd",
          artworkSlugs: (session.metadata.selected_slugs ?? "").split(",").filter(Boolean),
          optionId: session.metadata.print_option ?? "unknown",
        };
      }
    } catch {
      purchase = undefined;
    }
  }

  return (
    <main className={styles.successPage}>
      {purchase && sessionId ? (
        <MetaPurchaseTracker sessionId={sessionId} {...purchase} />
      ) : null}
      <section className={styles.successPanel}>
        <p className={styles.eyebrow}>{purchase ? "Order confirmed" : "Order status"}</p>
        <h1>{purchase ? "Your Explorers are on their way." : "We could not verify this order."}</h1>
        <p>
          {purchase
            ? "Thank you for building a set with Goetz. Stripe will send your receipt to the email address used at checkout."
            : "Return to the set builder or check the receipt from Stripe. No purchase event has been recorded from this page."}
        </p>
        <a className={styles.primaryButton} href={withSiteBasePath("/explorers")}>
          Explore the Collection
        </a>
      </section>
      <section className={styles.successMore} aria-labelledby="more-explorers-title">
        <h2 id="more-explorers-title">More from The Explorers Series</h2>
        <div className={styles.successMoreGrid}>
          {explorerProducts.slice(0, 3).map((product) => (
            <a
              key={product.slug}
              href={withSiteBasePath(`/explorers/products/${product.slug}`)}
            >
              <img src={withSiteBasePath(product.image)} alt={`${product.title} artwork`} />
              <span>{product.title}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

