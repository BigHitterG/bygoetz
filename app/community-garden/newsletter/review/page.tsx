import type { Metadata } from "next";
import { NewsletterReview } from "./NewsletterReview";

export const metadata: Metadata = {
  title: "Review Basil Garden Letter",
  robots: { index: false, follow: false, nocache: true },
};

export default function NewsletterReviewPage() {
  return <NewsletterReview />;
}
