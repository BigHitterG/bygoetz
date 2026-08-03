import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");

function parseOption(name, fallback) {
  const option = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return option ? option.slice(name.length + 1) : fallback;
}

const recipePath = resolve(root, parseOption("--recipe", "content/basil-social/today.json"));
const recipe = require(recipePath);
const outputDirectory = resolve(root, "artifacts", "basil-social-studio");
const outputStem = String(recipe.id ?? "basil-social-sample").replace(/[^a-z0-9_-]+/gi, "-");
const frameDirectory = resolve(outputDirectory, `.frames-${outputStem}`);
const rawCaptureFile = resolve(outputDirectory, `${outputStem}-raw-gameplay.webm`);
const outputVideo = resolve(outputDirectory, `${outputStem}.mp4`);
const outputPoster = resolve(outputDirectory, `${outputStem}-poster.jpg`);
const narrationFile = resolve(outputDirectory, `${outputStem}-narration.mp3`);
const narrationWordTimingFile = resolve(outputDirectory, `${outputStem}-word-timing.json`);
const captionTimingFile = resolve(outputDirectory, `${outputStem}-caption-timing.json`);
const musicFile = resolve(outputDirectory, `${outputStem}-original-garden-loop.wav`);
const outputManifest = resolve(outputDirectory, `${outputStem}.manifest.json`);
const captureFps = 12;
const narration = recipe.narration;
const implementedScenes = new Set(["garden-status", "garden-composition", "watering-how-to", "builder-mode", "weed-cleanup", "habitat-discovery", "daily-care-bonus", "flower-lifespans", "heritage-flower-reveal", "plant-first-flower", "garden-worm-discovery"]);

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
  if (!python) throw new Error("Python is required for neural narration and the original garden music bed.");
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
  const voice = process.env.BASIL_SOCIAL_TTS_VOICE ?? recipe.voiceProfile?.voice ?? "en-US-AvaNeural";
  const python = resolvePython();
  try {
    await run(python, [
      resolve(root, "scripts", "basil-edge-tts.py"),
      "--recipe", recipePath,
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
    resolve(root, "scripts", "basil-generate-garden-loop.py"),
    "--duration", String(durationSeconds + 1),
    "--output", musicFile,
  ]);
  if (!existsSync(musicFile) || statSync(musicFile).size < 100_000) {
    throw new Error("The original upbeat garden loop failed validation.");
  }
  return { audioInput: musicFile, provider: "original-procedural-garden-loop" };
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

async function prepareCapture(page, baseUrl, captionCues) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('[data-capture-ready="true"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__BASIL_SOCIAL_CAPTURE__), undefined, { timeout: 30_000 });
  // The capture server runs Next in development mode. Its bottom-left devtools
  // launcher is rendered in a shadow-root portal and otherwise gets baked into
  // screenshots as a stray circular "N". It is tooling, never Basil UI.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate((cues) => window.__BASIL_SOCIAL_CAPTURE__?.setCaptionCues(cues), captionCues);
  await page.evaluate((overlay) => window.__BASIL_SOCIAL_CAPTURE__?.setBulletinOverlay(overlay), recipe.overlay ?? {});
  const dimensions = await page.evaluate(() => window.__BASIL_SOCIAL_CAPTURE__?.dimensions);
  if (dimensions?.width !== 1080 || dimensions?.height !== 1920) {
    throw new Error("The Basil capture scene did not report a 1080x1920 render surface.");
  }
  return page.evaluate(() => window.__BASIL_SOCIAL_CAPTURE__?.captureMode ?? "deterministic");
}

async function captureRealtimeVideo(page, durationSeconds, captionCues, playbackSpeed) {
  await page.evaluate(() => window.__BASIL_SOCIAL_CAPTURE__?.startPlayback?.());
  const base64 = await page.evaluate(async ({ durationMs, cues, overlay, overlayStyle, speed }) => {
    const source = document.querySelector("canvas.cg-canvas");
    if (!(source instanceof HTMLCanvasElement)) throw new Error("The real GardenCanvas was unavailable for recording.");
    if (typeof MediaRecorder === "undefined" || typeof source.captureStream !== "function") {
      throw new Error("This browser cannot record Basil's GardenCanvas directly.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The composite Basil capture canvas was unavailable.");
    const stream = canvas.captureStream(30);
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) throw new Error("No supported browser video recorder was available.");
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    function box(x, y, width, height) {
      context.fillStyle = "rgba(27,37,30,.92)";
      context.fillRect(x, y, width, height);
      context.strokeStyle = "rgba(255,248,232,.92)";
      context.lineWidth = 4;
      context.strokeRect(x, y, width, height);
      context.fillStyle = "rgba(19,27,22,.48)";
      context.fillRect(x + 10, y + height + 4, width, 10);
    }

    function fitText(text, maximumWidth, initialSize, minimumSize = 24) {
      let size = initialSize;
      while (size > minimumSize) {
        context.font = `900 ${size}px Arial, sans-serif`;
        if (context.measureText(text).width <= maximumWidth) break;
        size -= 2;
      }
      return size;
    }

    function captionLines(words, maximumWidth) {
      const lines = [];
      let line = [];
      for (const word of words) {
        const candidate = [...line, word];
        const text = candidate.map((item) => item.text).join(" ");
        if (line.length > 0 && context.measureText(text).width > maximumWidth) {
          lines.push(line);
          line = [word];
        } else {
          line = candidate;
        }
      }
      if (line.length > 0) lines.push(line);
      return lines.slice(0, 3);
    }

    function drawOverlay(seconds) {
      const timelineSeconds = seconds / speed;
      context.imageSmoothingEnabled = false;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(22,29,24,0)");
      gradient.addColorStop(.22, "rgba(22,29,24,0)");
      gradient.addColorStop(.64, "rgba(22,29,24,0)");
      gradient.addColorStop(1, "rgba(22,29,24,.64)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.textBaseline = "middle";
      if (overlayStyle !== "captions_only") {
        box(65, 86, 260, 98);
        context.fillStyle = "#fff8e8";
        context.font = "900 56px Georgia, serif";
        context.fillText("BASIL", 96, 136);

        box(510, 86, 505, 74);
        context.fillStyle = "#f1d08b";
        context.font = "900 28px Arial, sans-serif";
        context.fillText("WREN", 535, 124);
        context.fillStyle = "#fff8e8";
        context.font = "800 27px Arial, sans-serif";
        context.fillText("AI GARDEN STEWARD", 650, 124);
      }

      if (overlayStyle !== "captions_only" && overlay?.progressValue) {
        const fact = `${overlay.progressValue} ${overlay.progressLabel ?? ""}`.trim();
        const factSize = fitText(fact, 370, 36);
        context.font = `900 ${factSize}px Arial, sans-serif`;
        const factWidth = Math.ceil(context.measureText(fact).width) + 42;
        box(65, 205, factWidth, 76);
        context.fillStyle = "#f1d08b";
        context.fillText(String(overlay.progressValue), 88, 244);
        const valueWidth = context.measureText(String(overlay.progressValue)).width;
        context.fillStyle = "#fff8e8";
        context.font = `800 ${Math.max(24, factSize - 5)}px Arial, sans-serif`;
        context.fillText(String(overlay.progressLabel ?? ""), 99 + valueWidth, 244);
      }

      const cue = cues.find((candidate) => timelineSeconds >= candidate.start && timelineSeconds < candidate.end);
      if (cue) {
        const words = cue.words?.length
          ? cue.words
          : String(cue.text ?? "").split(/\s+/).filter(Boolean).map((text) => ({ text, start: cue.start, end: cue.end }));
        context.font = "900 62px Arial, sans-serif";
        const lines = captionLines(words, 820);
        const lineHeight = 72;
        const height = lines.length * lineHeight + 52;
        const top = 1370 - height / 2;
        box(108, top, 864, height);
        lines.forEach((line, lineIndex) => {
          const width = context.measureText(line.map((word) => word.text).join(" ")).width;
          let x = (canvas.width - width) / 2;
          const y = top + 43 + lineIndex * lineHeight;
          for (const word of line) {
            context.fillStyle = timelineSeconds >= word.start && timelineSeconds < word.end
              ? "#f1d08b"
              : timelineSeconds >= word.start ? "#fff8e8" : "rgba(255,248,232,.76)";
            context.fillText(word.text, x, y);
            x += context.measureText(`${word.text} `).width;
          }
        });
      }

      if (overlayStyle !== "captions_only") {
        const disclosure = "AI-directed · actions validated and logged by Basil";
        context.font = "750 24px Arial, sans-serif";
        const disclosureWidth = Math.ceil(context.measureText(disclosure).width) + 36;
        box(1015 - disclosureWidth, 1770, disclosureWidth, 62);
        context.fillStyle = "#fff8e8";
        context.fillText(disclosure, 997 - disclosureWidth, 1802);
      }
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    const paint = (now) => {
      drawOverlay(Math.max(0, (now - startedAt) / 1_000));
      animationFrame = requestAnimationFrame(paint);
    };
    paint(startedAt);
    recorder.start(1_000);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));
    const stopped = new Promise((resolvePromise) => recorder.addEventListener("stop", resolvePromise, { once: true }));
    recorder.stop();
    await stopped;
    cancelAnimationFrame(animationFrame);
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const block = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += block) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
    }
    return btoa(binary);
  }, {
    durationMs: Math.ceil(durationSeconds * playbackSpeed * 1_000),
    cues: captionCues,
    overlay: recipe.overlay ?? {},
    overlayStyle: recipe.overlayStyle ?? "captions_only",
    speed: playbackSpeed,
  });
  writeFileSync(rawCaptureFile, Buffer.from(base64, "base64"));
  if (!existsSync(rawCaptureFile) || statSync(rawCaptureFile).size < 100_000) {
    throw new Error("The direct GardenCanvas recording failed validation.");
  }
  process.stdout.write(`Recorded ${(durationSeconds * playbackSpeed).toFixed(1)}s directly from GardenCanvas at ${playbackSpeed}x edit speed.\n`);
}

