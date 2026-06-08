import axios from 'axios'

/**
 * Axios instance for the Dental Clinic API.
 * `withCredentials` sends the better-auth session cookie on every request.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
})
