import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getLang, loadEnv } from "../lib/env";
import { AUDIO_DIR, OUTPUT_DIR, PUBLIC_DIR, REMOTION_ENTRY, SCENES_PATH, videoOutputPath } from "../lib/paths";
import { scenesSchema, type ExtraAudio, type SceneWithAudio } from "../lib/schema";

loadEnv();
const lang = getLang();

if (!existsSync(SCENES_PATH)) {
  console.error("✖ scenes.json not found. Run `video:scenes` first.");
  process.exit(1);
}
const scenes = scenesSchema.parse(JSON.parse(await fs.readFile(SCENES_PATH, "utf8")));

const missing = scenes.filter((s) => !existsSync(path.join(PUBLIC_DIR, s.screenshot)));
if (missing.length > 0) {
  console.error(`✖ Missing screenshots: ${missing.map((m) => m.screenshot).join(", ")}`);
  process.exit(1);
}

const audioIfExists = (id: string): string | null =>
  existsSync(path.join(AUDIO_DIR, lang, `${id}.mp3`)) ? `audio/${lang}/${id}.mp3` : null;

const scenesWithAudio: SceneWithAudio[] = scenes.map((scene) => ({
  ...scene,
  audio: audioIfExists(scene.id),
}));

const extraAudio: ExtraAudio = {
  intro: audioIfExists("intro"),
  hero: audioIfExists("hero"),
  outro: audioIfExists("outro"),
};

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.mkdir(PUBLIC_DIR, { recursive: true });

console.log("→ Bundling Remotion entry point…");
const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir: PUBLIC_DIR });

console.log("→ Selecting composition…");
const inputProps = { scenes: scenesWithAudio, extraAudio, lang };
const composition = await selectComposition({ serveUrl, id: "DemoVideo", inputProps });

const outputLocation = videoOutputPath(lang);
console.log(`→ Rendering video (${lang})…`);
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation, inputProps });

console.log(`✓ Rendered video to ${outputLocation}`);
