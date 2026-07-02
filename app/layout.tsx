import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Honeycomb Home",
  description: "Apple Watch-style honeycomb app grid",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
