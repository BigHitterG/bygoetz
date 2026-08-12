import type { Metadata } from "next";
import { HoneycombBubbles } from "@/components/HoneycombHome";
import { isBasilHostname } from "@/lib/communityGarden/urls";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const siteUrl = "https://www.bygoetz.com";
const homeTitle = "By Goetz | Art, Stories & Creative Worlds";
const homeDescription =
  "Meet artist and creator Thomas Raymond Goetz and explore original artwork, The Explorers Series, Gromas and the Gobbledygooks, and Basil Community Garden.";

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    type: "website",
    url: "/",
    siteName: "By Goetz",
    images: [
      {
        url: "/concepts/images/551F39B2-861F-4C86-A128-FFDC16CEB303.png",
        width: 1024,
        height: 1024,
        alt: "Original illuminated line artwork by Thomas Raymond Goetz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: ["/concepts/images/551F39B2-861F-4C86-A128-FFDC16CEB303.png"],
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: "By Goetz",
      alternateName: ["Thomas Raymond Goetz", "TJ Goetz"],
      description: homeDescription,
      publisher: { "@id": `${siteUrl}/#thomas-raymond-goetz` },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#thomas-raymond-goetz`,
      name: "Thomas Raymond Goetz",
      alternateName: ["TJ Goetz", "By Goetz"],
      url: `${siteUrl}/about`,
      image: `${siteUrl}/images/about/tj-goetz-founder.jpg`,
      jobTitle: "Artist, designer, and creator",
      sameAs: ["https://www.instagram.com/bygoetz/"],
    },
    {
      "@type": "CollectionPage",
      "@id": `${siteUrl}/#homepage`,
      url: `${siteUrl}/`,
      name: homeTitle,
      description: homeDescription,
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#thomas-raymond-goetz` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${siteUrl}/concepts/images/551F39B2-861F-4C86-A128-FFDC16CEB303.png`,
        width: 1024,
        height: 1024,
        caption: "Original illuminated line artwork by Thomas Raymond Goetz",
      },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "The Explorers Series",
            url: `${siteUrl}/explorers`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Gromas and the Gobbledygooks",
            url: `${siteUrl}/gromas`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Basil Community Garden",
            url: "https://basilcommunitygarden.com/",
          },
        ],
      },
    },
  ],
};

type RootPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: RootPageProps) {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0];
  const hostname = (forwardedHost ?? requestHeaders.get("host") ?? "")
    .trim()
    .split(":")[0];
  if (isBasilHostname(hostname)) {
    const incoming = await searchParams;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(incoming)) {
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, item);
      } else if (value !== undefined) {
        params.set(key, value);
      }
    }
    const query = params.toString();
    redirect(`/community-garden${query ? `?${query}` : ""}`);
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <HoneycombBubbles />
    </>
  );
}
