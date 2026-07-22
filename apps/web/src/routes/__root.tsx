import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as Sentry from '@sentry/react'
import { Button } from '@/components/ui/button'

// Catches render/route errors that bubble to the root, reports them to Sentry
// (no-op without a DSN), and shows a friendly, translated fallback instead of a
// blank white screen. Global (non-render) errors are captured by Sentry.init.
function RootErrorBoundary({ error }: { error: Error }) {
  const { t } = useTranslation('common')

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{t('error')}</h1>
      <p className="text-muted-foreground max-w-md">{t('errorBody')}</p>
      <Button onClick={() => window.location.reload()}>{t('errorReload')}</Button>
    </div>
  )
}

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
  errorComponent: RootErrorBoundary,
})
