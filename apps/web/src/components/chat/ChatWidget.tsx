import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { ChatPanel } from './ChatPanel'
import { cn } from '@/lib/utils'

/**
 * Floating "chat with us" bubble that opens the shared ChatPanel. Drop-in and
 * self-contained so it can be mounted on any public page (and, later, embedded
 * on the clinic's marketing site).
 */
export function ChatWidget() {
  const { t } = useTranslation('chat')
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && (
        <div
          className={cn(
            'fixed z-50 overflow-hidden border border-border/60 bg-background shadow-2xl',
            // Full-screen on phones, floating card on larger screens.
            'inset-0 rounded-none sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:max-h-[80vh] sm:w-[400px] sm:rounded-2xl',
          )}
          role="dialog"
          aria-label={t('title')}
        >
          <ChatPanel onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('launcher')}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full',
          'bg-gradient-to-br from-primary to-primary-container text-primary-foreground shadow-lg',
          'transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          open && 'hidden sm:flex',
        )}
      >
        <MessageCircle className="size-6" strokeWidth={1.75} />
      </button>
    </>
  )
}
