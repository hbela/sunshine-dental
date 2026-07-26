import { useTranslation } from 'react-i18next'
import { serviceLabel } from '@repo/shared'
import { CLINIC } from '@/lib/clinic'
import { useEnum } from './useEnum'

/**
 * Localized name for a bookable service code.
 *
 * The clinic's own `services` config is the source of truth — those are the
 * words patients see in confirmation e-mails and hear from the agent, so the
 * dashboard should agree with them. Falls back to the `enums.json`
 * `appointmentType` group for codes a clinic hasn't labelled (and, through
 * `tEnum`, to the spaced code), so an unknown value never renders blank.
 *
 * Display only — the codes sent to the API stay canonical (`CLEANING`).
 */
export function useServiceLabel() {
  const { i18n } = useTranslation()
  const { tEnum } = useEnum()

  const tService = (code: string) => {
    const configured = CLINIC.services.find((s) => s.code === code)
    if (configured) return serviceLabel(CLINIC, code, i18n.language)
    return tEnum('appointmentType', code)
  }

  return { tService }
}
