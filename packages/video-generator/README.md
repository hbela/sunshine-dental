# @repo/video-generator

Markdown in → screenshots + narration → product demo video out.

```
USER_GUIDE.md → scenes.json → screenshots → narration.mp3 → Remotion → demo.mp4
```

Videos follow the standard structure:

```
BrandIntro (logo animation + feature list) → BrandHero (receptionist photo) → app scenes → BrandOutro (thank you)
```

The brand scenes live in `src/remotion/Brand*.tsx`; their narration texts are the
`EXTRA_TRACKS` map in `3-generate-voice.ts`, and their images are committed under
`public/brand/` (`logo.png` from the web app's PWA icon, `receptionist.png`
AI-generated). Re-branding starts at `BrandLogo.tsx` (colors/name/tagline).

## Pipeline

| Step | Command | Output |
| --- | --- | --- |
| 1. Markdown → scenes | `pnpm video:scenes` | `src/output/scenes.json` |
| 2. Capture screenshots | `pnpm video:screens` | `public/screenshots/<lang>/*.png` |
| 3. Generate narration | `pnpm video:voice` | `public/audio/<lang>/*.mp3` |
| 4. Render video | `pnpm video:render` | `src/output/demo-<lang>.mp4` |

Run the whole pipeline (from the repo root or this package):

```bash
pnpm video                    # English (VIDEO_LANG=en default)
VIDEO_LANG=hu pnpm video      # Hungarian → demo-hu.mp4
```

The pipeline is language-aware: `VIDEO_LANG` picks the guide file
(`USER_GUIDE.md` / `USER_GUIDE.<lang>.md`), forces the app UI language during
capture, selects the narration language (scene text from the guide, brand-scene
text from `EXTRA_TRACKS` in `3-generate-voice.ts` and `lib/brand-text.ts`), and
keeps each language's assets in separate folders. Brand-scene durations are
per-language in `brand-text.ts` — TTS pacing differs, so after changing any
narration verify the mp3 fits its scene (audio is hard-cut at the boundary).
A shell-set variable always beats `.env` (see `lib/env.ts`).

## Studio (visual preview)

Iterate on the video template without a full render — scrub the timeline, edit
`DemoVideo.tsx`, and see changes hot-reload instantly:

```bash
pnpm video:studio
```

This generates a props file from your current scenes/screenshots/audio, then
opens the Remotion Studio at `http://localhost:3333`. Requires `video:scenes`
(and ideally `video:screens` + `video:voice`) to have run first so there's
content to preview.

> **Note:** `--port 3333` avoids the API server (3000) and the Vite dev server
> (5173). This package pins `zod@4.3.6` (the version Remotion requires) — the
> openai SDK peer-dep warning is non-fatal and TTS works fine.

## Setup

1. **Install Playwright's browser** (one-time):

   ```bash
   pnpm video:browsers
   ```

2. **Configure env.** Copy `.env.example` → `.env` (or put keys in the monorepo root `.env`):

   - `APP_URL` — the running web app to screenshot (default `http://localhost:5173`).
   - `LOGIN_EMAIL` / `LOGIN_PASSWORD` — staff login for protected routes
     (defaults in `.env.example` match the seeded admin). Leave blank to skip login.
   - `VIDEO_LANG` — UI language for the captured screenshots (`en`, `hu`, or `de`;
     default `en`). Pre-seeded into `localStorage['sd.lang']` before the app boots.
   - `OPENAI_API_KEY` — optional; if blank, narration is skipped and a silent video is rendered.
   - `TTS_MODEL` / `TTS_VOICE` — OpenAI TTS model and voice (defaults `gpt-4o-mini-tts` / `alloy`).

3. **Run the app** so screenshots can be captured:

   ```bash
   docker compose up -d db          # Postgres
   pnpm --filter api db:seed        # seed same-day (availability is relative to today)
   pnpm dev                         # web on 5173, API on 3000
   ```

   The `/chat` scene sends a real message and waits for the AI reply, so the API
   needs its usual `ANTHROPIC_API_KEY`.

## Authoring the guide

Edit `src/input/USER_GUIDE.md`. Every `## Heading` becomes one scene. Per-scene
overrides are supported via HTML comments:

```markdown
## Calendar
<!-- route: /calendar -->
<!-- duration: 15 -->
Narration text spoken by the TTS voice for this scene.
```

- `route` — the app path to screenshot (defaults to `/<slugified-title>`).
- `duration` — scene length in seconds (defaults to auto-fit from narration length).

Frontmatter supports `defaultDurationSeconds` as the minimum scene length.

## Structure

```
packages/video-generator/
  src/
    input/USER_GUIDE.md      # edit this
    scripts/1..5-*.ts        # pipeline steps + studio props
    remotion/Root.tsx        # composition entry
    remotion/DemoVideo.tsx   # per-scene template
    lib/                     # paths, env, schema, markdown helpers
  public/                    # Remotion static assets (screenshots + audio)
  src/output/                # generated scenes.json + demo.mp4 (gitignored)
```
