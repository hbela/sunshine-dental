import { useTranslation } from 'react-i18next'
import { format as dfFormat } from 'date-fns'
import type { Locale } from 'date-fns'
import { enUS, hu, de } from 'date-fns/locale'

const LOCALES: Record<string, Locale> = { en: enUS, hu, de }

/**
 * Locale-aware date / number formatting bound to the active language.
 * Use instead of calling date-fns `format` directly so dates follow the UI language.
 */
export function useFormat() {
  const { i18n } = useTranslation()
  const lng = i18n.language?.split('-')[0] ?? 'en'
  const locale = LOCALES[lng] ?? enUS

  return {
    locale,
    formatDate: (d: Date | number, fmt = 'PP') => dfFormat(d, fmt, { locale }),
    formatTime: (d: Date | number, fmt = 'HH:mm') => dfFormat(d, fmt, { locale }),
    formatDateTime: (d: Date | number, fmt = 'PPp') => dfFormat(d, fmt, { locale }),
    formatNumber: (n: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(lng, opts).format(n),
  }
}
