# Embed the latest Retell call recording into the 3 user guides

## Context

The trilingual Sunshine Dental user guides (en/hu/de) are published to the portfolio
(my-blog) as three slugs: `sunshine-dental`, `sunshine-dental-hu`, `sunshine-dental-de`.
Today the guides are text + screenshots only. We want to showcase the AI receptionist
in action by embedding an audio player of a **real** Retell call so a portfolio visitor
can *hear* a booking handled end-to-end.

Retell returns several recording URLs per call; we use `recording_url` (caller + agent
mixed, single channel). The "latest call" to feature is:

- **call_id**: `call_1d1ae032a297955303d3fbf2b63` (web call, ended, **successful**, Positive sentiment)
- **summary**: caller booked a *filling* with Dr. Alice Nguyen for June 19 2026 11:30 AM; agent sent a confirmation email.
- **recording_url**: `https://dxc03zgurdly9.cloudfront.net/b8f20892a990d4ec9fb4f1618d6d6347fca487058a93f28ea069c898bab16857/recording.wav`
- `opt_in_signed_url: false` → the CloudFront URL is public/unsigned (downloadable without auth).

**Decisions (confirmed with user):**
- **Self-host as mp3** (not a remote-URL embed) — robust, no external dependency, consistent with how screenshots are already committed into my-blog `public/<slug>/` and baked into the Docker image.
- Add a **new H2 section "🎧 Hear a real call"** near the top of each guide (so it also appears in the sidebar nav).

**Notes / caveats:**
- Retell provides a **`.wav`**, not mp3 — we transcode (the user asked for "mp3").
- `ffmpeg` is **not installed** anywhere on this machine, so we add the `ffmpeg-static` npm devDep (ships a bundled binary) and call it from a script.
- The recorded audio says "Dr. Alice Nguyen"; the app was later renamed to Dr. Nagy (commit 5d37f81). This is a historical recording artifact and is acceptable for a demo.

## How the pipeline works today (reused, not rebuilt)

- Guides reference assets as `assets/screenshots/<name>.png`.
- `scripts/publish-user-guide.mts` (lines 127-152) scans the markdown for `assets/screenshots/*.png`, copies the matching files from `docs/assets/screenshots/<LANG>/` into my-blog `public/<slug>/`, then POSTs the raw markdown to the import API.
- my-blog `src/app/api/projects/import/route.ts` (lines 61-64) rewrites `assets/screenshots/` → `/<slug>/` (extension-agnostic, whole-string replace — works for `.mp3` too) before storing.
- my-blog renders the stored markdown through `marked` v17 with **no sanitization**, output via `dangerouslySetInnerHTML` (`src/components/DocThemeProject.tsx:87`) — so a raw `<audio>` HTML block in the markdown passes straight through to the page.

This means: by keeping the audio under the `assets/screenshots/` prefix, the import-route rewrite and marked passthrough need **zero changes**. Only the publish copy step (which currently filters `.png`) must learn about `.mp3`.

## Changes

### 1. Fetch + transcode the recording — new `scripts/fetch-call-audio.mts`
A small `.mts` script (repo style: tsx, root devDeps) that:
1. Downloads the `recording_url` (passed via `--url`, default = the call above) to a temp `.wav`.
2. Transcodes wav→mp3 using `ffmpeg-static`'s binary path (mono, ~64–96 kbps — keeps the file small).
3. Writes the result to **all three** language screenshot dirs so the existing per-language copy logic picks it up unchanged:
   - `docs/assets/screenshots/en/latest-call.mp3`
   - `docs/assets/screenshots/hu/latest-call.mp3`
   - `docs/assets/screenshots/de/latest-call.mp3`

Add `ffmpeg-static` to root `devDependencies` and a `guide:audio` script in root `package.json` (mirrors the existing `guide:shots` / `guide:publish` entries).

### 2. Extend the publish copy step — `scripts/publish-user-guide.mts`
Generalize the asset regex/copy (around lines 127-150) from png-only to png+mp3, capturing the **full filename incl. extension** instead of appending `.png`:
- `const re = /assets\/screenshots\/([\w-]+\.(?:png|mp3))/g`
- `referenced.add(m[1])` now holds e.g. `latest-call.mp3`
- copy `join(shotsDir, name)` → `join(destDir, name)` (no hard-coded `.png`)
- update the two `.png`-specific error/log strings to be extension-neutral.

This preserves identical behaviour for the 8 existing screenshots.

### 3. Add the audio section to all 3 guides
Insert a new H2 section after the intro in each of `docs/user-guide.md`, `docs/user-guide.hu.md`, `docs/user-guide.de.md`, with localized prose and the same player markup:

```markdown
## 🎧 Hear a real call

A real booking call, handled end-to-end by the AI receptionist — from greeting to a confirmed appointment.

<audio controls preload="none" src="assets/screenshots/latest-call.mp3"></audio>
```

(HU/DE: translate the heading + caption; the `<audio>` tag stays identical. `preload="none"` avoids fetching the mp3 until the visitor hits play. The `assets/screenshots/...` src is rewritten to `/<slug>/latest-call.mp3` by the import route.)

### 4. (Optional polish) audio styling in my-blog
If the default player looks cramped, add one rule to my-blog `public/doc-theme/doc-theme.css` (e.g. `.doc-content audio { width: 100%; margin: 1rem 0; }`). Not required for it to work.

## Publish + deploy
1. `pnpm guide:audio` — produce the three mp3s.
2. Republish each language to the **local** my-blog (prod has no import route): with my-blog running `next dev -p 3001` and root `.env` `PORTFOLIO_API_URL=http://localhost:3001`, run `pnpm guide:publish:en`, `:hu`, `:de` (copies the mp3 into `public/<slug>/` and upserts the DB row).
3. Commit the new mp3s under my-blog `public/<slug>/` and **redeploy my-blog** (Docker bakes `public/`; the shared prod DB row already updated, but images/audio ship only on redeploy).

## Verification
- **Local render**: with my-blog on `:3001`, open `/projects/sunshine-dental` (and `-hu`, `-de`). Confirm the "Hear a real call" section appears in the body and sidebar nav, the player renders, and pressing play streams the call. Hit `/sunshine-dental/latest-call.mp3` directly → 200 audio.
- **Script sanity**: `pnpm guide:publish:en` logs "Copied N image(s)" with N increased by 1 and no "Missing screenshots" error (proves the mp3 was matched + copied).
- **Prod**: after redeploy, repeat the player check on portfolio.appointer.hu for all three slugs.