async function captureFrames(page, baseUrl, captionCues, durationSeconds, playbackSpeed) {
  const captureMode = await prepareCapture(page, baseUrl, captionCues);
  if (captureMode === "realtime") {
    await captureRealtimeVideo(page, durationSeconds, captionCues, playbackSpeed);
    return "media_recorder";
  }
  const frameCount = Math.ceil(durationSeconds * captureFps);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const seconds = frame / captureFps;
    await page.evaluate((time) => window.__BASIL_SOCIAL_CAPTURE__?.setTime(time), seconds);
    if (captureMode === "realtime") {
      await page.waitForTimeout(Math.round(1_000 / captureFps));
    }
    await page.screenshot({ path: join(frameDirectory, `frame-${String(frame).padStart(4, "0")}.png`) });
    if (frame % captureFps === 0) process.stdout.write(`Captured ${Math.round(seconds)}s / ${Math.round(durationSeconds)}s\r`);
  }
  process.stdout.write("\n");
  return "frame_sequence";
}

async function main() {
  if (!implementedScenes.has(recipe.scene)) {
    throw new Error(`Capture scene ${JSON.stringify(recipe.scene)} is not implemented. Refusing to substitute unrelated gameplay.`);
  }
  if (!Array.isArray(recipe.truthClaims) || recipe.truthClaims.some((claim) => claim?.supported !== true || !claim?.basis)) {
    throw new Error("Every production truth claim must be explicitly supported before rendering.");
  }
  if (recipe.agent?.code === "wren" && (
    recipe.agent.autonomyTier !== 2 ||
    recipe.agent.plannerMode !== "codex_scheduled" ||
    !String(recipe.agent.disclosureText ?? "").includes("AI-directed")
  )) {
    throw new Error("Wren packages must carry the truthful Tier 2 Codex-scheduled AI disclosure.");
  }
  mkdirSync(outputDirectory, { recursive: true });
  const encodeOnly = process.argv.includes("--encode-only");
  if (!encodeOnly) {
    rmSync(frameDirectory, { recursive: true, force: true });
    mkdirSync(frameDirectory, { recursive: true });
    rmSync(rawCaptureFile, { force: true });
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
  const playbackSpeed = Math.min(4, Math.max(1, Number(recipe.playbackSpeed ?? 1)));
  const musicPackage = await createBackgroundMusic(durationSeconds);

  if (!encodeOnly) {
    const captureUrl = new URL(parseOption("--url", "http://localhost:3010/community-garden/social-capture"));
    captureUrl.searchParams.set("scene", recipe.scene);
    captureUrl.searchParams.set(
      "captureMode",
      recipe.captureMode ?? (recipe.agent?.code === "wren" ? "live_gameplay" : "deterministic"),
    );
    const baseUrl = captureUrl.toString();
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
      await captureFrames(page, baseUrl, narrationPackage.captionCues, durationSeconds, playbackSpeed);
      await context.close();
    } finally {
      await browser?.close();
      if (server && server.exitCode === null) server.kill();
    }
  } else if (!existsSync(rawCaptureFile) && !existsSync(join(frameDirectory, "frame-0000.png"))) {
    throw new Error("--encode-only requires an existing direct gameplay recording or capture frames.");
  }

  const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;
  if (!ffmpeg || !existsSync(ffmpeg)) throw new Error("The local FFmpeg binary is not installed correctly.");
  const fadeStart = Math.max(0, durationSeconds - 0.8).toFixed(3);
  const videoInput = existsSync(rawCaptureFile)
    ? ["-i", rawCaptureFile]
    : ["-framerate", String(captureFps), "-i", join(frameDirectory, "frame-%04d.png")];
  await run(ffmpeg, [
    "-y",
    ...videoInput,
    "-i", narrationPackage.audioInput,
    "-i", musicPackage.audioInput,
    "-filter_complex", `[0:v]setpts=PTS/${playbackSpeed},fps=30,format=yuv420p[v];[1:a]aresample=48000,apad,volume=1.8[narration];[2:a]aresample=48000,volume=0.14,highpass=f=90,lowpass=f=7200[music];[narration][music]amix=inputs=2:duration=shortest:dropout_transition=0,afade=t=out:st=${fadeStart}:d=0.8[a]`,
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
    schemaVersion: recipe.schemaVersion ?? 3,
    recipe: recipe.id,
    agent: recipe.agent ?? null,
    agentMissionId: recipe.agentMissionId ?? null,
    contentLane: recipe.contentLane ?? null,
    captureMode: recipe.captureMode ?? "deterministic",
    captureTransport: existsSync(rawCaptureFile) ? "garden_canvas_media_recorder" : "frame_sequence",
    playbackSpeed,
    overlayStyle: recipe.overlayStyle ?? "captions_only",
    captureProvenance: recipe.captureProvenance ?? {},
    contentFamily: recipe.contentFamily,
    bulletinType: recipe.bulletinType,
    bulletinLabel: recipe.bulletinLabel,
    objective: recipe.objective,
    format: recipe.format,
    scene: recipe.scene,
    gameplayRecipe: recipe.gameplayRecipe,
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
    voiceProfile: recipe.voiceProfile ?? { id: "wren-clear-v1", character: "clear_neural" },
    captions: captionTimingFile,
    captionTimingSource: "narration-word-boundaries",
    video: outputVideo,
    sourceCapture: existsSync(rawCaptureFile) ? rawCaptureFile : null,
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
