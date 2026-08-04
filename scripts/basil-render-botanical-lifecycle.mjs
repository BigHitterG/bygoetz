import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback = "") {
  const value = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

function resolveFfmpeg() {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    const runtime = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "ffmpeg", "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
    if (existsSync(runtime)) return runtime;
    return "ffmpeg";
  }
}

function escapeDrawtext(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll("%", "\\%");
}

function validateRecipe(recipe, profile) {
  if (recipe.assetKind !== "video" || recipe.scene !== "botanical-lifecycle") throw new Error("Botanical lifecycle recipes must be video assets using the botanical-lifecycle scene.");
  if (recipe.presentation !== "locked_morph_stage_text" || recipe.audioMode !== "silent") throw new Error("Botanical lifecycle delivery requires locked_morph_stage_text and silent audio mode.");
  if (recipe.narration || recipe.captionCues || recipe.overlay || recipe.voice) throw new Error("Botanical lifecycle videos cannot contain narration, captions, bulletin overlays, or voice configuration.");
  if (profile.template !== "flowering-plant-v1" || !Array.isArray(profile.stages) || profile.stages.length !== 11) throw new Error("The flowering-plant-v1 template requires exactly eleven biological stages, including eventual plant death.");
  if (!Number.isFinite(profile.transitionSeconds) || profile.transitionSeconds < 1 || profile.transitionSeconds > 2) throw new Error("Lifecycle transitions must be between one and two seconds.");
  let previousEnd = 0;
  for (const [index, stage] of profile.stages.entries()) {
    if (stage.startSeconds !== previousEnd || !Number.isFinite(stage.endSeconds) || stage.endSeconds <= stage.startSeconds) throw new Error(`Lifecycle stage ${stage.id ?? index} has a gap, overlap, or invalid duration.`);
    if (!stage.label || !stage.ageRange || !stage.image || !stage.biology) throw new Error(`Lifecycle stage ${stage.id ?? index} is incomplete.`);
    const image = resolve(root, "public", String(stage.image).replace(/^\/+/, ""));
    const allowedRoot = resolve(root, "public", "basil-social", "botanical");
    if (!image.startsWith(allowedRoot) || !existsSync(image)) throw new Error(`Lifecycle keyframe is missing or outside the botanical asset directory: ${stage.image}`);
    previousEnd = stage.endSeconds;
  }
  if (previousEnd < 20 || previousEnd > 25) throw new Error("The lifecycle must finish between 20 and 25 seconds.");
  const pollination = profile.stages.findIndex((stage) => stage.id === "pollination");
  const petalFall = profile.stages.findIndex((stage) => stage.id === "petals-fall");
  const fruit = profile.stages.findIndex((stage) => stage.id === "fruit-and-seed");
  const death = profile.stages.findIndex((stage) => stage.id === "plant-death");
  if (!(pollination >= 0 && pollination < petalFall && petalFall < fruit)) throw new Error("Flowering-plant biology must place pollination before petal fall and fruit development afterward.");
  if (!(fruit < death)) throw new Error("The complete lifecycle must place eventual plant death after fruit and seed development.");
  return previousEnd;
}

