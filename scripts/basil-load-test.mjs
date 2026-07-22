import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function percentile(values, value) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

async function createMockTarget() {
  const actions = new Map();
  let plants = 0;
  const server = createServer(async (request, response) => {
    if (request.url?.startsWith("/api/community-garden/snapshot")) {
      response.setHeader("content-type", "application/json");
      response.setHeader("cache-control", "public, max-age=10");
      response.end(JSON.stringify({ version: 1, plants: [], plantCount: plants }));
      return;
    }
    if (request.method === "POST" && request.url === "/api/community-garden/action") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body);
      const existing = actions.get(parsed.actionId);
      if (existing) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(existing));
        return;
      }
      plants += 1;
      const result = { accepted: true, actionId: parsed.actionId, plantCount: plants };
      actions.set(parsed.actionId, result);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(result));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    getUniqueActions: () => actions.size,
  };
}

function assertSafeTarget(baseUrl, mock) {
  const url = new URL(baseUrl);
  if (/^(www\.)?(basilcommunitygarden\.com|bygoetz\.com)$/i.test(url.hostname)) {
    throw new Error("Production Basil/ByGoetz load testing is blocked.");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!mock && !local && process.env.BASIL_DISPOSABLE_LOAD_TEST !== "I_ACCEPT_TEST_COSTS") {
    throw new Error(
      "Remote tests require a disposable project and BASIL_DISPOSABLE_LOAD_TEST=I_ACCEPT_TEST_COSTS.",
    );
  }
}

async function main() {
  const users = Math.max(1, Number(option("users", "5")));
  const seconds = Math.max(1, Number(option("seconds", "3")));
  const useMock = process.argv.includes("--mock");
  const mock = useMock ? await createMockTarget() : null;
  const baseUrl = mock?.baseUrl ?? option("base-url", "http://127.0.0.1:3000");
  assertSafeTarget(baseUrl, Boolean(mock));

  const latencies = [];
  let requests = 0;
  let errors = 0;
  let conflicts = 0;
  let replayChecks = 0;
  const startedAt = Date.now();
  const deadline = startedAt + seconds * 1_000;

  async function measuredFetch(url, init) {
    const started = performance.now();
    try {
      const response = await fetch(url, init);
      latencies.push(performance.now() - started);
      requests += 1;
      if (response.status === 409) conflicts += 1;
      else if (!response.ok) errors += 1;
      return response;
    } catch {
      latencies.push(performance.now() - started);
      requests += 1;
      errors += 1;
      return null;
    }
  }

  await Promise.all(
    Array.from({ length: users }, async (_, user) => {
      await measuredFetch(`${baseUrl}/api/community-garden/snapshot`);
      let iteration = 0;
      while (Date.now() < deadline) {
        const actionId = randomUUID();
        const payload = JSON.stringify({
          actionId,
          action: "plant",
          gridX: -96 + ((user * 17 + iteration) % 160),
          gridY: -96 + ((user * 31 + iteration * 3) % 160),
          plantType: "rose",
        });
        const init = {
          method: "POST",
          headers: { "content-type": "application/json", origin: baseUrl },
          body: payload,
        };
        await measuredFetch(`${baseUrl}/api/community-garden/action`, init);
        if (iteration === 0) {
          replayChecks += 1;
          await measuredFetch(`${baseUrl}/api/community-garden/action`, init);
        }
        iteration += 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }),
  );

  const elapsedSeconds = (Date.now() - startedAt) / 1_000;
  const result = {
    target: useMock ? "in-process mock" : baseUrl,
    users,
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    requests,
    requestsPerSecond: Number((requests / elapsedSeconds).toFixed(2)),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(2)),
    p95Ms: Number(percentile(latencies, 0.95).toFixed(2)),
    errors,
    conflicts,
    replayChecks,
    uniqueActions: mock?.getUniqueActions() ?? null,
  };
  await mock?.close();
  console.log(JSON.stringify(result));
  if (errors > 0) process.exitCode = 1;
}

await main();
