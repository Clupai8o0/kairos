CREATE TABLE IF NOT EXISTS "beta_gate_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "ip" text NOT NULL,
  "attempted_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "beta_gate_attempts_ip_at_idx"
  ON "beta_gate_attempts" ("ip", "attempted_at");
