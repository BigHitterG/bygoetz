import type { Metadata } from "next";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bygoetz.com"),
  title: "Honeycomb Home",
  description: "Apple Watch-style honeycomb app grid",
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

