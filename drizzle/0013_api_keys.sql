CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "key_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "scopes" text[] NOT NULL DEFAULT '{}',
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "api_keys_key_hash_unique" UNIQUE ("key_hash")
);
