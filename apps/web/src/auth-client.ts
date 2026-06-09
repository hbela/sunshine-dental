import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'
import { API_BASE_URL } from './lib/env'

export const authClient = createAuthClient({
  // Empty API_BASE_URL means "same origin" (Vite proxy) — better-auth needs an
  // absolute base, so fall back to the current page origin.
  baseURL: API_BASE_URL || window.location.origin,
  plugins: [adminClient()]
})
