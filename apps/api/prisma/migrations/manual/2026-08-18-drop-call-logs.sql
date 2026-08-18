-- Retire the voice channel: DROP TABLE "CallLog", DROP "Appointment"."callId"
--
-- WHY THIS IS MANUAL
-- This repo has no migration runner: the api container syncs the schema at boot
-- with `prisma db push` and deliberately omits `--accept-data-loss`
-- (apps/api/Dockerfile), so a destructive change fails the boot instead of
-- silently dropping data. Dropping a table and a column is exactly such a
-- change, so `db push` cannot apply it -- run this by hand FIRST, then deploy
-- the image.
--
-- WHEN
-- Run once per database, BEFORE deploying the build that removes `model
-- CallLog` and `Appointment.callId` from schema.prisma. Afterwards `db push`
-- sees a schema that already matches and is a no-op.
--
-- The OLD image does NOT keep working between the DROP and the deploy: it still
-- registers /api/call-logs and reads "CallLog". Keep the gap short, or deploy
-- first and accept that /api/call-logs 500s until this runs -- either order is
-- fine, the dashboard no longer links to it.
--
-- ORDER
--   dev -> sunshinedev -> corona prod -> sunshine prod
-- Take a backup first (scripts/backup-db.sh). These databases hold encrypted
-- patient PII, and "CallLog"."transcript"/"summary"/"fromNumber"/"toNumber"
-- are among the encrypted columns.
--
-- SAFETY
-- This is NOT reversible: the call transcripts and summaries are deleted
-- outright. The backup is the rollback. No phone number was ever provisioned on
-- the Retell account, so every row here came from a web test call rather than a
-- real patient line -- confirm that is still true for the database you are
-- about to run this against before you type COMMIT.
--
-- "Appointment"."callId" only ever referenced a Retell call_id. It carries no
-- foreign key and nothing else reads it, so dropping it loses no linkage that
-- survives "CallLog" anyway.

BEGIN;

ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "callId";

-- Drops the CallLog_patientId_fkey constraint and CallLog_callId_key index with it.
DROP TABLE IF EXISTS "CallLog";

COMMIT;

-- Verify:
--   \d "Appointment"                                          -- no callId column
--   SELECT to_regclass('"CallLog"');                          -- NULL
