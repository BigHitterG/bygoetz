import type { Metadata } from "next";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bygoetz.com"),
  applicationName: "By Goetz",
  title: "By Goetz | Art, Stories & Creative Worlds",
  description:
    "The official home of artist and creator Thomas Raymond Goetz: original artwork, The Explorers Series, Gromas and the Gobbledygooks, and Basil Community Garden.",
  authors: [{ name: "Thomas Raymond Goetz", url: "https://www.bygoetz.com/about" }],
  creator: "Thomas Raymond Goetz",
  publisher: "Getz LLC",
  category: "art",
  keywords: [
    "Thomas Raymond Goetz",
    "By Goetz",
    "artist",
    "designer",
    "Des Moines artist",
    "The Explorers Series",
    "Gromas and the Gobbledygooks",
    "Basil Community Garden",
  ],
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}

