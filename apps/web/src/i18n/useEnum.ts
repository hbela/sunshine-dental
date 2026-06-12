import { useTranslation } from 'react-i18next'

/** Enum groups in `enums.json` whose values are canonical `@repo/shared` codes. */
type EnumGroup = 'appointmentType' | 'appointmentStatus' | 'calendarEventType' | 'role'

/**
 * Localized labels for canonical enum codes. **Display only** — the codes sent to
 * the API stay canonical (e.g. `CLEANING`, `CONFIRMED`). Replaces ad-hoc
 * `code.replace(/_/g, ' ')` formatting.
 *
 * `tEnum('appointmentType', 'NEW_PATIENT_EXAM')` → `"New patient exam"`.
 * Falls back to the raw code with underscores spaced if a key is missing.
 */
export function useEnum() {
  const { t } = useTranslation('enums')
  const tEnum = (group: EnumGroup, code: string) =>
    t(`${group}.${code}`, { defaultValue: code.replace(/_/g, ' ') })
  return { tEnum }
}
