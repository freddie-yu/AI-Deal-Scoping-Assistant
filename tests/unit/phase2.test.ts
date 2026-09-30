import { expect, it } from 'vitest';
import { buildDiagram } from '../../src/architecture/diagram.js';
import { compatibilityStatus } from '../../src/architecture/compatibility.js';
import { AWS_CATALOG } from '../../src/architecture/catalog.js';
import { phase2Schemas } from '../../src/domain/deliverables.js';

it('keeps operation-specific strict schemas and rejects numeric delivery output', () => {
  expect(phase2Schemas.delivery.safeParse({ sections: [], effort: 40 }).success).toBe(false);
  expect(phase2Schemas.architecture.safeParse({ sections: [{ id: 'AS_999', payload: { cloud: 'GCP' } }] }).success).toBe(false);
});
it('uses explicit compatibility relations and preserves unknown customer products', () => {
  const constraint = { key: 'db', target: 'DATABASE' as const, strength: 'MUST' as const, kind: 'DATABASE_COMPATIBILITY' as const, values: ['postgresql'] };
  expect(compatibilityStatus(constraint, 'aws:rds-postgresql').status).toBe('COMPATIBLE');
  expect(compatibilityStatus({ ...constraint, kind: 'ALLOWED_RUNTIME', values: ['jvm'] }, 'python-fastapi').status).toBe('CONFLICT');
  expect(compatibilityStatus({ ...constraint, kind: 'APPROVED_PRODUCT', values: ['customer-approved-suite'] }, 'vendor:custom-product').status).toBe('UNKNOWN');
  expect(compatibilityStatus({ ...constraint, values: ['postgresql-42'] }, 'aws:rds-postgresql').status).toBe('UNKNOWN');
  expect(AWS_CATALOG['aws:rds-postgresql'].name).toContain('PostgreSQL');
});
it('has a deterministic empty diagram with no provider-authored Mermaid', () => {
  expect(buildDiagram([])).toEqual(buildDiagram([]));
  expect(buildDiagram([]).source).toContain('flowchart LR');
});
