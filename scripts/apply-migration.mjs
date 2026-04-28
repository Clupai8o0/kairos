// One-shot script: applies a single SQL migration file via Neon HTTP driver.
// Usage: node scripts/apply-migration.mjs drizzle/0013_api_keys.sql
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readFileSync as readFile } from 'fs';

// Parse .env.local without dotenv
try {
  const env = readFile('.env.local', 'utf-8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/apply-migration.mjs <sql-file>'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = neon(process.env.DATABASE_URL);
const query = readFileSync(resolve(file), 'utf-8').trim();

console.log(`Applying ${file}…`);
await sql.query(query);
console.log('Done.');
