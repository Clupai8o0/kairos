ALTER TABLE "google_calendars" ADD COLUMN IF NOT EXISTS "is_write_calendar" boolean NOT NULL DEFAULT false;

-- Default the primary calendar as the write calendar for existing users
UPDATE "google_calendars" SET "is_write_calendar" = true WHERE "is_primary" = true;
