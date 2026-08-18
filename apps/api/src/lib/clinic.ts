import { getClinic, type ClinicConfig } from '@repo/shared';

/**
 * The clinic this API instance serves, resolved once at import time from
 * `CLINIC_ID` (unset → `sunshine`, the original single-tenant behaviour).
 *
 * Each clinic gets its own stack — own database, own domain, own chat agent
 * (see `docs/onboarding-new-clinic.md`) — so this is a process-wide constant,
 * not a per-request lookup. An unknown id throws here and the server refuses to
 * boot, which is deliberate: serving another clinic's address, hours and phone
 * number to patients is worse than being down.
 */
export const clinic: ClinicConfig = getClinic(process.env.CLINIC_ID);

/** Today's date (YYYY-MM-DD) in the clinic's timezone — what the prompts anchor on. */
export function clinicToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: clinic.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
