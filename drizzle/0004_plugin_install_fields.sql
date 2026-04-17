ALTER TABLE "plugin_installs" ADD COLUMN "manifest_json" jsonb;
ALTER TABLE "plugin_installs" ADD COLUMN "previous_version" text;
ALTER TABLE "plugin_installs" ADD COLUMN "previous_manifest_json" jsonb;
ALTER TABLE "plugin_installs" ADD COLUMN "endpoint" text;
ALTER TABLE "plugin_installs" ADD COLUMN "endpoint_secret" text;
ALTER TABLE "plugin_installs" ADD COLUMN "last_healthy_at" timestamp;