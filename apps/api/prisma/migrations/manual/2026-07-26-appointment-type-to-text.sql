-- Appointment.appointmentType: enum "AppointmentType" -> TEXT
--
-- WHY THIS IS MANUAL
-- This repo has no migration runner: the api container syncs the schema at boot
-- with `prisma db push` and deliberately omits `--accept-data-loss`
-- (apps/api/Dockerfile), so a destructive change fails the boot instead of
-- silently dropping data. Changing a column's type is exactly such a change, so
-- `db push` cannot apply it -- run this by hand FIRST, then deploy the image.
--
-- WHEN
-- Run once per database, BEFORE deploying the build that drops `enum
-- AppointmentType` from schema.prisma. Afterwards `db push` sees TEXT == String
-- and is a no-op. Between the ALTER and the deploy the OLD image keeps working:
-- Prisma passes enum values through as plain strings.
--
-- ORDER
--   dev -> sunshinedev -> corona prod -> sunshine prod
-- Take a backup first (scripts/backup-db.sh). These databases hold encrypted
-- patient PII.
--
-- SAFETY
-- The USING cast is lossless: every existing value is already one of the seven
-- codes, and they are preserved verbatim as text. It is not reversible without
-- recreating the type, so the backup is the rollback.

BEGIN;

ALTER TABLE "Appointment"
  ALTER COLUMN "appointmentType" TYPE TEXT USING "appointmentType"::text;

DROP TYPE "AppointmentType";

COMMIT;

-- Verify:
--   SELECT DISTINCT "appointmentType" FROM "Appointment";
--   \d "Appointment"        -- appointmentType should read `text`
--   SELECT 1 FROM pg_type WHERE typname = 'AppointmentType';   -- 0 rows
