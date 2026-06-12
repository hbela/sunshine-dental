import 'react-i18next'
import type { resources, defaultNS } from '@/i18n'

// Strongly-typed keys: `t('logout')`, `t('nav:dashboard')`, etc. — based on the `en` resources.
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}
