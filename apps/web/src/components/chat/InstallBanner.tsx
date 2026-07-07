import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'sd.pwa.dismissed'

/**
 * Dismissible "install this app" banner shown above the chat. Android/Chromium
 * gets a one-tap install button; iOS Safari gets the Share → Add to Home Screen
 * hint. Renders nothing when already installed, unsupported, or dismissed.
 */
export function InstallBanner() {
  const { t } = useTranslation('chat')
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  if (isStandalone || dismissed) return null
  if (!canInstall && !isIOS) return null

  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-accent/50 px-4 py-2 text-xs text-accent-foreground">
      <span className="flex-1">{isIOS ? t('installHintIos') : t('installPrompt')}</span>
      {canInstall && (
        <Button variant="secondary" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={promptInstall}>
          <Download className="size-3.5" />
          {t('install')}
        </Button>
      )}
      {isIOS && <Share className="size-3.5 shrink-0 opacity-70" aria-hidden />}
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        onClick={dismiss}
        title={t('dismiss')}
        aria-label={t('dismiss')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
