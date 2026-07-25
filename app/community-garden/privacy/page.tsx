import type { Metadata } from "next";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import { BasilPolicyPage } from "../components/BasilPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Basil Community Garden",
  description: "How Basil by Goetz handles account, garden, payment, and analytics data.",
  alternates: { canonical: getBasilUrl("/community-garden/privacy") },
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
          <li><strong>Anonymous community play:</strong> tile actions such as planting, watering, and pulling weeds; a pseudonymous signed garden-session key; timestamps; short-lived action and watering-cooldown records; and daily activity totals needed to maintain the shared map, pace Care, share watering opportunities, limit automated abuse, and prevent duplicate rewards. New signed-out flowers are temporary for 24 hours. Basil stores a one-way network key for these safeguards rather than a raw IP address.</li>
          <li><strong>Private accounts:</strong> your email address, encrypted password credentials managed by Supabase Auth, verification state, and session information. Basil derives a one-way account key so the same private 100-flower footprint works across signed-in devices without putting an account ID, email, or public username on a Community Garden flower.</li>
          <li><strong>My Garden:</strong> private plants, paths, objects, Care balance and ledger activity, expansion state, and membership entitlement.</li>
          <li><strong>Optional garden sharing:</strong> a Garden Member may create an anonymous, read-only image snapshot of My Garden. The public link contains a random identifier and does not show the member&apos;s name, email, account, or Care balance. Snapshot ownership and the private image file are stored so the member can stop sharing later.</li>
          <li><strong>Feedback:</strong> the category and message you choose to submit through the account area, plus its review status. Garden Members can also use the in-game bug button to send a note and optional screenshot. Basil verifies membership before accepting that quick report, then stores it without the member&apos;s account, name, email, or original file name.</li>
          <li><strong>Purchases and gifts:</strong> Stripe checkout, customer, and payment identifiers; amount, currency, status, and purchase time. For complimentary access, Basil stores an opaque gift identifier, redemption status, and a short-lived one-way request fingerprint used to limit guessing. Basil does not receive or store full card details, raw gift-code guesses, or raw IP addresses in the gift-code log.</li>
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
          purchase flow work, restore work after a refresh, transfer a browser&apos;s
          temporary Community Garden contributions when the player signs in, and avoid
          duplicate events.
        </p>
        <p>
          Basil is available primarily at basilcommunitygarden.com and remains compatible
          with the Basil route on bygoetz.com. Browser sessions are scoped to the domain
          where you signed in, so an existing member may need to sign in once on the new
          Basil domain. A purchase preview is also saved server-side before checkout so a
          domain change or email verification does not discard the garden being purchased.
        </p>
      </section>

      <section>
        <h2>Services that receive data</h2>
        <dl>
          <div><dt>Supabase</dt><dd>Authentication, account and garden database records, private quick-report screenshots, optional private garden-share image storage, first-party funnel analytics, and server-side security controls.</dd></div>
          <div><dt>Stripe</dt><dd>Checkout, payment processing, fraud prevention, receipts, and payment records. Stripe handles payment details under its own privacy terms.</dd></div>
          <div><dt>Resend</dt><dd>Account verification, password-recovery delivery, and the optional monthly Basil Garden Letter, including the destination email, subscription preference, and delivery information.</dd></div>
          <div><dt>Vercel</dt><dd>Website hosting, server execution, security, and operational logs.</dd></div>
          <div><dt>Meta</dt><dd>Advertising measurement for Basil game visits, selected gameplay milestones, account verification, checkout starts, and completed purchases. The server-side Purchase signal includes a one-way hash of the purchaser email, an opaque launch-session hash, available Meta click attribution, purchase value, and currency.</dd></div>
        </dl>
        <p>
          Basil does not sell personal information. Providers may process information
          as needed to deliver their service, secure it, and meet legal obligations.
        </p>
      </section>

      <section>
        <h2>Meta advertising</h2>
        <p>
          Basil uses Meta Pixel on the Community Garden game page and Meta Conversions
          API after a server-verified purchase for a United States-only advertising
          test. Meta receives page views, the usable-garden view, verified registration,
          checkout start, completed purchase, and a small set of tutorial milestones:
          first plant, community tutorial completion, entry to My Garden, and paywall
          view. Basil does not send every watering, planting, tile selection, or garden
          position to Meta.
        </p>
        <p>
          Purchase events include $9.99 USD, an opaque event ID used to prevent duplicate
          counting, and server-side matching data described above. Meta may set or read
          browser identifiers through its Pixel. The first-party Basil launch-session
          record remains separate and does not store an account email address. Meta
          processes advertising data under its own terms and privacy controls.
        </p>
      </section>

      <section>
        <h2>Why information is used</h2>
        <p>
          Basil uses this information to run the shared garden, save My Garden, provide
          membership, complete and recover purchases, send requested account emails,
          prevent abuse, understand the launch and advertising funnel in aggregate, troubleshoot errors,
          respond to feedback, and meet legal and accounting obligations.
        </p>
        <p>
          Garden Members may receive a monthly community-garden letter. It contains
          aggregate garden statistics rather than individual player histories. Every
          issue includes an unsubscribe link, and the preference can also be changed in
          the Basil account screen.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <ul>
          <li>Private account, My Garden, account-linked feedback, and entitlement records remain while the account is active and are removed through the deletion process.</li>
          <li>A member-created garden snapshot remains available through its random public link until the member stops sharing it or deletes the account. Stopping a share immediately hides the public record and removes its private image file; previously downloaded or reposted copies are outside Basil&apos;s control.</li>
          <li>Quick bug and idea reports are stored without an account identifier. Their optional screenshots remain private and use random server-generated file names. Because Basil cannot connect these reports back to a member after submission, they may remain after account deletion for product review and troubleshooting.</li>
          <li>Monthly-letter consent and delivery records remain while the account is active or as reasonably needed to honor an unsubscribe request and prevent duplicate sends.</li>
          <li>The anonymous launch session is designed to last 90 days in the browser; raw first-party funnel sessions and events are designed for 180-day retention.</li>
          <li>Pseudonymous daily Community Garden activity counters are designed for 35-day retention; action deduplication and personal watering-cooldown records are designed for approximately 24-hour retention. A flower&apos;s anonymous shared watering marker may remain with that flower until it returns to the soil.</li>
          <li>New signed-out Community Garden flowers return after approximately 24 hours at the next ten-minute garden update. If that browser signs in first, its flowers, planted dates, and qualifying care history are transferred to the account-wide anonymous footprint.</li>
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
          Supabase Auth user and Basil’s private My Garden, garden-share snapshots,
          feedback, Care ledger, entitlement, and private account records. It also
          revokes account sessions.
          Anonymous quick bug and idea reports cannot be connected back to the deleted
          account and may remain. Already-anonymous Community Garden contributions may
          remain in the canonical
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
