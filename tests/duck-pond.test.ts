import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const projectFile = (path: string) =>
  new URL(`../${path}`, import.meta.url);

test("the Duck Pond app is absent from the LazyGrid and site routes", () => {
  const honeycomb = readFileSync(
    projectFile("components/HoneycombHome.tsx"),
    "utf8",
  );

  assert.doesNotMatch(honeycomb, /duck.?pond/i);
  assert.equal(existsSync(projectFile("app/duck-pond/page.tsx")), false);
});
