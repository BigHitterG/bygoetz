import type { Metadata } from "next";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import { BasilPolicyPage } from "../components/BasilPolicyPage";

export const metadata: Metadata = {
  title: "Support | Basil Community Garden",
  alternates: { canonical: getBasilUrl("/community-garden/support") },
};

export default function BasilSupportPage() {
  return (
    <BasilPolicyPage eyebrow="A human is here" title="Support & Contact">
      <section><h2>How to reach Basil</h2><p>TJ Goetz currently reviews Basil support. For account access, a purchase, a refund request, privacy, deletion, or a garden problem, message <a href="https://www.instagram.com/bygoetz/" target="_blank" rel="noreferrer">@bygoetz on Instagram</a>. If you received a Basil account email, you may also reply to that message; replies are routed to the private support address when configured.</p></section>
      <section><h2>Account access</h2><p>Use <strong>Menu → Account → Forgot your password?</strong> for a reset. Check spam, junk, and promotions for email from “Basil by Goetz.” Never send Support your password or a verification link.</p></section>
      <section><h2>Purchase help</h2><p>Include the purchase email, approximate date, device/browser, and a short description. A Stripe receipt identifier is okay; never send a full card number or payment credentials.</p></section>
      <section><h2>Privacy and deletion</h2><p>Signed-in players can use the Account and Data Deletion page. If deletion fails or you cannot sign in, contact Support. Basil may need to verify control of the account before acting.</p></section>
      <section><h2>Garden issues</h2><p>For a sync or restoration problem, include what you were doing, your device/browser, and when it happened. Avoid including private or sensitive information. Community Garden plants are anonymous, so Support may not be able to attribute or restore a specific public contribution.</p></section>
    </BasilPolicyPage>
  );
}
