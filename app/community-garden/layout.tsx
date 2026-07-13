import type { Metadata } from "next";
import "./community-garden.css";

export const metadata: Metadata = {
  title: "Community Garden | By Goetz",
  description:
    "A free shared online garden where every visitor can plant roses, water them, and bring color back to the world.",
};

export default function CommunityGardenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

