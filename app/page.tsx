import { HoneycombBubbles } from "@/components/HoneycombHome";
import { isBasilHostname } from "@/lib/communityGarden/urls";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
  return <HoneycombBubbles />;
}
