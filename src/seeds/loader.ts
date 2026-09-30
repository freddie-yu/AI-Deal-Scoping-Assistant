import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SeedIdSchema, SeedManifestSchema } from './schema.js';
import { ValidationError } from '../application/errors.js';
export async function loadSeed(id: string) {
  if (!SeedIdSchema.safeParse(id).success) throw new ValidationError('Unsupported seed ID.', ['seedId']);
  const raw: unknown = JSON.parse(await readFile(resolve('seeds', id, 'manifest.json'), 'utf8'));
  return SeedManifestSchema.parse(raw);
}
