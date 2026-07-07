import { useEffect, useState } from 'react'

/**
 * PWA install affordance state. On Android/Chromium we capture the
 * `beforeinstallprompt` event and expose a `promptInstall()` trigger; iOS Safari
 * has no such event, so callers fall back to a "Share → Add to Home Screen" hint.
 * Everything is suppressed once the app is already running standalone.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOSDevice = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ reports as Mac but is touch-capable.
  const isIPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
  return (isIOSDevice || isIPadOS) && isSafari
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(detectStandalone)
  const isIOS = detectIOS()

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // stop Chrome's mini-infobar; we drive the prompt ourselves
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setIsStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return {
    /** Chromium install prompt is available. */
    canInstall: !!deferred,
    /** iOS Safari — no prompt API, show the Share-sheet hint instead. */
    isIOS,
    /** Already installed / launched from the home screen. */
    isStandalone,
    promptInstall,
  }
}
