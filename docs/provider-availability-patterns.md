# Provider Availability Patterns and Internal Calendar Sync

## Implementation plan

### Summary

Implement provider-level weekly availability patterns with multiple daily time ranges, effective start dates, optional end dates, and date-specific replacements.

Patterns are the authoritative source. Saving a pattern synchronously reconciles pattern-owned `CalendarEvent` records in the same database transaction. Calendar changes never update the source pattern. Appointments continue to appear from the existing `Appointment` stream without duplication.

### Data and synchronization

- Add `AvailabilityPattern` with provider, effective date range, and weekly weekday/time windows.
- Add `AvailabilityException` containing zero or more windows that replace the pattern for one date.
- Permit multiple dated patterns per provider, but never overlapping.
  - Creating a future pattern may automatically close an earlier open-ended pattern on the preceding day.
  - Reject every other overlap.
- Link generated `CalendarEvent` records to their source pattern or exception and identify them as pattern-managed.
- Represent weekly windows as recurring `AVAILABLE` events.
- Add recurrence exclusions so a date override suppresses the normal weekly occurrences, then create concrete `AVAILABLE` events for its replacement windows.
- Reconcile generated events transactionally and idempotently whenever a pattern or exception is created, updated, or deleted.
- Keep existing and newly created manual availability events additive and untouched.
- Continue subtracting manual `BLOCKED` and `VACATION` events and active appointments from all availability.
- Fix provider discovery so recurring availability is considered on dates after the recurring event's stored base date.

### API and UI

- Add shared validation schemas and authenticated CRUD endpoints for provider patterns and date exceptions.
- Reuse existing provider and delegation authorization for writes.
- Accept clinic-local `YYYY-MM-DD` dates, ISO weekdays `1–7`, and non-overlapping `HH:mm` ranges. Reject overnight ranges.
- Extend calendar items with pattern-ownership metadata so generated availability is read-only in the calendar event editor.
- Add **Manage availability** to the calendar with:
  - the currently selected provider;
  - a dated pattern list;
  - a seven-day editor with multiple ranges per day;
  - copying one day's hours to selected weekdays;
  - effective start and optional end dates;
  - date exceptions that replace the pattern day with custom ranges or a closed day.
- Direct users who open generated availability to pattern management rather than permitting direct edits.
- Keep manual event creation for additional availability, blocks, and vacations.
- Add English, Hungarian, and German translations.

### Tests and acceptance criteria

- Pattern creation produces the correct recurring `CalendarEvent` rows without duplicates.
- Pattern edits and deletion reconcile only owned events and preserve manual events.
- Midweek starts, finite and ongoing patterns, automatic closing of an open-ended predecessor, and overlap rejection behave correctly.
- A date exception excludes every normal occurrence for that date and exposes exactly its replacement windows, including a fully closed day.
- Manual blocks, vacations, appointments, and additive availability continue to affect generated slots correctly.
- Chat availability and provider discovery work for recurring patterns beyond the original event date.
- Unauthorized or view-only delegates cannot modify patterns.
- Calendar-generated events are read-only, while manual events remain editable.
- Existing bookings remain visible after pattern changes or deletion.
- Run API and web tests, type checks, lint, schema validation, and production builds.

### Assumptions

- Patterns apply to every service offered by the provider; service duration determines which starts fit.
- Synchronization is internal, synchronous, and one-way from patterns to the internal calendar. There is no Google, Outlook, or other external integration.
- Existing availability receives no backfill or conversion.
- Date exceptions replace only pattern-generated availability; independent manual availability remains additive.
- The database rollout is additive, with nullable source fields and no destructive migration.

## Execution summary

Implemented the complete provider availability-pattern workflow.

### Delivered

- Added `AvailabilityPattern`, `AvailabilityException`, and `CalendarEventExclusion` persistence models.
- Added nullable pattern and exception ownership links to `CalendarEvent`.
- Implemented a transactional reconciliation service that projects weekly patterns and date replacements into calendar events.
- Added serializable transactions and conflict responses to prevent concurrent creation of overlapping patterns.
- Implemented automatic closing of a preceding ongoing pattern when a future pattern is created. Exceptions in the superseded portion are removed with the old schedule segment.
- Added validated list, create, update, delete, exception upsert, and exception delete endpoints.
- Reused `DelegationService.canManageProviderCalendar` for pattern and exception writes.
- Prevented direct API updates or deletion of pattern-managed calendar events.
- Added recurrence-exclusion handling to calendar expansion.
- Corrected available-provider discovery so providers with older recurring base events remain discoverable.
- Added the availability-pattern manager to the staff calendar, including multiple daily ranges, weekday copying, dated patterns, closed-day exceptions, and custom replacement hours.
- Routed clicks on generated availability to pattern management while leaving manual events editable.
- Added English, Hungarian, and German UI copy.
- Added unit coverage for recurring projection, midweek starts, finite recurrence, replacement windows, and closed-day exceptions.
- Added API Vitest configuration so compiled `dist` tests are not executed as duplicate suites.

### Verification

- Workspace tests: **64 passed** (`56` API and `8` web).
- API and web TypeScript checks: **passed**.
- API and web production builds: **passed**.
- Prisma schema validation: **passed**.
- Availability and calendar files targeted by this change: **lint clean**.
- `git diff --check`: **passed**.

The full workspace lint command still reports four unrelated pre-existing errors in `ThemeToggle.tsx`, `components/ui/badge.tsx`, and `routes/_auth/settings.tsx`, plus existing React Compiler warnings. These were outside this implementation and were not changed.

### Deployment note

The schema changes are additive. The repository's existing API startup process applies them through `prisma db push`; no availability backfill or destructive data migration is required.

For databases that still contain retired voice-era `CallLog` rows or populated
`Appointment.callId` values, `prisma db push` will refuse to run without a
destructive flag. Do not accept that data loss merely to install this feature.
Apply `apps/api/prisma/migrations/manual/2026-08-19-availability-patterns.sql`
instead; it installs only the additive availability schema and preserves the
legacy records.
