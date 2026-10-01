import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: join(here, '../.env'), quiet: true });
}
