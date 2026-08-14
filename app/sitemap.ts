import type { MetadataRoute } from "next";
import { explorerProducts } from "@/lib/explorers/products";

const siteUrl = "https://www.bygoetz.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date("2026-08-14T00:00:00.000Z");

  return [
    {
      url: `${siteUrl}/`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/art`,
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.95,
      images: [`${siteUrl}/art/working-studio.jpg`],
    },
    {
      url: `${siteUrl}/explorers`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/explorers/build-a-set`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/explorers/digital-downloads`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...explorerProducts.map((product) => ({
      url: `${siteUrl}/explorers/products/${product.slug}`,
      lastModified: updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      images: [`${siteUrl}${product.image}`],
    })),
    {
      url: `${siteUrl}/gromas`,
      lastModified: updated,
      changeFrequency: "monthly",
      priority: 0.9,
      images: [`${siteUrl}/gromas/og-gromas-v3.webp`],
    },
  ];
}
