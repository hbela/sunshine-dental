import { z } from "zod";

export const FPS = 30;

// Brand-scene durations are per-language (TTS pacing differs) — see
// `introSeconds` / `heroSeconds` / `outroSeconds` in lib/brand-text.ts.

/** Narration audio for the fixed (non-screenshot) scenes; null = silent. */
export type ExtraAudio = {
  intro: string | null;
  hero: string | null;
  outro: string | null;
};

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  route: z.string().startsWith("/"),
  narration: z.string(),
  screenshot: z.string(),
  durationSeconds: z.number().positive(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const scenesSchema = z.array(sceneSchema);
export type Scenes = z.infer<typeof scenesSchema>;

export type SceneWithAudio = Scene & { audio: string | null };
