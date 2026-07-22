import type { Metadata } from "next";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import { BasilPolicyPage } from "../components/BasilPolicyPage";

export const metadata: Metadata = {
  title: "Refund Policy | Basil Community Garden",
  alternates: { canonical: getBasilUrl("/community-garden/refunds") },
};

export default function BasilRefundPage() {
  return (
    <BasilPolicyPage eyebrow="Garden Membership" title="Refund Policy">
      <section><h2>Our approach</h2><p>Garden Membership is a one-time $9.99 digital purchase delivered immediately after successful payment. If you bought it by mistake, were charged more than once, or cannot access the paid garden after reasonable troubleshooting, contact Basil Support within 14 days of purchase.</p></section>
      <section><h2>What to include</h2><p>Tell Support the purchase email, approximate purchase date, and what went wrong. Do not send a password, card number, verification link, or payment token. Basil may ask for a Stripe receipt identifier to locate the transaction.</p></section>
      <section><h2>How requests are handled</h2><p>Eligible refunds are returned through Stripe to the original payment method. Bank processing time is outside Basil’s control. Requests after substantial use or after 14 days may be declined unless the purchase is defective or applicable law requires otherwise. Duplicate charges and inaccessible purchases will be investigated promptly.</p></section>
      <section><h2>Account deletion is separate</h2><p>Deleting a Basil account does not automatically issue a refund, and a refund does not automatically delete an account. Use the Account and Data Deletion page if you also want private garden and account records removed.</p></section>
      <section><h2>Your legal rights</h2><p>This draft policy does not limit consumer rights that cannot be waived under applicable law.</p></section>
    </BasilPolicyPage>
  );
}
