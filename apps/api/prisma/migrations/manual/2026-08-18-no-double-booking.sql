-- Close the double-booking race: one ACTIVE appointment per (provider, date, startTime)
--
-- WHY THIS IS MANUAL
-- Partial indexes (a WHERE clause) cannot be expressed in schema.prisma, and
-- this repo has no migration runner -- the api container syncs the schema at
-- boot with `prisma db push` (apps/api/Dockerfile). A full @@unique would be
-- wrong here: it would also block re-booking a slot whose earlier appointment
-- was CANCELLED or NO_SHOW. The predicate limits uniqueness to ACTIVE rows
-- (CONFIRMED, COMPLETED), so cancelled slots free up again.
-- Manually created indexes are not in schema.prisma; `db push` leaves them
-- alone. If a future `db push` ever drops it, re-run this file.
--
-- WHEN
-- Run once per database, any time. The application code works with or without
-- the index (the index is the hard guarantee; the code maps violations to a
-- friendly 409), so deploy order does not matter.
--
-- ORDER
--   dev -> sunshinedev -> corona prod -> sunshine prod
--
-- SAFETY
-- Additive only (CREATE INDEX), fully reversible with:
--   DROP INDEX IF EXISTS appointment_no_double_booking;
-- It FAILS if duplicate active rows already exist -- run the pre-check first
-- and cancel/merge any duplicates it finds before re-running.

BEGIN;

-- Pre-check: must return 0 rows, or CREATE INDEX will abort the transaction.
SELECT "providerId", "date", "startTime", COUNT(*)
FROM "Appointment"
WHERE "status" IN ('CONFIRMED', 'COMPLETED')
GROUP BY "providerId", "date", "startTime"
HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS appointment_no_double_booking
  ON "Appointment" ("providerId", "date", "startTime")
  WHERE "status" IN ('CONFIRMED', 'COMPLETED');

COMMIT;

-- Verify:
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Appointment';
