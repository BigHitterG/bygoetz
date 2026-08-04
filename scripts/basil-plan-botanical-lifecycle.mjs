import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback = "") {
  const value = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

const species = option("--species");
if (!/^[a-z0-9-]+$/.test(species)) throw new Error("Pass a lowercase species slug such as --species=rose.");
const profilePath = resolve(root, option("--profile", `content/basil-social/botanical-species/${species}.json`));
const profile = JSON.parse(readFileSync(profilePath, "utf8"));
if (profile.slug !== species || profile.template !== "flowering-plant-v1") throw new Error("The requested species does not match a flowering-plant-v1 profile.");

const immutablePrompt = [
  "Use case: scientific-educational",
  "Asset type: locked-camera botanical lifecycle keyframe for a 9:16 social video",
  `Species: the same individual ${profile.scientificName} (${profile.species}).`,
  `Scene/backdrop: ${profile.cameraLock.background}.`,
  `Camera: ${profile.cameraLock.lens}; camera movement ${profile.cameraLock.cameraMovement}; zoom ${profile.cameraLock.zoom}.`,
  `Lighting: ${profile.cameraLock.lighting}; ${profile.cameraLock.colorTemperature} color temperature.`,
  `Composition: ${profile.cameraLock.centerPoint}.`,
  "Style: ultra-photorealistic botanical studio photography.",
  "Invariants: identical camera, lens, framing, soil, lighting, background, color temperature, scale, and center point across every keyframe.",
  "Text: none. No labels, typography, watermark, border, collage, camera movement, or zoom. Change only the biological stage.",
].join("\n");

const generationPlan = {
  schemaVersion: 1,
  species: profile.species,
  scientificName: profile.scientificName,
  profile: profilePath,
  imageProvider: "OpenAI built-in image generation",
  transitionProvider: "local-aligned-keyframe-blend-v1",
  documentaryFootage: false,
  immutablePrompt,
  keyframes: profile.stages.map((stage, index) => ({
    index,
    id: stage.id,
    output: resolve(root, "public", stage.image.replace(/^\/+/, "")),
    prompt: `${immutablePrompt}\nStage: ${stage.label}. ${stage.biology}`,
  })),
  transitions: profile.stages.slice(0, -1).map((stage, index) => ({
    from: stage.id,
    to: profile.stages[index + 1].id,
    durationSeconds: profile.transitionSeconds,
    rule: "Only the specimen's biology may change; the frame itself remains locked.",
  })),
};

const output = resolve(root, option("--out", `artifacts/basil-social-studio/lifecycle-plans/${species}.generation-plan.json`));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(generationPlan, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, species, keyframes: generationPlan.keyframes.length, transitions: generationPlan.transitions.length, output }, null, 2));

