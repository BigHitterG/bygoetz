"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { trackBasilMetaStandardEvent } from "@/lib/analytics/basilMetaClient";
import { flushMetaEventQueue } from "@/lib/analytics/metaPixel";
import { isBasilHostname } from "@/lib/communityGarden/urls";

export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const trackingEnabled = process.env.NEXT_PUBLIC_META_TRACKING_ENABLED === "true";
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const isBasilHostRoot = useSyncExternalStore(
    () => () => undefined,
    () => pathname === "/" && isBasilHostname(window.location.hostname),
    () => false,
  );
  const isBasilGame = pathname === "/community-garden" || isBasilHostRoot;

  useEffect(() => {
    if (!trackingEnabled || !pixelId || !isBasilGame || lastTrackedPath.current === pathname) return;

    let attempts = 0;
    const trackPage = () => {
      if (typeof window.fbq === "function") {
        flushMetaEventQueue();
        trackBasilMetaStandardEvent("PageView", "page_view");
        lastTrackedPath.current = pathname;
        return;
      }

      attempts += 1;
      if (attempts < 20) window.setTimeout(trackPage, 150);
    };

    trackPage();
  }, [isBasilGame, pathname, pixelId, trackingEnabled]);

  if (!trackingEnabled || !pixelId || !isBasilGame) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');`}
      </Script>
    </>
  );
}

