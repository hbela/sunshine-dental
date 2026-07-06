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
    if (!res.ok) throw new Error('start_failed')
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
        if (!res.ok || !res.body) throw new Error('send_failed')

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
      } catch {
        setError('chat_error')
      } finally {
        setIsStreaming(false)
        setToolActivity(null)
        persist(working)
      }
    },
    [ensureSession, isStreaming, persist],
  )

  /** Best-effort end (fires the summary/sentiment analysis); survives unload. */
  const end = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    try {
      void fetch(`${API_BASE_URL}/api/chat/conversations/${s.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: s.token }),
        keepalive: true,
      })
    } catch {
      /* ignore */
    }
  }, [])

  const reset = useCallback(() => {
    end()
    sessionRef.current = null
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
