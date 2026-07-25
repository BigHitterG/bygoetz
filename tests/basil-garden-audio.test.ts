import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const audioSource = await readFile(
  new URL("../app/community-garden/lib/gardenAudio.ts", import.meta.url),
  "utf8",
);
const appSource = await readFile(
  new URL(
    "../app/community-garden/components/CommunityGardenApp.tsx",
    import.meta.url,
  ),
  "utf8",
);
const menuSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenMenu.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("Basil audio is original procedural Web Audio with no media downloads", () => {
  assert.match(audioSource, /new AudioContextClass\(\)/);
  assert.match(audioSource, /webkitAudioContext/);
  assert.match(audioSource, /createOscillator\(\)/);
  assert.match(audioSource, /createBuffer\(1, frameCount/);
  assert.doesNotMatch(audioSource, /\.mp3|\.wav|\.ogg|new Audio\(/i);
});

test("music waits for a user gesture and rests with a hidden tab", () => {
  assert.match(audioSource, /pointerdown/);
  assert.match(audioSource, /keydown/);
  assert.match(audioSource, /context\.resume\(\)/);
  assert.match(audioSource, /visibilitychange/);
  assert.match(audioSource, /MUSIC_BPM = 72/);
});

test("sound preferences persist and remain independently controllable", () => {
  assert.match(audioSource, /basil-audio-settings-v1/);
  assert.match(audioSource, /musicEnabled/);
  assert.match(audioSource, /soundEnabled/);
  assert.match(menuSource, /Garden Sound/);
  assert.match(menuSource, /Music volume/);
  assert.match(menuSource, /Sound effects volume/);
  assert.match(menuSource, /Mute all/);
});

test("core garden actions, discoveries, rewards, and unlocks are sounded", () => {
  for (const sound of [
    "plant",
    "water",
    "care",
    "blossom",
    "worm",
    "unlock",
    "inventory",
    "builder",
    "uproot",
    "path",
    "element",
    "expand",
    "world",
    "error",
  ]) {
    assert.match(appSource, new RegExp(`playGardenSound\\(\"${sound}\"\\)`));
  }
});

