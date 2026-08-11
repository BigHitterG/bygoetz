import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cronSource = readFileSync(`${root}/app/api/cron/basil-social/route.ts`, "utf8");
const newsletterSource = readFileSync(`${root}/lib/communityGarden/newsletter.ts`, "utf8");

assert.match(
  cronSource,
  /mode === "scheduled"\s*\? syncEligibleNewsletterMembers\(\)/,
  "The daily scheduled run must sync paid Garden Members before the monthly send day.",
);

assert.match(
  newsletterSource,
  /!preference\.subscribed && preference\.unsubscribed_at/,
  "Only a durable explicit opt-out may exclude an otherwise eligible member.",
);

console.log("Basil newsletter member synchronization checks passed.");
