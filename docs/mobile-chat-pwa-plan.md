# Plan: Make the patient chat an installable mobile PWA

## Context

The patient-facing chat currently only lives inside the web SPA (`apps/web`) at the public `/chat` route. We want a **mobile chat app**. After weighing PWA vs. Capacitor vs. a native Expo app, we chose the **PWA (installable web app)** path because it is by far the best fit for this codebase:

- The `/chat` route and its UI (`ChatPanel`) are **already mobile-first** (fills the viewport on phones).
- The chat is served by the same nginx origin as the API, so the PWA stays **same-origin** — `API_BASE_URL` remains `''`, and there are **no CORS, cookie, or `WEB_ORIGIN` changes** (the pain points of Capacitor/native).
- The chat API is public + token-secured and streams over SSE via `fetch` — works in a PWA exactly as it does in the browser today.
- Deploy is an nginx static SPA (Docker/Coolify); a service worker + manifest drop straight into `dist/`.

Outcome: patients can "Add to Home Screen" on Android/iOS and launch a full-screen, standalone chat that opens directly on the receptionist. No app stores, minimal new code, no backend changes.

Scope is the **patient chat only** (the public `/chat` page). The staff dashboard is unaffected.

## Approach

Use **`vite-plugin-pwa`** (Workbox under the hood) in `apps/web`, add a web manifest + icons, inject iOS meta tags, and make nginx serve the service worker uncached. Start URL is `/chat` so the installed app is the chat.

### 1. Add and configure `vite-plugin-pwa`
- Add `vite-plugin-pwa` to `apps/web/package.json` devDependencies (pnpm).
- In `apps/web/vite.config.ts`, register `VitePWA({...})`:
  - `registerType: 'autoUpdate'`, `injectRegister: 'auto'` (silent updates — right for a chat app).
  - `manifest`: `name: "Sunshine Dental Chat"`, `short_name: "SD Chat"`, `description`, `start_url: '/chat'`, `scope: '/'`, `display: 'standalone'`, `theme_color: '#55624d'` (brand sage, from `index.css`), `background_color: '#f8faf3'`, `lang: 'en'`, and the `icons` array (see step 2).
  - `workbox`:
    - `navigateFallback: '/index.html'` with **`navigateFallbackDenylist: [/^\/api\//]`** so navigations to `/api/*` are never served the SPA shell.
    - Do **not** add runtime caching for `/api` — leave chat POST/SSE requests as pure network pass-through (Workbox only intercepts GET navigations + precached assets, so SSE streaming is untouched).
    - `globPatterns` to precache the hashed app shell (`**/*.{js,css,html,svg,png,ico,webmanifest}`).
    - Optional: a `runtimeCaching` `StaleWhileRevalidate` rule for the Google Fonts origins (`fonts.googleapis.com` / `fonts.gstatic.com`) so the shell looks right offline. The fonts are loaded cross-origin in `index.html`.
  - `devOptions: { enabled: false }` (keep the SW out of `vite dev`; verify via `vite preview`).

### 2. Create PWA icons (only `vite.svg` exists today)
- Generate brand icons from the clinic mark (the header uses the lucide `Leaf` glyph on sage `#55624d`). Produce into `apps/web/public/`:
  - `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png` (with safe-zone padding, `purpose: 'maskable'`), `apple-touch-icon.png` (180×180), and a real `favicon.svg`/`favicon.ico`.
- Reference the PNG/maskable icons in the manifest `icons` array.
- Icons can be produced with the `design-assets:favicon-gen` / icon-generator skill or a simple sharp/Playwright render of a leaf-on-sage badge — a deliverable, not hand-written PNGs.

### 3. iOS + head tags in `apps/web/index.html`
iOS ignores most of the manifest, so add manually inside `<head>`:
- `<meta name="theme-color" content="#55624d" />`
- `<meta name="apple-mobile-web-app-capable" content="yes" />`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`
- `<meta name="apple-mobile-web-app-title" content="SD Chat" />`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`
- Replace the `vite.svg` favicon link with the new `favicon.svg`.
- The manifest `<link>` is auto-injected by the plugin (`injectRegister: 'auto'`).

### 4. Serve the service worker uncached (nginx)
In `apps/web/nginx.conf`, add explicit no-cache handling so SW/manifest updates are picked up (the content-hashed `/assets/` are still `immutable`):
```nginx
location = /sw.js            { add_header Cache-Control "no-cache"; try_files $uri =404; }
location = /manifest.webmanifest { add_header Cache-Control "no-cache"; types { application/manifest+json webmanifest; } try_files $uri =404; }
```
No Dockerfile change is needed — `pnpm build` now emits `sw.js`, `workbox-*.js`, `manifest.webmanifest`, and copies `public/` icons into `dist/` automatically.

### 5. (Optional, recommended) In-app "Install app" affordance
- On the `/chat` page, capture the `beforeinstallprompt` event and show a small "Install" button (Android/Chrome). For iOS, show a one-line "Add to Home Screen via Share" hint (iOS has no install prompt). Add the strings to `apps/web/src/locales/{en,hu,de}/chat.json` (i18n).
- Keep this behind the existing `ChatPanel` header area; skip if the app is already running in `display-mode: standalone`.

## Files touched
- `apps/web/package.json` — add `vite-plugin-pwa`.
- `apps/web/vite.config.ts` — register + configure `VitePWA`.
- `apps/web/index.html` — iOS/theme meta + apple-touch-icon + favicon.
- `apps/web/nginx.conf` — no-cache for `sw.js` + `manifest.webmanifest`.
- `apps/web/public/` — new icon assets.
- (optional) `apps/web/src/routes/chat.tsx` or `components/chat/ChatPanel.tsx` + `locales/*/chat.json` — install prompt UI + strings.

**No changes** to `apps/api`, `@repo/shared`, `useChat.ts`, the Dockerfile, or env/config. `API_BASE_URL` stays same-origin `''`.

## Verification
1. **Build:** `pnpm --filter web build`; confirm `apps/web/dist/` contains `sw.js`, `workbox-*.js`, `manifest.webmanifest`, and the icon PNGs.
2. **Local serve:** `pnpm --filter web preview` (or serve `dist/`). In Chrome DevTools → Application: manifest parses with icons, Service Worker is "activated", and the app reports **installable** (no manifest/SW errors). Run a Lighthouse "Installable PWA" check.
3. **Chat still streams:** start a conversation on `/chat`, send a Hungarian message, confirm SSE deltas render token-by-token (SW must not buffer/break the stream) and a booking flow completes — i.e. the service worker leaves `/api/chat/*` untouched.
4. **Install (Android):** Chrome → "Install app" → launches standalone from the home screen, opening straight to `/chat`; icon + name correct.
5. **Install (iOS Safari):** Share → "Add to Home Screen"; confirm apple-touch-icon, standalone status bar, and that `localStorage` session resume still works in standalone mode.
6. **Offline:** with network off, launching the installed app loads the shell (precached) and the chat shows its existing friendly network-error state rather than a blank crash.
7. **Update flow:** rebuild with a visible change, redeploy; confirm the SW auto-updates on next launch (thanks to `autoUpdate` + nginx no-cache on `sw.js`).

## Notes / risks
- **SSE + Workbox:** the only real risk. Mitigated by *not* adding runtime caching for `/api` and by `navigateFallbackDenylist`. Verify explicitly in step 3.
- **iOS limits:** no install prompt (manual A2HS), no web push on older iOS; acceptable for a chat-booking use case. Push notifications are out of scope.
- If app-store presence or native push is later required, this PWA can be wrapped with Capacitor without rework (the same `dist/` + token-based chat API).
