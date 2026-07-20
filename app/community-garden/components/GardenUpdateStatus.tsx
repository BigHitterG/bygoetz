"use client";

import { useEffect, useState } from "react";

type GardenUpdateStatusProps = {
  nextUpdateAt: number | null;
};

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function GardenUpdateStatus({
  nextUpdateAt,
}: GardenUpdateStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextUpdateAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextUpdateAt]);

  if (!nextUpdateAt) return null;
  const remaining = nextUpdateAt - now;
  return (
    <span
      className="cg-update-status"
      title="The shared Community Garden quietly refreshes every ten minutes."
      aria-label={
        remaining > 0
          ? `Community map updates in ${formatRemaining(remaining)}`
          : "Community map is updating"
      }
    >
      {" · "}
      {remaining > 0 ? `updates ${formatRemaining(remaining)}` : "updating"}
    </span>
  );
}
