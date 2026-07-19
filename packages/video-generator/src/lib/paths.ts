import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PKG_ROOT = path.resolve(__dirname, "../..");
export const MONOREPO_ROOT = path.resolve(PKG_ROOT, "../..");

export const INPUT_DIR = path.join(PKG_ROOT, "src/input");

/** USER_GUIDE.md for English, USER_GUIDE.<lang>.md otherwise. */
export function userGuidePath(lang: string): string {
  return path.join(INPUT_DIR, lang === "en" ? "USER_GUIDE.md" : `USER_GUIDE.${lang}.md`);
}

export const OUTPUT_DIR = path.join(PKG_ROOT, "src/output");
export const SCENES_PATH = path.join(OUTPUT_DIR, "scenes.json");

export function videoOutputPath(lang: string): string {
  return path.join(OUTPUT_DIR, `demo-${lang}.mp4`);
}

export const PUBLIC_DIR = path.join(PKG_ROOT, "public");
export const SCREENSHOTS_DIR = path.join(PUBLIC_DIR, "screenshots");
export const AUDIO_DIR = path.join(PUBLIC_DIR, "audio");

export const REMOTION_ENTRY = path.join(PKG_ROOT, "src/remotion/Root.tsx");
