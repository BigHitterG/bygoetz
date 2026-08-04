≠rá^—f•ñÿ¶{~Ïy 'v√Æ∂õ≠import type { Metadata } from "next";
import { ExplorersDigitalMetaPurchaseTracker } from "@/components/analytics/ExplorersDigitalMetaPurchaseTracker";
import { DigitalDownloadSuccessPage } from "@/components/explorers/DigitalDownloadSuccessPage";
import { getExplorersDigitalPurchaseMetaEventId } from "@/lib/analytics/explorersMetaServer";
import { EXPLORERS_DIGITAL_ORDER_TYPE } from "@/lib/explorers/orderTypes";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Download Email Sent | The Explorers Series",
  description:
    "Your Explorers Series digital download link has been sent by email from Goetz.",
};

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function Page({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  let purchase:
    | { value: number; currency: string; productKeys: string[] }
    | undefined;

  if (sessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const productKeys = (session.metadata?.digital_product_keys ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
      if (
        session.payment_status === "paid" &&
        session.metadata?.order_type === EXPLORERS_DIGITAL_ORDER_TYPE &&
        productKeys.length > 0
      ) {
        purchase = {
          value: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? "usd",
          productKeys,
        };
      }
    } catch {
      purchase = undefined;
    }
  }

  return (
    <>
      {purchase && sessionId ? (
        <ExplorersDigitalMetaPurchaseTracker
          eventId={getExplorersDigitalPurchaseMetaEventId(sessionId)}
          sessionId={sessionId}
          {...purchase}
        />
      ) : null}
      <DigitalDownloadSuccessPage verified={Boolean(purchase)} />
    </>
  );
}
