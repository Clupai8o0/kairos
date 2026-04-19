CREATE TABLE "blackout_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"recurrence_rule" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "window_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_installs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"theme_id" text NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"manifest_json" text NOT NULL,
	"compiled_css" text NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_ai_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blackout_days" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "blackout_days" CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "time_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "preferred_template_id" text;--> statement-breakpoint
ALTER TABLE "schedule_windows" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "plugin_installs" ADD COLUMN "manifest_json" jsonb;--> statement-breakpoint
ALTER TABLE "plugin_installs" ADD COLUMN "previous_version" text;--> statement-breakpoint
ALTER TABLE "plugin_installs" ADD COLUMN "previous_manifest_json" jsonb;--> statement-breakpoint
ALTER TABLE "plugin_installs" ADD COLUMN "endpoint" text;--> statement-breakpoint
ALTER TABLE "plugin_installs" ADD COLUMN "endpoint_secret" text;--> statement-breakpoint
ALTER TABLE "plugin_installs" ADD COLUMN "last_healthy_at" timestamp;--> statement-breakpoint
ALTER TABLE "blackout_blocks" ADD CONSTRAINT "blackout_blocks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "window_templates" ADD CONSTRAINT "window_templates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_installs" ADD CONSTRAINT "theme_installs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_keys" ADD CONSTRAINT "user_ai_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "theme_installs_user_theme" ON "theme_installs" USING btree ("user_id","theme_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_preferred_template_id_window_templates_id_fk" FOREIGN KEY ("preferred_template_id") REFERENCES "public"."window_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_windows" ADD CONSTRAINT "schedule_windows_template_id_window_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."window_templates"("id") ON DELETE cascade ON UPDATE no action;