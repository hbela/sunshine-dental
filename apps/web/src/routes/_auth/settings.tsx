import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

function SettingsPage() {
  const { t } = useTranslation('settings')
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">{t('title')}</h1>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-medium text-foreground">{t('language')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('languageDescription')}</p>
        <div className="mt-3">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t('comingSoon')}</div>
    </section>
  )
}

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage,
})
