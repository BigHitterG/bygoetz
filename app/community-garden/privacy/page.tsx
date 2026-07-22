import type { Metadata } from "next";
import { BasilPolicyPage } from "../components/BasilPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Basil Community Garden",
  description: "How Basil by Goetz handles account, garden, payment, and analytics data.",
};

export default function BasilPrivacyPage() {
  return (
    <BasilPolicyPage eyebrow="Your information" title="Privacy Policy">
      <section>
        <h2>The short version</h2>
        <p>
          You can play in the Community Garden without an account. Basil does not put
          names, email addresses, or public profiles on community plants. An account is
          needed to save My Garden and a Garden Membership across devices.
        </p>
      </section>

      <section>
        <h2>Information Basil handles</h2>
        <ul>
          <li><strong>Anonymous community play:</strong> tile actions such as planting and watering, an anonymous garden-session identifier, timestamps, and coarse operational data needed to maintain the shared map and prevent duplicate rewards.</li>
          <li><strong>Private accounts:</strong> your email address, encrypted password credentials managed by Supabase Auth, verification state, and session information. Basil does not create a public username.</li>
          <li><strong>My Garden:</strong> private plants, paths, objects, Care balance and ledger activity, expansion state, and membership entitlement.</li>
          <li><strong>Feedback:</strong> the category and message you choose to submit through the account area, plus its review status.</li>
          <li><strong>Purchases:</strong> Stripe checkout, customer, and payment identifiers; amount, currency, status, and purchase time. Basil does not receive or store full card details.</li>
          <li><strong>First-party launch analytics:</strong> a random launch-session ID, funnel milestones, device class, original landing path, referring domain, UTM campaign fields, and a Meta click identifier when one is present in the landing URL. This record does not contain your email.</li>
          <li><strong>Operational security:</strong> one-way hashes derived from an email address or network address may be held briefly for rate limiting. Hosting providers may process request logs, network information, browser/device information, and errors.</li>
        </ul>
      </section>

      <section>
        <h2>Browser storage and cookies</h2>
        <p>
          Basil uses browser storage for the private account session, anonymous launch
          session, tutorial progress, recent local garden actions, a temporary My Garden
          preview, and checkout recovery. A secure, HTTP-only cookie can connect a
          temporary garden to a Stripe return. These are used to make the game and
          purchase flow work, restore work after a refresh, and avoid duplicate events.
        </p>
      </section>

      <section>
        <h2>Services that receive data</h2>
        <dl>
          <div><dt>Supabase</dt><dd>Authentication, account and garden database records, first-party funnel analytics, and server-side security controls.</dd></div>
          <div><dt>Stripe</dt><dd>Checkout, payment processing, fraud prevention, receipts, and payment records. Stripe handles payment details under its own privacy terms.</dd></div>
          <div><dt>Resend</dt><dd>Account verification and password-recovery delivery, including the destination email and delivery information.</dd></div>
          <div><dt>Vercel</dt><dd>Website hosting, server execution, security, and operational logs.</dd></div>
        </dl>
        <p>
          Basil does not sell personal information. Providers may process information
          as needed to deliver their service, secure it, and meet legal obligations.
        </p>
      </section>

      <section>
        <h2>Meta advertising</h2>
        <p>
          Meta Pixel and Meta Conversions API are planned for a future, United
          States-only advertising test, but are not active in Basil today. If activated,
          Basil will update this notice and add any consent controls required for the
          audience being served. The existing first-party funnel measurement is separate
          from Meta and does not contain account email addresses.
        </p>
      </section>

      <section>
        <h2>Why information is used</h2>
        <p>
          Basil uses this information to run the shared garden, save My Garden, provide
          membership, complete and recover purchases, send requested account emails,
          prevent abuse, understand the launch funnel in aggregate, troubleshoot errors,
          respond to feedback, and meet legal and accounting obligations.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <ul>
          <li>Private account, My Garden, feedback, and entitlement records remain while the account is active and are removed through the deletion process.</li>
          <li>The anonymous launch session is designed to last 90 days in the browser; raw first-party funnel sessions and events are designed for 180-day retention.</li>
          <li>Temporary checkout handoffs expire after seven days; expired, unsuccessful handoffs are cleaned up as the system operates.</li>
          <li>Account-email rate-limit records contain hashes rather than the email text and are cleaned after approximately seven days.</li>
          <li>Operational logs and aggregated health records are kept only as reasonably needed for security and reliability, subject to provider settings.</li>
          <li>Stripe and transaction records may remain after Basil account deletion where required for payment, fraud, tax, accounting, or legal obligations.</li>
        </ul>
      </section>

      <section>
        <h2>Deletion and the shared garden</h2>
        <p>
          A signed-in player can permanently delete a Basil account. This removes the
          Supabase Auth user and Basil’s private My Garden, feedback, Care ledger,
          entitlement, and private account records. It also revokes account sessions.
          Already-anonymous Community Garden contributions may remain in the canonical
          shared landscape because they are not stored as a public history tied to your
          account. Deletion never removes or corrupts other players’ shared garden.
        </p>
      </section>

      <section>
        <h2>Children and choices</h2>
        <p>
          Basil is not directed to children under 13 and does not knowingly collect
          their personal information. You may play the Community Garden without an
          account, choose not to submit feedback, sign out, or request account deletion.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For privacy questions, deletion help, or another request, use the Basil Support
          page. You can also contact By Goetz through <a href="https://www.instagram.com/bygoetz/" target="_blank" rel="noreferrer">@bygoetz on Instagram</a>.
        </p>
      </section>
    </BasilPolicyPage>
  );
}
