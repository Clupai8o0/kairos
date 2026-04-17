CREATE TABLE IF NOT EXISTS "theme_installs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "theme_id" text NOT NULL,
  "version" text NOT NULL,
  "source" text NOT NULL,
  "manifest_json" text NOT NULL,
  "compiled_css" text NOT NULL,
  "installed_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "theme_installs_user_theme" ON "theme_installs" ("user_id", "theme_id");
