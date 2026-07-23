import { getClinic } from '@repo/shared'

/**
 * The clinic this bundle was built for, from the `VITE_CLINIC_ID` **build** arg
 * (unset → `sunshine`). Vite bakes it in at build time, so changing a clinic's
 * branding needs a rebuild, not just a restart — same rule as VITE_SENTRY_DSN.
 *
 * Consumed by `src/i18n/index.ts` (as i18next interpolation defaults, so every
 * `{{clinicName}}` in the locale files resolves) and by `vite.config.ts` for the
 * page title and PWA manifest.
 */
export const CLINIC = getClinic(import.meta.env.VITE_CLINIC_ID as string | undefined)
