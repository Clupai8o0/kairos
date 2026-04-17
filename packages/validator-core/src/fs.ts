import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { lstatSync } from 'node:fs';

export async function readInput(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const res = await fetch(pathOrUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${pathOrUrl}`);
    return res.text();
  }
  return readFile(pathOrUrl, 'utf-8');
}

export async function resolveGlob(pathOrGlob: string): Promise<string[]> {
  try {
    const stat = lstatSync(pathOrGlob);
    if (stat.isDirectory()) {
      return glob(`${pathOrGlob}/**/*.json`);
    }
  } catch {
    // not a plain path — treat as glob
  }
  return glob(pathOrGlob);
}