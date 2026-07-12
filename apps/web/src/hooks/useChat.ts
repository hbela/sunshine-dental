import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '@/lib/env'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface StoredSession {
  id: string
  token: string
  messages: ChatMessage[]
}

const LS_KEY = 'sd.chat'
const LANGS = ['en', 'hu', 'de']

function loadStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

/**
 * Patient chat client: manages the conversation session (persisted in
 * localStorage so a reload resumes the same server-side conversation) and
 * streams the assistant reply over SSE via `fetch`.
 */
export function useChat() {
  const { i18n } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStored()?.messages ?? [])
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolActivity, setToolActivity] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<{ id: string; token: string } | null>(null)
  const endedRef = useRef(false)

  useEffect(() => {
    const stored = loadStored()
    if (stored) sessionRef.current = { id: stored.id, token: stored.token }
  }, [])

  const persist = useCallback((msgs: ChatMessage[]) => {
    const s = sessionRef.current
    if (!s) return
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ ...s, messages: msgs }))
    } catch {
      /* ignore quota errors */
    }
  }, [])

  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current
    const lang = i18n.language?.split('-')[0] ?? 'en'
    const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: LANGS.includes(lang) ? lang : 'en' }),
    })
    if (!res.ok) {
      // Encryption is locked until a clinic admin unlocks the API after a
      // restart — the widget shows a friendlier "temporarily unavailable".
      const body = (await res.json().catch(() => null)) as { code?: string } | null
      throw new Error(body?.code === 'ENCRYPTION_LOCKED' ? 'chat_locked' : 'start_failed')
    }
    const data = (await res.json()) as { id: string; token: string }
    sessionRef.current = { id: data.id, token: data.token }
    return sessionRef.current
  }, [i18n.language])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return
      setError(null)

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed }
      const assistantId = crypto.randomUUID()
      let working: ChatMessage[] = []
      setMessages((m) => {
        working = [...m, userMsg, { id: assistantId, role: 'assistant', content: '' }]
        return working
      })
      setIsStreaming(true)
      setToolActivity(null)

      const appendToAssistant = (delta: string) =>
        setMessages((m) => {
          working = m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg,
          )
          return working
        })

      try {
        const session = await ensureSession()
        const res = await fetch(`${API_BASE_URL}/api/chat/conversations/${session.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: session.token, message: trimmed }),
        })
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { code?: string } | null
          throw new Error(body?.code === 'ENCRYPTION_LOCKED' ? 'chat_locked' : 'send_failed')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            let event = 'message'
            let dataStr = ''
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim()
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
            }
            if (!dataStr) continue
            let data: { text?: string; name?: string; message?: string } = {}
            try {
              data = JSON.parse(dataStr)
            } catch {
              continue
            }
            if (event === 'delta') {
              appendToAssistant(data.text ?? '')
              setToolActivity(null)
            } else if (event === 'tool') {
              setToolActivity(data.name ?? null)
            } else if (event === 'error') {
              setError(data.message ?? 'chat_error')
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error && err.message === 'chat_locked' ? 'chat_locked' : 'chat_error')
      } finally {
        setIsStreaming(false)
        setToolActivity(null)
        persist(working)
      }
    },
    [ensureSession, isStreaming, persist],
  )

  /**
   * Best-effort end (fires the summary/sentiment analysis for the staff Chat
   * Logs view). Idempotent per session and survives page unload via
   * `sendBeacon` (falls back to a keepalive fetch). The server also no-ops if
   * the conversation is already ENDED.
   */
  const end = useCallback(() => {
    const s = sessionRef.current
    if (!s || endedRef.current) return
    endedRef.current = true
    const url = `${API_BASE_URL}/api/chat/conversations/${s.id}/end`
    const body = JSON.stringify({ token: s.token })
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      } else {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        })
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Auto-end when the patient leaves the page (closes/navigates away), so a
  // summary is generated without them having to press "Start over". We use
  // pagehide/beforeunload rather than visibilitychange so merely backgrounding
  // the PWA (e.g. to check a date) does not prematurely end an active chat.
  useEffect(() => {
    const handler = () => end()
    window.addEventListener('pagehide', handler)
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('pagehide', handler)
      window.removeEventListener('beforeunload', handler)
    }
  }, [end])

  const reset = useCallback(() => {
    end()
    sessionRef.current = null
    endedRef.current = false
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      /* ignore */
    }
    setMessages([])
    setError(null)
    setToolActivity(null)
  }, [end])

  return { messages, isStreaming, toolActivity, error, send, end, reset }
}
