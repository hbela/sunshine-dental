import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import matter from "gray-matter";
import { getLang, loadEnv } from "../lib/env";
import { extractComment, slugify, stripHtmlComments, stripMarkdown } from "../lib/markdown";
import { OUTPUT_DIR, SCENES_PATH, userGuidePath } from "../lib/paths";
import { scenesSchema, type Scene } from "../lib/schema";

loadEnv();
const lang = getLang();

const guidePath = userGuidePath(lang);
if (!existsSync(guidePath)) {
  console.error(`✖ ${guidePath} not found — no user guide for VIDEO_LANG=${lang}.`);
  process.exit(1);
}

const raw = await fs.readFile(guidePath, "utf8");
const { data, content } = matter(raw);
const defaultDuration = Number(data.defaultDurationSeconds ?? 12);

const sections = content.split(/^## /gm).slice(1);

const scenes: Scene[] = sections.map((section, index) => {
  const newlineIdx = section.indexOf("\n");
  const title = (newlineIdx === -1 ? section : section.slice(0, newlineIdx)).trim();
  const body = newlineIdx === -1 ? "" : section.slice(newlineIdx + 1);

  const id = slugify(title) || `scene-${index + 1}`;
  const routeOverride = extractComment(body, "route");
  const durationOverride = extractComment(body, "duration");
  const narration = stripMarkdown(stripHtmlComments(body)).slice(0, 500);
  // ~13 chars/sec is conservative across languages (Hungarian TTS runs slower
  // than the 15 chars/sec the English estimate assumed) + 2 s pad.
  const fittedDuration = Math.ceil(narration.length / 13) + 2;

  return {
    id,
    title,
    route: routeOverride ?? `/${id}`,
    narration,
    screenshot: `screenshots/${lang}/${id}.png`,
    durationSeconds: durationOverride ? Number(durationOverride) : Math.max(defaultDuration, fittedDuration),
  };
});

const parsed = scenesSchema.parse(scenes);
await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.writeFile(SCENES_PATH, JSON.stringify(parsed, null, 2));

console.log(`✓ Wrote ${parsed.length} scenes (${lang}) to ${SCENES_PATH}`);
for (const s of parsed) console.log(`  - ${s.title}  ${s.route}  (${s.durationSeconds}s)`);
