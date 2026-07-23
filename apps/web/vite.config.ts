import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
// Relative path on purpose: Vite loads this config in Node and treats bare
// specifiers like `@repo/shared` as external, which fails because that package
// ships raw TypeScript. A relative import gets bundled by esbuild instead.
import { getClinic } from '../../packages/shared/src/clinic.js'

// Where the dev proxy forwards /api requests. Override with API_PROXY_TARGET
// (e.g. http://localhost:3100 if the API runs on a non-default port).
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000'

// Which clinic this bundle is for (unset → sunshine). Read from the process env
// rather than import.meta.env because this runs in Node at build time; Coolify
// passes it as the VITE_CLINIC_ID **build arg** (see docker-compose.yml).
const clinic = getClinic(process.env.VITE_CLINIC_ID)
const assets = clinic.brand.assetBasePath ?? '/'

/**
 * Stamp the clinic's identity into index.html. The file keeps Sunshine's values
 * as literals so `vite dev` and a plain build still look right; this rewrites
 * them for any other clinic.
 */
function clinicHtml(): Plugin {
  return {
    name: 'clinic-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${clinic.fullName}</title>`)
        .replace(
          /(<meta name="theme-color" content=")[^"]*(")/,
          `$1${clinic.brand.themeColor}$2`,
        )
        .replace(
          /(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/,
          `$1${clinic.shortName}$2`,
        )
        .replace(/(<link rel="icon" type="image\/svg\+xml" href=")[^"]*(")/, `$1${assets}favicon.svg$2`)
        .replace(/(<link rel="apple-touch-icon" href=")[^"]*(")/, `$1${assets}apple-touch-icon.png$2`)
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackRouterVite(),
    react(),
    clinicHtml(),
    // Installable PWA for the patient chat. The app is served same-origin with
    // the API, so the service worker must NEVER touch /api (SSE streaming +
    // POSTs go straight to the network). See docs/mobile-chat-pwa-plan.md.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Keep the SW out of `vite dev`; verify via `vite preview`.
      devOptions: { enabled: false },
      includeAssets: [`${assets}favicon.svg`.slice(1), `${assets}apple-touch-icon.png`.slice(1)],
      manifest: {
        name: `${clinic.name} Chat`,
        short_name: clinic.shortName,
        description: `Chat with ${clinic.fullName} to book and manage appointments.`,
        lang: clinic.defaultLanguage,
        start_url: '/chat',
        scope: '/',
        display: 'standalone',
        theme_color: clinic.brand.themeColor,
        background_color: clinic.brand.backgroundColor,
        icons: [
          { src: `${assets}pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${assets}pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${assets}pwa-maskable-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // SPA fallback for client-side routes — but never hijack /api navigations.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // No runtime caching for /api: chat POST + SSE must pass straight through.
        // Cache the cross-origin Google Fonts so the installed shell looks right offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Proxy API calls so the browser only ever talks to the Vite origin.
    // This avoids CORS and keeps the better-auth session cookie first-party.
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
