import type { Metadata } from "next";
import { getBasilUrl } from "@/lib/communityGarden/urls";
import { BasilPolicyPage } from "../components/BasilPolicyPage";
import { DeleteBasilAccount } from "./DeleteBasilAccount";

export const metadata: Metadata = {
  title: "Account and Data Deletion | Basil Community Garden",
  description: "Permanently remove a private Basil account and My Garden.",
  alternates: { canonical: getBasilUrl("/community-garden/delete-account") },
};

export default function BasilDeleteAccountPage() {
  return (
    <BasilPolicyPage eyebrow="Private account" title="Account & Data Deletion">
      <section>
        <h2>What deletion does</h2>
        <p>
          Signed-in account deletion removes the Supabase Auth user and Basil’s private
          account, My Garden, Care ledger, feedback, and membership entitlement. Sessions
          are revoked. Anonymous public contributions may remain in the Community Garden.
        </p>
      </section>
      <DeleteBasilAccount />
      <section>
        <h2>Need help?</h2>
        <p>If the request fails, keep the reference shown on screen and contact Basil Support. The request is recorded without retaining your email or raw user ID so it can be retried safely.</p>
      </section>
    </BasilPolicyPage>
  );
}
