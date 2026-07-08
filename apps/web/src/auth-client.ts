import { createAuthClient } from 'better-auth/react'
import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { API_BASE_URL } from './lib/env'

export const authClient = createAuthClient({
  // Empty API_BASE_URL means "same origin" (Vite proxy) — better-auth needs an
  // absolute base, so fall back to the current page origin.
  baseURL: API_BASE_URL || window.location.origin,
  plugins: [
    adminClient(),
    // Structured name fields registered server-side (see apps/api/src/lib/auth.ts).
    inferAdditionalFields({
      user: {
        title: { type: 'string', required: false },
        givenName: { type: 'string', required: false },
        familyName: { type: 'string', required: false },
      },
    }),
  ],
})
