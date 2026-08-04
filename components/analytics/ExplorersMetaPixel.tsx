"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";
import {
  flushExplorersMetaEventQueue,
  trackExplorersMetaEvent,
} from "@/lib/analytics/explorersMetaPixel";

type MetaWindow = Window & { fbq?: (...args: unknown[]) => void };

export function ExplorersMetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_EXPLORERS_META_PIXEL_ID?.trim();
  const trackingEnabled =
    process.env.NEXT_PUBLIC_EXPLORERS_META_TRACKING_ENABLED === "true";
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!trackingEnabled || !pixelId || !pathname.startsWith("/explorers")) return;
    if (lastTrackedPath.current === pathname) return;

    let attempts = 0;
    const trackPage = () => {
      if (typeof (window as MetaWindow).fbq === "function") {
        trackExplorersMetaEvent("PageView", {
          content_category: "The Explorers Series",
        });
        flushExplorersMetaEventQueue();
        lastTrackedPath.current = pathname;
        return;
      }

      attempts += 1;
      if (attempts < 20) window.setTimeout(trackPage, 150);
    };

    trackPage();
  }, [pathname, pixelId, trackingEnabled]);

  if (!trackingEnabled || !pixelId || !pathname.startsWith("/explorers")) {
    return null;
  }

  const pixelIdLiteral = JSON.stringify(pixelId);
  return (
    <Script id="explorers-meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${pixelIdLiteral});`}
    </Script>
  );
}
