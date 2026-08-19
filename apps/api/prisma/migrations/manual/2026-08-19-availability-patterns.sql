-- Add provider availability patterns without touching legacy voice-era data.
-- This database may still contain Appointment.callId and CallLog rows, so do
-- not replace this migration with `prisma db push --accept-data-loss`.

CREATE TABLE IF NOT EXISTS "AvailabilityPattern" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveUntil" DATE,
  "windows" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AvailabilityException" (
  "id" TEXT NOT NULL,
  "patternId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "windows" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "availabilityPatternId" TEXT,
  ADD COLUMN IF NOT EXISTS "availabilityExceptionId" TEXT;

CREATE TABLE IF NOT EXISTS "CalendarEventExclusion" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  CONSTRAINT "CalendarEventExclusion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AvailabilityPattern_providerId_effectiveFrom_idx"
  ON "AvailabilityPattern" ("providerId", "effectiveFrom");

CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityException_patternId_date_key"
  ON "AvailabilityException" ("patternId", "date");

CREATE INDEX IF NOT EXISTS "AvailabilityException_date_idx"
  ON "AvailabilityException" ("date");

CREATE INDEX IF NOT EXISTS "CalendarEvent_availabilityPatternId_idx"
  ON "CalendarEvent" ("availabilityPatternId");

CREATE INDEX IF NOT EXISTS "CalendarEvent_availabilityExceptionId_idx"
  ON "CalendarEvent" ("availabilityExceptionId");

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventExclusion_eventId_date_key"
  ON "CalendarEventExclusion" ("eventId", "date");

CREATE INDEX IF NOT EXISTS "CalendarEventExclusion_date_idx"
  ON "CalendarEventExclusion" ("date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityPattern_providerId_fkey') THEN
    ALTER TABLE "AvailabilityPattern"
      ADD CONSTRAINT "AvailabilityPattern_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityException_patternId_fkey') THEN
    ALTER TABLE "AvailabilityException"
      ADD CONSTRAINT "AvailabilityException_patternId_fkey"
      FOREIGN KEY ("patternId") REFERENCES "AvailabilityPattern"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_availabilityPatternId_fkey') THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_availabilityPatternId_fkey"
      FOREIGN KEY ("availabilityPatternId") REFERENCES "AvailabilityPattern"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_availabilityExceptionId_fkey') THEN
    ALTER TABLE "CalendarEvent"
      ADD CONSTRAINT "CalendarEvent_availabilityExceptionId_fkey"
      FOREIGN KEY ("availabilityExceptionId") REFERENCES "AvailabilityException"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventExclusion_eventId_fkey') THEN
    ALTER TABLE "CalendarEventExclusion"
      ADD CONSTRAINT "CalendarEventExclusion_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
