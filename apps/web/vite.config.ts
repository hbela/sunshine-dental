import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Where the dev proxy forwards /api requests. Override with API_PROXY_TARGET
// (e.g. http://localhost:3100 if the API runs on a non-default port).
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000'

export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackRouterVite(),
    react(),
    // Installable PWA for the patient chat. The app is served same-origin with
    // the API, so the service worker must NEVER touch /api (SSE streaming +
    // POSTs go straight to the network). See docs/mobile-chat-pwa-plan.md.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Keep the SW out of `vite dev`; verify via `vite preview`.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sunshine Dental Chat',
        short_name: 'SD Chat',
        description: 'Chat with Sunshine Dental Clinic to book and manage appointments.',
        lang: 'en',
        start_url: '/chat',
        scope: '/',
        display: 'standalone',
        theme_color: '#55624d',
        background_color: '#f8faf3',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512x512.png',
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
