import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import huCommon from '@/locales/hu/common.json'
import huNav from '@/locales/hu/nav.json'
import deCommon from '@/locales/de/common.json'
import deNav from '@/locales/de/nav.json'

export const supportedLngs = ['en', 'hu', 'de'] as const
export type AppLanguage = (typeof supportedLngs)[number]

export const defaultNS = 'common'

/** `en` is the source-of-truth key set; `hu`/`de` mirror it. */
export const resources = {
  en: { common: enCommon, nav: enNav },
  hu: { common: huCommon, nav: huNav },
  de: { common: deCommon, nav: deNav },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...supportedLngs],
    fallbackLng: 'en',
    defaultNS,
    ns: ['common', 'nav'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'sd.lang',
      caches: ['localStorage'],
    },
  })

const applyHtmlLang = (lng: string) => {
  document.documentElement.lang = lng.split('-')[0] ?? 'en'
}
applyHtmlLang(i18n.language ?? 'en')
i18n.on('languageChanged', applyHtmlLang)

export default i18n
