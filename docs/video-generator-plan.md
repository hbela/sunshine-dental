# Video generator — plan & usage

A Remotion-based demo-video pipeline for Sunshine Dental, ported from the verified
implementation in the Founder Sales CRM repo (skill:
`C:\devs\prods\founder-sales-crm\generate-video-skill\SKILL.md`).

```
USER_GUIDE.md → scenes.json → screenshots (Playwright) → narration (OpenAI TTS) → demo.mp4 (Remotion)
```

## Goal

An English-language product demo video (~8 scenes ≈ 1.5–2 min) covering the full
user-guide flow: AI chat receptionist (with a live AI reply captured), dashboard,
calendar, patients, appointments, call logs, chat logs, settings.

## Where it lives

`packages/video-generator` (`@repo/video-generator`), wired into the root
`package.json` as `video:*` scripts — same pattern as the `guide:*` family.

| Step | Command | Output |
| --- | --- | --- |
| 1. Markdown → scenes | `pnpm video:scenes` | `src/output/scenes.json` |
| 2. Capture screenshots | `pnpm video:screens` | `public/screenshots/*.png` |
| 3. Generate narration | `pnpm video:voice` | `public/audio/*.mp3` |
| 4. Render video | `pnpm video:render` | `src/output/demo.mp4` |
| All of the above | `pnpm video` | `demo.mp4` |
| Studio preview | `pnpm video:studio` | live UI at `localhost:3333` |

## Sunshine-specific adaptations (vs. the founder-sales-crm original)

- **Package scope**: `@repo/video-generator`; tsconfig extends
  `@repo/typescript-config/base.json` with Bundler resolution + `jsx: react-jsx`.
- **Typecheck script**: named `check-types` to match the Turbo task convention.
- **App URL**: `http://localhost:5173` (Vite dev server; `/api` proxied to the API
  on 3000 so the better-auth session cookie stays first-party).
- **Login**: cookie/session-based better-auth — the capture script logs in for real
  via `#email` / `#password` / `button[type="submit"]` with the seeded admin
  (`admin@sunshine.dental` / `Admin1234!`), then waits until the URL leaves `/login`.
- **Language**: the app is trilingual; the capture script pre-seeds
  `localStorage['sd.lang'] = VIDEO_LANG` (default `en`) via Playwright
  `storageState` before any app code runs — the same trick as
  `scripts/screenshot-app.mts` (the `guide:shots` pipeline).
- **Chat scene**: `/chat` is captured **before** logging in (it's public). The
  script types a booking question, sends it, and waits for the streamed AI reply
  to finish so the screenshot shows a real exchange. Requires the API to have
  `ANTHROPIC_API_KEY` set, as usual.
- **Studio port**: `3333` (3000 = API, 5173 = web, and the my-blog portfolio also
  competes for 3000).
- **Theming**: no shadcn/oklch tailwind fix needed here (Tailwind v4, raw-hex CSS
  vars). Video colors follow the app's sage palette (`#f8faf3` background).

## Prerequisites for a full run

1. Postgres up (`docker compose up -d db`) and seeded **same-day**
   (`pnpm --filter api db:seed` — availability seeds are relative to today).
2. Dev servers running: `pnpm dev` (web 5173 + API 3000; don't run my-blog on 3000
   at the same time).
3. One-time: `pnpm video:browsers` (installs Chromium for Playwright).
4. Optional: `OPENAI_API_KEY` in the root or package `.env` for TTS narration —
   without it the pipeline still renders a silent video.

## Authoring

Edit `packages/video-generator/src/input/USER_GUIDE.md`. Every `## Heading` is one
scene; `<!-- route: /path -->` and `<!-- duration: N -->` comments override the
route and length. Scene duration auto-fits the narration (~15 chars/sec + 2 s pad).

## Verified gotchas carried over from the reference implementation

`registerRoot()` in the Remotion entry; assets under `public/` via `staticFile()`;
narration embedded with Remotion `<Audio>` (single-pass render); `domcontentloaded`
+ short timeout instead of `networkidle` (Vite HMR never settles); dynamic
`durationInFrames` via `calculateMetadata`; `<Sequence>` per scene; TTS
skip-if-exists and exit-0 without an API key; `@remotion/bundler` + `@remotion/cli`
installed explicitly; Studio needs the generated props file and an explicit free
port; **zod pinned exactly to `4.3.6`** (zod 3 crashes the Remotion Studio).
