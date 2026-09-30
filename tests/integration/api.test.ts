import { expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
it('serves health and create/load/delete with safe errors and revision conflicts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scoping-api-'));
  try {
    const app = createApp(new JsonSessionRepository(directory));
    expect((await request(app).get('/api/health')).body.mode).toBe('MOCK');
    const created = await request(app).post('/api/sessions').send({ customerName: 'Customer', opportunityName: 'API' }).expect(201);
    expect((await request(app).get(`/api/sessions/${created.body.id}`).expect(200)).body).toEqual(created.body);
    await request(app).delete(`/api/sessions/${created.body.id}`).send({ expectedRevision: 999 }).expect(409);
    await request(app).delete(`/api/sessions/${created.body.id}`).send({ expectedRevision: 1 }).expect(204);
    await request(app).get(`/api/sessions/${created.body.id}`).expect(404);
    const error = await request(app).post('/api/sessions').send({}).expect(400);
    expect(error.body.error.code).toBe('VALIDATION_ERROR');
    expect(error.body.error.stack).toBeUndefined();
    await request(app).post('/api/sessions').set('Origin', 'https://evil.example').send({}).expect(403);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
