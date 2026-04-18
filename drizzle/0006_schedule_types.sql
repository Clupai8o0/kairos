DROP TABLE IF EXISTS "blackout_days";

CREATE TABLE "blackout_blocks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "recurrence_rule" jsonb,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "window_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "schedule_windows" ADD COLUMN "template_id" text REFERENCES "window_templates"("id") ON DELETE CASCADE;
ALTER TABLE "tasks" ADD COLUMN "preferred_template_id" text REFERENCES "window_templates"("id") ON DELETE SET NULL;
