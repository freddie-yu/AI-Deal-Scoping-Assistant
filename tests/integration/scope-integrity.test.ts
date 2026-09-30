import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { newSession } from '../../src/application/sessions.js';
import { ScopeCommands } from '../../src/application/scope.js';
import { loadSeed } from '../../src/seeds/loader.js';
import { sourceHash } from '../../src/ingestion/sources.js';
it('rejects mutated immutable evidence, corrupt anchors and recycled counters at persistence boundary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scope-integrity-'));
  try {
    const repo = new JsonSessionRepository(directory); const commands = new ScopeCommands(repo);
    let s = newSession({ customerName: 'C', opportunityName: 'O' }); await repo.create(s);
    s = await commands.saveInput(s.id, { expectedRevision: s.revision, ...(await loadSeed('modernization')).input });
    s = await commands.analyze(s.id, { expectedRevision: s.revision });
    const bad = structuredClone(s); bad.revision++; bad.requirements.FR_01!.evidence[0]!.excerpt = 'invented source';
    await expect(repo.save(bad, s.revision)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const recycled = structuredClone(s); recycled.revision++; recycled.idCounters.FR = 0;
    await expect(repo.save(recycled, s.revision)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const changed = structuredClone(s); changed.revision++; changed.documents.DOC_01!.title = 'Rewritten original';
    await expect(repo.save(changed, s.revision)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await repo.load(s.id)).toEqual(s);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
