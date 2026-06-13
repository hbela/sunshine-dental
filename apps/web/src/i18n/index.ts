import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import enAuth from '@/locales/en/auth.json'
import enDashboard from '@/locales/en/dashboard.json'
import enCalendar from '@/locales/en/calendar.json'
import enAppointments from '@/locales/en/appointments.json'
import enPatients from '@/locales/en/patients.json'
import enCallLogs from '@/locales/en/callLogs.json'
import enSettings from '@/locales/en/settings.json'
import enAdmin from '@/locales/en/admin.json'
import enDelegations from '@/locales/en/delegations.json'
import enEnums from '@/locales/en/enums.json'

import huCommon from '@/locales/hu/common.json'
import huNav from '@/locales/hu/nav.json'
import huAuth from '@/locales/hu/auth.json'
import huDashboard from '@/locales/hu/dashboard.json'
import huCalendar from '@/locales/hu/calendar.json'
import huAppointments from '@/locales/hu/appointments.json'
import huPatients from '@/locales/hu/patients.json'
import huCallLogs from '@/locales/hu/callLogs.json'
import huSettings from '@/locales/hu/settings.json'
import huAdmin from '@/locales/hu/admin.json'
import huDelegations from '@/locales/hu/delegations.json'
import huEnums from '@/locales/hu/enums.json'

import deCommon from '@/locales/de/common.json'
import deNav from '@/locales/de/nav.json'
import deAuth from '@/locales/de/auth.json'
import deDashboard from '@/locales/de/dashboard.json'
import deCalendar from '@/locales/de/calendar.json'
import deAppointments from '@/locales/de/appointments.json'
import dePatients from '@/locales/de/patients.json'
import deCallLogs from '@/locales/de/callLogs.json'
import deSettings from '@/locales/de/settings.json'
import deAdmin from '@/locales/de/admin.json'
import deDelegations from '@/locales/de/delegations.json'
import deEnums from '@/locales/de/enums.json'

export const supportedLngs = ['en', 'hu', 'de'] as const
export type AppLanguage = (typeof supportedLngs)[number]

export const defaultNS = 'common'

export const namespaces = [
  'common',
  'nav',
  'auth',
  'dashboard',
  'calendar',
  'appointments',
  'patients',
  'callLogs',
  'settings',
  'admin',
  'delegations',
  'enums',
] as const

/** `en` is the source-of-truth key set; `hu`/`de` mirror it. */
export const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    auth: enAuth,
    dashboard: enDashboard,
    calendar: enCalendar,
    appointments: enAppointments,
    patients: enPatients,
    callLogs: enCallLogs,
    settings: enSettings,
    admin: enAdmin,
    delegations: enDelegations,
    enums: enEnums,
  },
  hu: {
    common: huCommon,
    nav: huNav,
    auth: huAuth,
    dashboard: huDashboard,
    calendar: huCalendar,
    appointments: huAppointments,
    patients: huPatients,
    callLogs: huCallLogs,
    settings: huSettings,
    admin: huAdmin,
    delegations: huDelegations,
    enums: huEnums,
  },
  de: {
    common: deCommon,
    nav: deNav,
    auth: deAuth,
    dashboard: deDashboard,
    calendar: deCalendar,
    appointments: deAppointments,
    patients: dePatients,
    callLogs: deCallLogs,
    settings: deSettings,
    admin: deAdmin,
    delegations: deDelegations,
    enums: deEnums,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...supportedLngs],
    fallbackLng: 'en',
    defaultNS,
    ns: [...namespaces],
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
