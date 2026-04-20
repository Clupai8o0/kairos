CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "default_buffer_mins" integer NOT NULL DEFAULT 15,
  "default_duration_mins" integer,
  "default_priority" integer NOT NULL DEFAULT 3,
  "default_schedulable" boolean NOT NULL DEFAULT true
);
