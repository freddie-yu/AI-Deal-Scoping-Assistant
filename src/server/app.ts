import { DeliverableCommands } from '../application/deliverables.js';
import { EstimationCommands } from '../application/estimation.js';
import { ImpactCommands } from '../application/impact.js';
import { QualityCommands } from '../application/quality.js';
import express, { type ErrorRequestHandler } from 'express';
import { resolve } from 'node:path';
import type { SessionRepository } from '../persistence/repository.js';
import { SessionCommands } from '../application/sessions.js';
import { ApplicationError, ValidationError } from '../application/errors.js';
import { ScopeCommands } from '../application/scope.js';
export function createApp(repository: SessionRepository) {
  const app = express(); const commands = new SessionCommands(repository); const scope = new ScopeCommands(repository); const deliverables = new DeliverableCommands(repository);
  const estimation = new EstimationCommands(repository);
  const impact = new ImpactCommands(repository);
  const quality = new QualityCommands(repository);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.hostname;
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Local access only.' } }); return; }
    const origin = req.get('origin');
    const allowed = ['http://127.0.0.1:3001', 'http://localhost:3001', 'http://127.0.0.1:5173', 'http://localhost:5173'];
    if (origin && !allowed.includes(origin)) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unexpected request origin.' } }); return; }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok', mode: 'MOCK', phase: 2 }); });
  app.get('/api/seeds', async (_req, res) => { res.json(await commands.seeds()); });
  app.post('/api/sessions/seed', async (req, res) => { res.status(201).json(await commands.createSeed(req.body as unknown)); });
  app.post('/api/sessions', async (req, res) => { res.status(201).json(await commands.create(req.body as unknown)); });
  app.get('/api/sessions/:id', async (req, res) => { res.json(await commands.load(req.params.id)); });
  app.post('/api/sessions/:id/input', async (req, res) => { res.json(await scope.saveInput(req.params.id, req.body as unknown)); });
  app.post('/api/sessions/:id/analyze', async (req, res) => { res.json(await scope.analyze(req.params.id, req.body as unknown)); });
  app.get('/api/sessions/:id/scope', async (req, res) => { res.json(await scope.readScope(req.params.id)); });
  app.patch('/api/sessions/:id/requirements/:itemId', async (req, res) => { res.json(await scope.editRequirement(req.params.id, req.params.itemId, req.body as unknown)); });
  app.post('/api/sessions/:id/requirements/:itemId/expected-users', async (req, res) => { res.json(await scope.changeExpectedUsers(req.params.id, req.params.itemId, req.body as unknown)); });
  app.patch('/api/sessions/:id/assumptions/:itemId', async (req, res) => { res.json(await scope.editAssumption(req.params.id, req.params.itemId, req.body as unknown)); });
  app.post('/api/sessions/:id/questions/:itemId/answer', async (req, res) => { res.json(await scope.answerQuestion(req.params.id, req.params.itemId, req.body as unknown)); });
  for (const collection of ['requirements', 'assumptions', 'questions'] as const) app.post(`/api/sessions/:id/${collection}/:itemId/review`, async (req, res) => { res.json(await scope.review(req.params.id, collection, req.params.itemId, req.body as unknown)); });
  app.post('/api/sessions/:id/approve', async (req, res) => { res.json(await scope.approve(req.params.id, req.body as unknown)); });
  app.post('/api/sessions/:id/generate', async (req, res) => { res.json(await deliverables.generate(req.params.id, req.body as unknown)); });
  app.post('/api/sessions/:id/runs/:runId/sections/:sectionId/review', async (req, res) => { res.json(await deliverables.review(req.params.id, req.params.runId, req.params.sectionId, req.body as unknown)); });
  app.get('/api/sessions/:id/artifacts', async (req, res) => { res.json(await deliverables.read(req.params.id)); });
  app.get('/api/sessions/:id/coverage', async (req, res) => { res.json((await deliverables.read(req.params.id)).coverage); });
  app.get('/api/sessions/:id/diagram', async (req, res) => { res.json((await deliverables.read(req.params.id)).diagram); });
  app.get('/api/sessions/:id/estimate', async (req, res) => { res.json(await estimation.read(req.params.id)); });
  app.get('/api/sessions/:id/impact', async (req, res) => { res.json(await impact.read(req.params.id)); });
  app.post('/api/sessions/:id/impact/recalculate', async (req, res) => { res.json(await impact.recalculate(req.params.id, req.body as unknown)); });
  app.post('/api/sessions/:id/impact/regenerate', async (req, res) => { res.json(await deliverables.generateAffected(req.params.id, req.body as unknown)); });
  app.get('/api/sessions/:id/quality', async (req, res) => { res.json(await quality.read(req.params.id)); });
  app.post('/api/sessions/:id/quality/evaluate', async (req, res) => { res.json(await quality.evaluate(req.params.id, req.body as unknown)); });
  app.get('/api/sessions/:id/estimate/ledger', async (req, res) => { res.json(await estimation.read(req.params.id)); });
  for (const action of ['prepare', 'reconcile', 'review', 'calculate'] as const) app.post(`/api/sessions/:id/estimate/${action}`, async (req, res) => { res.json(await estimation[action](req.params.id, req.body as unknown)); });
  app.post('/api/sessions/:id/estimate/boundaries', async (req, res) => { res.json(await estimation.addBoundary(req.params.id, req.body as unknown)); });
  app.patch('/api/sessions/:id/estimate/configuration', async (req, res) => { res.json(await estimation.configure(req.params.id, req.body as unknown)); });
  app.patch('/api/sessions/:id/estimate/units/:unitId', async (req, res) => { res.json(await estimation.editUnit(req.params.id, req.params.unitId, req.body as unknown)); });
  app.delete('/api/sessions/:id', async (req, res) => { await commands.delete(req.params.id, req.body as unknown); res.sendStatus(204); });
  app.use('/api', (_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } }); });
  app.use(express.static(resolve('dist/client')));
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const failure = error instanceof ApplicationError ? error : error instanceof SyntaxError ? new ValidationError('Request body must be valid JSON.') : error instanceof Error && 'type' in error && error.type === 'entity.too.large' ? new ApplicationError('VALIDATION_ERROR', 'Request exceeds the 128 KB limit.', 413) : new ApplicationError('INTERNAL_ERROR', 'The request could not be completed.', 500);
    res.status(failure.status).json({ error: { code: failure.code, message: failure.message, paths: failure.paths } });
  };
  app.use(errorHandler); return app;
}
