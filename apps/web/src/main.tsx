import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { router } from './router'
import { applyTheme, getStoredTheme } from './lib/theme'
import './i18n'
import './index.css'

// Sentry error tracking. No-op when VITE_SENTRY_DSN is empty (dev + any build
// without the DSN baked in). The DSN is a build arg wired through the web
// Dockerfile / Coolify build variables — it is public/non-secret by design.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Errors-only: no performance tracing (keeps overhead + quota minimal).
    tracesSampleRate: 0,
    // Explicit, not just the SDK default: never attach IPs or request details.
    // Patient PII (GDPR) must not leak into error reports.
    sendDefaultPii: false,
    // API query strings carry patient names/phones (?search=, ?patient_name=) —
    // strip them from fetch/XHR breadcrumbs before they reach Sentry.
    beforeBreadcrumb(breadcrumb) {
      const url = breadcrumb.data?.url as string | undefined
      if (
        (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') &&
        url?.includes('?')
      ) {
        breadcrumb.data = { ...breadcrumb.data, url: url.split('?')[0] }
      }
      return breadcrumb
    },
  })
}

applyTheme(getStoredTheme())

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
