import type { Metadata } from "next";
import "./community-garden.css";

export const metadata: Metadata = {
  title: "Basil | Community Garden",
  description:
    "Basil is a free shared online garden where every visitor can plant, water, and help a living landscape grow.",
  icons: {
    icon: [{ url: "/community-garden/basil-icon-256.png", type: "image/png" }],
    apple: [{ url: "/community-garden/basil-icon-256.png", type: "image/png" }],
  },
  openGraph: {
    title: "Basil | Community Garden",
    description:
      "Plant, water, and care for a living garden shared by everyone.",
    type: "website",
    url: "https://www.bygoetz.com/community-garden",
    images: [
      {
        url: "https://www.bygoetz.com/community-garden/basil-social-1200.jpg",
        width: 1200,
        height: 630,
        alt: "Basil Community Garden with Mary, a duck, herbs, and flowers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Basil | Community Garden",
    description: "Plant, water, and care for a living garden shared by everyone.",
    images: ["https://www.bygoetz.com/community-garden/basil-social-1200.jpg"],
  },
};

export default function CommunityGardenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