async function main() {
  const recipePath = resolve(root, option("--recipe", "content/basil-social/today-2.json"));
  const recipe = JSON.parse(readFileSync(recipePath, "utf8"));
  const requestedSpecies = option("--species");
  const profilePath = resolve(root, option("--profile", recipe.lifecycleProfile ?? (requestedSpecies ? `content/basil-social/botanical-species/${requestedSpecies}.json` : "")));
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  if (requestedSpecies && profile.slug !== requestedSpecies) throw new Error("The selected lifecycle profile does not match --species.");
  const durationSeconds = validateRecipe(recipe, profile);
  const outputDirectory = resolve(root, "artifacts", "basil-social-studio");
  mkdirSync(outputDirectory, { recursive: true });
  const outputStem = String(recipe.id).replace(/[^a-z0-9_-]+/gi, "-");
  const outputVideo = resolve(outputDirectory, `${outputStem}.mp4`);
  const outputPoster = resolve(outputDirectory, `${outputStem}-poster.jpg`);
  const outputManifest = resolve(outputDirectory, `${outputStem}.manifest.json`);
  const ffmpeg = resolveFfmpeg();
  const transition = profile.transitionSeconds;
  const inputArgs = ["-y"];
  for (const stage of profile.stages) {
    // Each still is only consumed by its own hold and adjacent transition. Limiting
    // the decoder to that window avoids decoding every keyframe for the full reel.
    const stageWindow = Math.max(stage.endSeconds - stage.startSeconds, transition);
    inputArgs.push("-loop", "1", "-framerate", "30", "-t", String(stageWindow), "-i", resolve(root, "public", stage.image.replace(/^\/+/, "")));
  }
  inputArgs.push("-f", "lavfi", "-t", String(durationSeconds), "-i", "anullsrc=r=48000:cl=stereo");
  const filters = [];
  profile.stages.forEach((stage, index) => {
    filters.push(`[${index}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=rgba[k${index}]`);
    if (index === 0) filters.push(`[k${index}]split=2[h${index}][a${index}]`);
    else if (index === profile.stages.length - 1) filters.push(`[k${index}]split=2[b${index - 1}][h${index}]`);
    else filters.push(`[k${index}]split=3[b${index - 1}][h${index}][a${index}]`);
  });
  const sequenceInputs = [];
  for (let index = 0; index < profile.stages.length; index += 1) {
    const stage = profile.stages[index];
    const visibleDuration = stage.endSeconds - stage.startSeconds;
    const holdDuration = index === profile.stages.length - 1 ? visibleDuration : visibleDuration - transition;
    filters.push(`[h${index}]trim=duration=${holdDuration},setpts=PTS-STARTPTS[hold${index}]`);
    sequenceInputs.push(`[hold${index}]`);
    if (index < profile.stages.length - 1) {
      filters.push(`[a${index}][b${index}]blend=all_expr='A*(1-T/${transition})+B*(T/${transition})':shortest=1,trim=duration=${transition},setpts=PTS-STARTPTS[transition${index}]`);
      sequenceInputs.push(`[transition${index}]`);
    }
  }
  filters.push(`${sequenceInputs.join("")}concat=n=${sequenceInputs.length}:v=1:a=0[sequence]`);
  const displayScriptFont = process.platform === "win32" ? "C\\:/Windows/Fonts/VIVALDII.TTF" : "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf";
  const detailScriptFont = process.platform === "win32" ? "C\\:/Windows/Fonts/FRSCRIPT.TTF" : "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf";
  let textInput = "sequence";
  profile.stages.forEach((stage, index) => {
    const start = stage.startSeconds;
    const end = stage.endSeconds;
    const fade = Math.min(0.45, (end - start) / 4);
    const alpha = `if(lt(t,${start + fade}),(t-${start})/${fade},if(lt(t,${end - fade}),1,max(0,(${end}-t)/${fade})))`;
    const labelOut = `tl${index}`;
    const rangeOut = `tr${index}`;
    filters.push(`[${textInput}]drawtext=fontfile='${displayScriptFont}':text='${escapeDrawtext(stage.label)}':x=(w-text_w)/2:y=1180:fontsize=104:fontcolor=white@0.96:alpha='${alpha}':enable='between(t,${start},${end})'[${labelOut}]`);
    filters.push(`[${labelOut}]drawtext=fontfile='${detailScriptFont}':text='${escapeDrawtext(stage.ageRange)}':x=(w-text_w)/2:y=1305:fontsize=58:fontcolor=white@0.84:alpha='${alpha}':enable='between(t,${start},${end})'[${rangeOut}]`);
    textInput = rangeOut;
  });
  filters.push(`[${textInput}]fps=30,format=yuv420p[v]`);
  filters.push(`[${profile.stages.length}:a]atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[a]`);
  await run(ffmpeg, [
    ...inputArgs,
    "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[a]", "-t", String(durationSeconds),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-profile:v", "high", "-level", "4.1",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", outputVideo,
  ]);
  await run(ffmpeg, ["-y", "-ss", "13.5", "-i", outputVideo, "-frames:v", "1", "-q:v", "2", outputPoster]);
  await run(ffmpeg, ["-v", "error", "-i", outputVideo, "-f", "null", "-"]);
  if (statSync(outputVideo).size < 300_000 || statSync(outputPoster).size < 10_000) throw new Error("The lifecycle assets failed minimum size validation.");

  const manifest = {
    schemaVersion: 3,
    assetKind: "video",
    recipe: recipe.id,
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
    viewerJob: recipe.viewerJob,
    changedTestVariable: recipe.changedTestVariable,
    contentLane: recipe.contentLane,
    alternateHooks: recipe.alternateHooks,
    platforms: recipe.platforms,
    destinationUrl: recipe.destinationUrl,
    trackingCode: recipe.trackingCode,
    truthClaims: recipe.truthClaims,
    platformCopy: recipe.platformCopy,
    source: recipe.sourceNote,
    sourceImage: null,
    provenance: {
      ...recipe.provenance,
      species: profile.species,
      scientificName: profile.scientificName,
      lifecycleTemplate: profile.template,
      keyframeCount: profile.stages.length,
      transitionCount: profile.stages.length - 1,
      transitionProvider: "local-aligned-keyframe-blend-v1",
      cameraLock: profile.cameraLock,
      sources: profile.sources
    },
    keyframes: profile.stages,
    narration: null,
    voiceProvider: "none",
    voice: null,
    captions: null,
    captionTimingSource: "none",
    video: outputVideo,
    poster: outputPoster,
    narrationFile: null,
    backgroundMusicFile: null,
    backgroundMusicProvider: "none",
    backgroundMusicMix: "silent",
    audioTrack: "silent-aac-compatibility-track",
    typography: {
      stageFont: process.platform === "win32" ? "Vivaldi Italic" : "DejaVu Serif Italic",
      ageFont: process.platform === "win32" ? "French Script MT" : "DejaVu Serif Italic",
      centered: true,
      stageY: 1180,
      ageY: 1305,
    },
    width: 1080,
    height: 1920,
    durationMs: durationSeconds * 1000,
    frameRate: 30,
    codec: "H.264/AAC",
    validationStatus: "valid"
  };
  writeFileSync(outputManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ...manifest, manifest: outputManifest }, null, 2));
}

await main();

