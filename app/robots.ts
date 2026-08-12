import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/community-garden/admin/",
        "/community-garden/newsletter/review",
        "/community-garden/social-capture",
        "/community-garden/social-daily-update",
        "/community-garden/social-diagram",
        "/community-garden/social-studio",
      ],
    },
    sitemap: "https://www.bygoetz.com/sitemap.xml",
    host: "https://www.bygoetz.com",
  };
}
