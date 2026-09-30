import { createApp } from './app.js';
import { JsonSessionRepository } from '../persistence/json-repository.js';
const app = createApp(new JsonSessionRepository(process.env.DATA_DIR ?? '.data'));
const server = app.listen(3001, '127.0.0.1', () => { console.info('AI Deal Scoping Assistant: http://127.0.0.1:3001 — MOCK / Phase 1'); });
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
