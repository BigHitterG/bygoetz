import type { Metadata } from "next";
import { DigitalDownloadSuccessPage } from "@/components/explorers/DigitalDownloadSuccessPage";

export const metadata: Metadata = {
  title: "Download Email Sent | The Explorers Series",
  description:
    "Your Explorers Series digital download link has been sent by email from Goetz.",
};

export default function Page() {
  return <DigitalDownloadSuccessPage />;
}
