import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { getLang, loadEnv } from "../lib/env";
import { AUDIO_DIR, SCENES_PATH } from "../lib/paths";
import { scenesSchema } from "../lib/schema";

loadEnv();
const lang = getLang();
const langAudioDir = path.join(AUDIO_DIR, lang);

const apiKey = process.env.OPENAI_API_KEY ?? "";
const model = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
const voice = process.env.TTS_VOICE ?? "alloy";

if (!apiKey) {
  console.warn("⚠ OPENAI_API_KEY not set — skipping narration generation.");
  process.exit(0);
}
if (!existsSync(SCENES_PATH)) {
  console.error("✖ scenes.json not found. Run `video:scenes` first.");
  process.exit(1);
}

const scenes = scenesSchema.parse(JSON.parse(await fs.readFile(SCENES_PATH, "utf8")));
await fs.mkdir(langAudioDir, { recursive: true });
const openai = new OpenAI({ apiKey });

// Narration for the fixed brand scenes (intro / receptionist hero / outro), per
// language. Lengths are tuned to the *_DURATION_IN_FRAMES constants in
// lib/schema.ts — verify generated mp3 durations still fit after edits.
const EXTRA_TRACKS: Record<string, Record<string, string>> = {
  en: {
    intro:
      "Welcome to Sunshine Dental — the AI-powered front desk for dental clinics. " +
      "AI receptionists chat with patients and answer calls around the clock. " +
      "Appointments land straight in live provider calendars. Patient data stays encrypted at rest. " +
      "And the whole app speaks English, Hungarian, and German.",
    hero:
      "This is reception without the hold music. Sunshine Dental answers every call and every chat " +
      "instantly, day or night — so your team can stay with the patients in the chair.",
    outro:
      "Thank you for watching. Sunshine Dental is an AI-powered front desk for dental clinics — " +
      "chat and voice receptionists, live scheduling, and secure patient records in one calm app. " +
      "If you'd like a version tailored to your practice, get in touch using the details below. " +
      "And don't forget to like and subscribe for more demos.",
  },
  hu: {
    intro:
      "Üdvözlünk a Sunshine Dentalnál — ez az AI-alapú recepció fogorvosi rendelőknek. " +
      "Az AI recepciósok éjjel-nappal csevegnek a páciensekkel és fogadják a hívásokat. " +
      "Az időpontok azonnal az élő orvosi naptárakba kerülnek. A páciensadatok titkosítva tárolódnak. " +
      "Az alkalmazás pedig magyarul, angolul és németül is beszél.",
    hero:
      "Ez a recepció sosem tart szünetet. A Sunshine Dental minden hívásra és csevegésre azonnal " +
      "válaszol, éjjel és nappal — így a csapat a székben ülő páciensekre figyelhet.",
    outro:
      "Köszönjük, hogy megnézted a videót. A Sunshine Dental AI-alapú recepció fogorvosi rendelőknek — " +
      "csevegés, hívások, időpontfoglalás és biztonságos páciensadatok egyetlen letisztult alkalmazásban. " +
      "Ha a rendelődre szabott változatra van szükséged, keress bátran az alábbi elérhetőségeken. " +
      "És ne felejts el lájkolni és feliratkozni a további bemutatókért!",
  },
};

const extraTracks = EXTRA_TRACKS[lang] ?? EXTRA_TRACKS.en ?? {};

let generated = 0, skipped = 0, failed = 0;

const tracks: { id: string; label: string; text: string }[] = [
  ...Object.entries(extraTracks).map(([id, text]) => ({ id, label: `${id} (brand scene, ${lang})`, text })),
  ...scenes.filter((s) => s.narration).map((s) => ({ id: s.id, label: s.title, text: s.narration })),
];

for (const track of tracks) {
  const outPath = path.join(langAudioDir, `${track.id}.mp3`);
  if (existsSync(outPath)) { console.log(`→ Skipping ${track.label} (already exists)`); skipped++; continue; }
  try {
    console.log(`→ Generating voice for ${track.label}…`);
    const audio = await openai.audio.speech.create({ model, voice, input: track.text });
    await fs.writeFile(outPath, Buffer.from(await audio.arrayBuffer()));
    generated++;
  } catch (err) {
    console.warn(`⚠ Failed for ${track.label}: ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}
console.log(`✓ Generated ${generated}, skipped ${skipped}, failed ${failed} — ${langAudioDir}`);
