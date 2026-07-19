import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getLang, loadEnv } from "../lib/env";
import { AUDIO_DIR, OUTPUT_DIR, PUBLIC_DIR, SCENES_PATH } from "../lib/paths";
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
  console.warn(
    `⚠ Missing screenshots: ${missing.map((m) => m.screenshot).join(", ")} — Studio will show broken images. Run \`pnpm video:screens\`.`,
  );
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
const propsPath = path.join(OUTPUT_DIR, "studio-props.json");
await fs.writeFile(propsPath, JSON.stringify({ scenes: scenesWithAudio, extraAudio, lang }, null, 2));

console.log(`✓ Wrote Studio props to ${propsPath}`);
console.log(`  ${scenesWithAudio.length} scenes, ${scenesWithAudio.filter((s) => s.audio).length} with audio`);
