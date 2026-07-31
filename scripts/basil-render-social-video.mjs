import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const recipe = require(resolve(root, "content", "basil-social", "today.json"));
const outputDirectory = resolve(root, "artifacts", "basil-social-studio");
const outputStem = String(recipe.id ?? "basil-social-sample").replace(/[^a-z0-9_-]+/gi, "-");
const frameDirectory = resolve(outputDirectory, `.frames-${outputStem}`);
const outputVideo = resolve(outputDirectory, `${outputStem}.mp4`);
const outputPoster = resolve(outputDirectory, `${outputStem}-poster.jpg`);
const narrationFile = resolve(outputDirectory, `${outputStem}-narration.mp3`);
const narrationWordTimingFile = resolve(outputDirectory, `${outputStem}-word-timing.json`);
const captionTimingFile = resolve(outputDirectory, `${outputStem}-caption-timing.json`);
const pianoFile = resolve(outputDirectory, `${outputStem}-original-piano.wav`);
const outputManifest = resolve(outputDirectory, `${outputStem}.manifest.json`);
const captureFps = 12;
const narration = recipe.narration;
const implementedScenes = new Set(["water-chain"]);

function parseOption(name, fallback) {
  const option = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return option ? option.slice(name.length + 1) : fallback;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

function resolvePython() {
  const candidates = [
    process.env.BASIL_SOCIAL_PYTHON,
    process.platform === "win32" ? resolve(root, ".venv", "Scripts", "python.exe") : resolve(root, ".venv", "bin", "python"),
    process.platform === "win32" ? "python" : "python3",
  ].filter(Boolean);
  const python = candidates.find((candidate) => candidate === "python" || candidate === "python3" || existsSync(candidate));
  if (!python) throw new Error("Python is required for neural narration and the original piano bed.");
  return python;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const runtimePackage = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright");
    if (existsSync(runtimePackage)) return require(runtimePackage);
    const pnpmDirectory = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", ".pnpm");
    const packageDirectory = readdirSync(pnpmDirectory).find((name) => name.startsWith("playwright@"));
    if (!packageDirectory) throw new Error("Playwright is required to render Basil social video frames.");
    return require(join(pnpmDirectory, packageDirectory, "node_modules", "playwright"));
  }
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("The Basil development server stopped before capture began.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function validateCaptionCues(cues) {
  if (!Array.isArray(cues) || cues.length === 0) {
    throw new Error("Narration did not produce caption timing data; refusing to render an unsynchronized package.");
  }
  let previousEnd = -1;
  for (const cue of cues) {
    if (typeof cue.text !== "string" || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.end <= cue.start) {
      throw new Error("Caption timing data contains an invalid cue.");
    }
    if (cue.start < previousEnd - 0.01) throw new Error("Caption timing data is not monotonic.");
    previousEnd = cue.end;
  }
  return cues;
}

function groupWordTimings(wordTimings) {
  const sourceTokens = narration.match(/\S+/g) ?? [];
  const words = wordTimings.map((word, index) => ({
    text: sourceTokens.length === wordTimings.length ? sourceTokens[index] : word.text,
    start: word.start / 1000,
    end: word.end / 1000,
  }));
  const groups = [];
  let current = [];
  words.forEach((word, index) => {
    current.push(word);
    const sentenceEnd = /[.!?][\"']?$/.test(word.text);
    if (current.length >= 6 || (current.length >= 3 && sentenceEnd) || index === words.length - 1) {
      groups.push(current);
      current = [];
    }
  });
  return groups.map((group, index) => ({
    text: group.map((word) => word.text).join(" "),
    start: group[0].start,
    end: groups[index + 1]?.[0]?.start ?? group.at(-1).end + 0.35,
    words: group,
  }));
}

async function createNarration() {
  const voice = process.env.BASIL_SOCIAL_TTS_VOICE ?? "en-US-AvaNeural";
  const python = resolvePython();
  try {
    await run(python, [
      resolve(root, "scripts", "basil-edge-tts.py"),
      "--recipe", resolve(root, "content", "basil-social", "today.json"),
      "--audio", narrationFile,
      "--timings", narrationWordTimingFile,
    ]);
  } catch (error) {
    throw new Error(
      "Calm neural narration failed. Basil will not fall back to robotic TTS; confirm network access and install requirements-social.txt in .venv, or provide BASIL_NARRATION_AUDIO and BASIL_CAPTION_TIMINGS.",
      { cause: error },
    );
  }
  if (!existsSync(narrationFile) || statSync(narrationFile).size < 10_000) throw new Error("Neural narration audio was unexpectedly empty.");
  if (!existsSync(narrationWordTimingFile)) throw new Error("Neural narration did not produce word-boundary timing data.");
  const wordTimings = JSON.parse(readFileSync(narrationWordTimingFile, "utf8"));
  const captionCues = validateCaptionCues(groupWordTimings(wordTimings));
  writeFileSync(captionTimingFile, `${JSON.stringify(captionCues, null, 2)}\n`, "utf8");
  return { audioInput: narrationFile, captionCues, voice, provider: "edge-neural-python" };
}

async function createBackgroundMusic(durationSeconds) {
  const suppliedMusic = process.env.BASIL_BACKGROUND_MUSIC;
  if (suppliedMusic) {
    if (!existsSync(suppliedMusic)) throw new Error(`BASIL_BACKGROUND_MUSIC does not exist: ${suppliedMusic}`);
    return { audioInput: resolve(suppliedMusic), provider: "supplied-music" };
  }
  await run(resolvePython(), [
    resolve(root, "scripts", "basil-generate-piano.py"),
    "--duration", String(durationSeconds + 1),
    "--output", pianoFile,
  ]);
  if (!existsSync(pianoFile) || statSync(pianoFile).size < 100_000) {
    throw new Error("The original relaxing piano bed failed validation.");
  }
  return { audioInput: pianoFile, provider: "original-procedural-piano" };
}

function loadSuppliedNarration() {
  const suppliedNarration = process.env.BASIL_NARRATION_AUDIO ?? process.env.BASIL_NARRATION_WAV;
  if (!suppliedNarration) return null;
  const suppliedTiming = process.env.BASIL_CAPTION_TIMINGS;
  if (!existsSync(suppliedNarration)) throw new Error(`BASIL_NARRATION_AUDIO does not exist: ${suppliedNarration}`);
  if (!suppliedTiming || !existsSync(suppliedTiming)) {
    throw new Error("A supplied narration file requires BASIL_CAPTION_TIMINGS so captions cannot drift from speech.");
  }
  const captionCues = validateCaptionCues(JSON.parse(readFileSync(suppliedTiming, "utf8")));
  return {
    audioInput: resolve(suppliedNarration),
    captionCues,
    voice: process.env.BASIL_SOCIAL_TTS_VOICE ?? "supplied",
    provider: "supplied-audio",
  };
}

async function captureFrames(page, baseUrl, captionCues, durationSeconds) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('[data-capture-ready="true"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__BASIL_SOCIAL_CAPTURE__), undefined, { timeout: 30_000 });
  await page.evaluate((cues) => window.__BASIL_SOCIAL_CAPTURE__?.setCaptionCues(cues), captionCues);
  const dimensions = await page.evaluate(() => window.__BASIL_SOCIAL_CAPTURE__?.dimensions);
  if (dimensions?.width !== 1080 || dimensions?.height !== 1920) {
    throw new Error("The Basil capture scene did not report a 1080x1920 render surface.");
  }
  const frameCount = Math.ceil(durationSeconds * captureFps);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const seconds = frame / captureFps;
    await page.evaluate((time) => window.__BASIL_SOCIAL_CAPTURE__?.setTime(time), seconds);
    await page.screenshot({ path: join(frameDirectory, `frame-${String(frame).padStart(4, "0")}.png`) });
    if (frame % captureFps === 0) process.stdout.write(`Captured ${Math.round(seconds)}s / ${Math.round(durationSeconds)}s\r`);
  }
  process.stdout.write("\n");
}

async function main() {
  if (!implementedScenes.has(recipe.scene)) {
    throw new Error(`Capture scene ${JSON.stringify(recipe.scene)} is not implemented. Refusing to substitute unrelated gameplay.`);
  }
  if (!Array.isArray(recipe.truthClaims) || recipe.truthClaims.some((claim) => claim?.supported !== true || !claim?.basis)) {
    throw new Error("Every production truth claim must be explicitly supported before rendering.");
  }
  mkdirSync(outputDirectory, { recursive: true });
  const encodeOnly = process.argv.includes("--encode-only");
  if (!encodeOnly) {
    rmSync(frameDirectory, { recursive: true, force: true });
    mkdirSync(frameDirectory, { recursive: true });
  }

  let narrationPackage = loadSuppliedNarration();
  if (!narrationPackage && encodeOnly) {
    if (!existsSync(narrationFile) || !existsSync(captionTimingFile)) {
      throw new Error("--encode-only requires existing neural narration, caption timing, and capture frames.");
    }
    narrationPackage = {
      audioInput: narrationFile,
      captionCues: validateCaptionCues(JSON.parse(readFileSync(captionTimingFile, "utf8"))),
      voice: "existing-neural-narration",
      provider: "existing",
    };
  } else if (!narrationPackage) {
    narrationPackage = await createNarration();
  }

  const durationSeconds = Math.max(
    recipe.minimumDurationSeconds ?? 0,
    Number((narrationPackage.captionCues.at(-1).end + 0.85).toFixed(3)),
  );
  const musicPackage = await createBackgroundMusic(durationSeconds);

  if (!encodeOnly) {
    const baseUrl = parseOption("--url", "http://localhost:3010/community-garden/social-capture");
    const shouldStartServer = !process.argv.includes("--no-server");
    const server = shouldStartServer
      ? spawn(process.execPath, [resolve(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3010"], { cwd: root, stdio: "inherit", windowsHide: true })
      : null;
    const playwright = loadPlaywright();
    let browser;
    try {
      if (server) await waitForServer(baseUrl, server);
      browser = await playwright.chromium.launch({ headless: true, channel: "msedge" });
      const context = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await captureFrames(page, baseUrl, narrationPackage.captionCues, durationSeconds);
      await context.close();
    } finally {
      await browser?.close();
      if (server && server.exitCode === null) server.kill();
    }
  } else if (!existsSync(join(frameDirectory, "frame-0000.png"))) {
    throw new Error("--encode-only requires existing capture frames.");
  }

  const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;
  if (!ffmpeg || !existsSync(ffmpeg)) throw new Error("The local FFmpeg binary is not installed correctly.");
  const fadeStart = Math.max(0, durationSeconds - 0.8).toFixed(3);
  await run(ffmpeg, [
    "-y",
    "-framerate", String(captureFps),
    "-i", join(frameDirectory, "frame-%04d.png"),
    "-i", narrationPackage.audioInput,
    "-i", musicPackage.audioInput,
    "-filter_complex", `[0:v]fps=30,format=yuv420p[v];[1:a]aresample=48000,apad,volume=1.8[narration];[2:a]aresample=48000,volume=0.16,highpass=f=90,lowpass=f=6500[piano];[narration][piano]amix=inputs=2:duration=shortest:dropout_transition=0,afade=t=out:st=${fadeStart}:d=0.8[a]`,
    "-map", "[v]",
    "-map", "[a]",
    "-t", String(durationSeconds),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-profile:v", "high",
    "-level", "4.1",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    outputVideo,
  ]);
  const posterSecond = Math.min(10, Math.max(0.5, durationSeconds / 2)).toFixed(3);
  await run(ffmpeg, ["-y", "-ss", posterSecond, "-i", outputVideo, "-frames:v", "1", "-q:v", "2", outputPoster]);
  await run(ffmpeg, ["-v", "error", "-i", outputVideo, "-f", "null", "-"]);
  if (statSync(outputVideo).size < 100_000 || statSync(outputPoster).size < 10_000) {
    throw new Error("Rendered social assets failed the minimum size validation.");
  }
  if (!process.argv.includes("--keep-frames")) rmSync(frameDirectory, { recursive: true, force: true });
  const manifest = {
    schemaVersion: 2,
    recipe: recipe.id,
    contentFamily: recipe.contentFamily,
    objective: recipe.objective,
    format: recipe.format,
    scene: recipe.scene,
    gameplayRecipe: recipe.gameplayRecipe ?? "deterministic-watering-round-v1",
    title: recipe.title,
    summary: recipe.summary,
    whyToday: recipe.whyToday,
    hook: recipe.hook,
    intendedAudience: recipe.intendedAudience,
    distribution: recipe.distribution,
    hypothesis: recipe.hypothesis,
    alternateHooks: recipe.alternateHooks,
    platforms: recipe.platforms,
    destinationUrl: recipe.destinationUrl,
    trackingCode: recipe.trackingCode,
    truthClaims: recipe.truthClaims,
    platformCopy: recipe.platformCopy,
    source: recipe.sourceNote,
    narration,
    voiceProvider: narrationPackage.provider,
    voice: narrationPackage.voice,
    captions: captionTimingFile,
    captionTimingSource: "narration-word-boundaries",
    video: outputVideo,
    poster: outputPoster,
    narrationFile: narrationPackage.audioInput,
    backgroundMusicFile: musicPackage.audioInput,
    backgroundMusicProvider: musicPackage.provider,
    backgroundMusicMix: "quiet-under-narration",
    width: 1080,
    height: 1920,
    durationMs: Math.round(durationSeconds * 1000),
    frameRate: 30,
    codec: "H.264/AAC",
    validationStatus: "valid",
  };
  writeFileSync(outputManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...manifest, manifest: outputManifest }, null, 2));
}

await main();
