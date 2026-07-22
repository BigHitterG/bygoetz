import type { Metadata } from "next";
import { BasilPolicyPage } from "../components/BasilPolicyPage";

export const metadata: Metadata = { title: "Terms of Use | Basil Community Garden" };

export default function BasilTermsPage() {
  return (
    <BasilPolicyPage eyebrow="Playing together" title="Terms of Use">
      <section><h2>About these terms</h2><p>These terms apply when you use Basil Community Garden, create a Basil account, submit feedback, or purchase Garden Membership from Basil by Goetz. By using Basil, you agree to these terms. If you are not legally able to agree, use Basil only with a parent or guardian who can.</p></section>
      <section><h2>Community play</h2><p>The Community Garden is a shared, changing landscape. Other players and garden systems can water, replace, remove, or change shared plants and tiles. A local action may be reconciled with the canonical map after synchronization. Basil does not promise that every anonymous contribution will remain forever.</p></section>
      <section><h2>Your contributions</h2><p>When you add an anonymous Community Garden contribution, you give Basil permission to keep, display, adapt, combine, moderate, and remove it as part of the shared garden. Anonymous shared contributions may remain after account deletion. Do not submit unlawful, harmful, abusive, automated, or disruptive content or actions.</p></section>
      <section><h2>Accounts and security</h2><p>Your email is your private login; Basil does not create a public username. Use accurate account information, protect your password, and tell Support if you believe your account was used without permission. Do not bypass limits, impersonate another person, scrape private systems, or interfere with the service.</p></section>
      <section><h2>Garden Membership</h2><p>Garden Membership is currently a one-time $9.99 digital purchase, not a subscription. It grants access to the current membership features, including saving My Garden across supported devices. Virtual Care, plants, paths, and objects are licensed game features, not money or property, and cannot be sold or transferred. Basil may evolve, rebalance, add, or retire features while preserving purchased access in a reasonable form.</p></section>
      <section><h2>Payments and refunds</h2><p>Stripe processes checkout and payment. Prices and taxes, when applicable, are shown before purchase. Refunds are governed by the Basil Refund Policy and any rights that cannot legally be waived.</p></section>
      <section><h2>Availability</h2><p>Basil is provided on an “as available” basis. Shared maps, sync, account email, or hosting may occasionally be delayed or unavailable. Basil may correct errors, prevent abuse, restore data when reasonably possible, and suspend access that threatens the garden or other players.</p></section>
      <section><h2>Ownership</h2><p>Basil’s software, art, design, text, branding, and original game materials belong to Basil by Goetz or its licensors. These terms do not transfer that ownership. You may use the game for personal, non-commercial enjoyment.</p></section>
      <section><h2>Responsibility and limits</h2><p>To the fullest extent permitted by law, Basil by Goetz is not liable for indirect, incidental, special, or consequential losses arising from use of the service. Nothing here excludes a right or responsibility that applicable law does not allow Basil to exclude.</p></section>
      <section><h2>Changes and contact</h2><p>These terms may be updated as Basil grows. Material changes will be posted with a new date. For questions or a problem, use the Support page before starting a dispute so there is a fair opportunity to help.</p></section>
    </BasilPolicyPage>
  );
}
