ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'UTC';
