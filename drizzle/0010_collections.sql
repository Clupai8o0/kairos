-- 0010_collections.sql
-- Collections: coordination/grouping structures for tasks.
-- ADR-R20: Collection replaces the banned Project concept.
-- Note: tasks.status extension (backlog, blocked) requires no SQL — text column, TypeScript-only.

CREATE TABLE "collections" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "deadline" timestamp,
  "status" text NOT NULL DEFAULT 'active',
  "color" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "collection_phases" (
  "id" text PRIMARY KEY NOT NULL,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "collection_tasks" (
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "task_id" text NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "phase_id" text REFERENCES "collection_phases"("id") ON DELETE SET NULL,
  "order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "collection_tasks_pkey" PRIMARY KEY("collection_id","task_id")
);

CREATE INDEX "collections_user_idx" ON "collections"("user_id");
CREATE INDEX "collection_phases_collection_idx" ON "collection_phases"("collection_id");
CREATE INDEX "collection_tasks_task_idx" ON "collection_tasks"("task_id");
