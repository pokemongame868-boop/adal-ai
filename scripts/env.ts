import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Loads ../.env (server-side only) if present, without printing anything. */
export function loadEnv(): void {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const file = join(root, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
