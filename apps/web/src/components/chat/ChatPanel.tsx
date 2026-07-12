import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Leaf, Send, RotateCcw, X } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { InstallBanner } from '@/components/chat/InstallBanner'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * Shared chat UI used both by the full-page patient route (`/chat`) and the
 * floating widget. Handles rendering, auto-scroll, and the composer; all
 * networking lives in `useChat`.
 */
export function ChatPanel({ onClose, className }: { onClose?: () => void; className?: string }) {
  const { t } = useTranslation('chat')
  const { messages, isStreaming, toolActivity, error, send, reset } = useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, toolActivity])

  const submit = () => {
    const text = input
    setInput('')
    void send(text)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className={cn('flex h-full flex-col overflow-hidden bg-background', className)}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 bg-card px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-container text-primary-foreground">
          <Leaf className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-foreground">{t('title')}</p>
          <p className="truncate text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <LanguageSwitcher />
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={reset} title={t('reset')} aria-label={t('reset')}>
            <RotateCcw className="size-4" />
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} title={t('close')} aria-label={t('close')}>
            <X className="size-4" />
          </Button>
        )}
      </header>

      {/* Install prompt (hidden once installed / unsupported) */}
      <InstallBanner />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4">
        {messages.length === 0 && (
          <Bubble role="assistant">
            <p>{t('greeting')}</p>
          </Bubble>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role}>
            {m.content ? (
              <p className="whitespace-pre-wrap">{m.content}</p>
            ) : (
              <TypingDots />
            )}
          </Bubble>
        ))}
        {toolActivity && (
          <p className="pl-1 text-xs italic text-muted-foreground">
            {t(`tools.${toolActivity}`, { defaultValue: t('tools.working') })}
          </p>
        )}
        {error && (
          <p className="pl-1 text-xs text-destructive">
            {t(error === 'chat_locked' ? 'unavailable' : 'error')}
          </p>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card px-3 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={t('placeholder')}
            className="max-h-32 min-h-[44px] resize-none"
            aria-label={t('placeholder')}
          />
          <Button
            variant="gradient"
            size="icon"
            onClick={submit}
            disabled={!input.trim() || isStreaming}
            aria-label={t('send')}
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">{t('disclaimer')}</p>
      </div>
    </div>
  )
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-hidden>
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
    </span>
  )
}
