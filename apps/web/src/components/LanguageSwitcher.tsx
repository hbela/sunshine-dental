import { useTranslation } from 'react-i18next'
import { supportedLngs, type AppLanguage } from '@/i18n'

const LABELS: Record<AppLanguage, string> = {
  en: 'English',
  hu: 'Magyar',
  de: 'Deutsch',
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = (i18n.language?.split('-')[0] ?? 'en') as AppLanguage
  const value = supportedLngs.includes(current) ? current : 'en'

  return (
    <select
      aria-label={t('language')}
      value={value}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      className="h-9 rounded-xl border border-transparent bg-muted px-3 text-sm text-foreground transition-colors focus-visible:bg-primary-fixed focus-visible:outline-none"
    >
      {supportedLngs.map((lng) => (
        <option key={lng} value={lng}>
          {LABELS[lng]}
        </option>
      ))}
    </select>
  )
}
