import axios from 'axios'
import { API_BASE_URL } from './env'

/**
 * Axios instance for the Dental Clinic API.
 * `withCredentials` sends the better-auth session cookie on every request.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

/** Extract a human-readable message from an API/axios error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined
    return data?.error || data?.message || err.message || fallback
  }
  if (err instanceof Error) return err.message
  return fallback
}
