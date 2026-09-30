import { expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';

it('stores exact pasted input through revision-checked application commands', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phase1-api-'));
  try {
    const app = createApp(new JsonSessionRepository(directory));
    const { body: session } = await request(app).post('/api/sessions').send({ customerName: 'Customer', opportunityName: 'Scope' }).expect(201);
    const text = '  # Customer 🧭\r\n\r\nExisting CRM is Salesforce.  \r\n';
    const { body: saved } = await request(app).post(`/api/sessions/${session.id}/input`).send({ expectedRevision: 1, text, inputKind: 'PASTED_MARKDOWN', title: 'Discovery' }).expect(200);
    expect(saved.documents.DOC_01.text).toBe(text);
    expect(saved.documents.DOC_01.sectionIds.length).toBeGreaterThan(0);
    expect(saved.revision).toBe(2);
    await request(app).post(`/api/sessions/${session.id}/input`).send({ expectedRevision: 1, text, inputKind: 'PASTED_TEXT', title: 'Stale' }).expect(409);
    expect((await request(app).get(`/api/sessions/${session.id}`).expect(200)).body).toEqual(saved);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('exposes seeded analysis and review commands with controlled field errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phase1-routes-'));
  try {
    const app = createApp(new JsonSessionRepository(directory));
    const seeds = await request(app).get('/api/seeds').expect(200);
    expect(seeds.body).toHaveLength(4);
    let { body: s } = await request(app).post('/api/sessions/seed').send({ seedId: 'integration-heavy' }).expect(201);
    ({ body: s } = await request(app).post(`/api/sessions/${s.id}/analyze`).send({ expectedRevision: s.revision }).expect(200));
    expect(s.requirements.INT_01.description).toBe('Existing CRM is Salesforce.');
    const error = await request(app).patch(`/api/sessions/${s.id}/requirements/INT_01`).send({ expectedRevision: s.revision, patch: { description: 'Existing CRM is HubSpot.' } }).expect(400);
    expect(error.body.error.paths).toContain('requirement.description');
    for (const kind of ['requirements', 'assumptions', 'questions']) for (const id of Object.keys(s[kind])) ({ body: s } = await request(app).post(`/api/sessions/${s.id}/${kind}/${id}/review`).send({ expectedRevision: s.revision }).expect(200));
    ({ body: s } = await request(app).post(`/api/sessions/${s.id}/approve`).send({ expectedRevision: s.revision }).expect(200));
    expect((await request(app).get(`/api/sessions/${s.id}/scope`).expect(200)).body.status).toBe('APPROVED');
    await request(app).patch(`/api/sessions/${s.id}/requirements/INT_01`).send({ expectedRevision: s.revision, patch: { id: 'INT_99' } }).expect(400);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
