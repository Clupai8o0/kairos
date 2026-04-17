// Re-export PluginManifest for use in lib/ without depending on the SDK package
import { z } from 'zod';

export const PluginManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1).max(64),
  description: z.string().min(10).max(500),
  author: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  distribution: z.enum(['http', 'bundled']),
  endpoint: z.string().url().optional(),
  npmPackage: z.string().optional(),
  handlesInputTypes: z.array(z.enum(['text', 'url', 'share', 'voice', 'file'])).min(1),
  capabilities: z.array(z.enum(['llm', 'http-fetch', 'file-read'])).default([]),
  configSchema: z.record(z.unknown()).optional(),
  defaultConfig: z.record(z.unknown()).optional(),
  theme: z.record(z.unknown()).optional(),
  provenance: z.string().url().optional(),
  icon: z.string().url().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  changelog: z.string().optional(),
}).refine(
  (m) => m.distribution !== 'http' || !!m.endpoint,
  { message: 'HTTP plugins must provide an endpoint URL' },
).refine(
  (m) => m.distribution !== 'bundled' || !!m.npmPackage,
  { message: 'Bundled plugins must provide an npmPackage name' },
);

export type PluginManifest = z.infer<typeof PluginManifestSchema>;