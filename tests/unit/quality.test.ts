import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonSessionRepository } from '../../src/persistence/json-repository.js';
import { approvedSeed, generateAndAccept } from '../helpers/phase2.js';
import { EstimationCommands } from '../../src/application/estimation.js';
import { scopeFingerprint } from '../../src/application/scope-review.js';
import { calculateEstimate } from '../../src/estimation/engine.js';
import { setConfig } from '../../src/estimation/config.js';
import { newSession } from '../../src/application/sessions.js';
import { QualityGateSchema, type ArtifactSection, type ScopingSession } from '../../src/domain/index.js';
import { evaluateQuality, gateCurrent, QUALITY_RULE_VERSION } from '../../src/quality/index.js';
import { qualityCoverage, coveragePercentage } from '../../src/traceability/quality-coverage.js';
import { QualityCommands } from '../../src/application/quality.js';

let dir: string, repo: JsonSessionRepository, clean: ScopingSession, integrated: ScopingSession;
const section = (s: ScopingSession, kind: ArtifactSection['payload']['kind']) => Object.values(s.artifactSections).find(a => a.payload.kind === kind)!;
async function fullyAccepted(seedId: string) {
  let s = await approvedSeed(repo, seedId);
  for (const a of Object.values(s.assumptions)) { a.validation = 'CONFIRMED'; a.confirmation = { note: 'Customer validated the fixture assumption.', evidence: a.sources }; }
  for (const q of Object.values(s.questions)) { q.status = 'ANSWERED'; q.answer = { text: 'Customer supplied and reviewed this discovery input.', evidence: [], basis: 'Confirmed workshop record' }; }
  s.scopeReviewFingerprint = scopeFingerprint(s); s.revision++; await repo.save(s, s.revision - 1);
  for (const operation of ['prd-scope', 'architecture', 'strategies', 'delivery'] as const) s = await generateAndAccept(repo, s, operation);
  const commands = new EstimationCommands(repo);
  s = await commands.prepare(s.id, { expectedRevision: s.revision });
  s = await commands.review(s.id, { expectedRevision: s.revision, confirmed: true });
  setConfig(s, 'calibration', { status: 'CALIBRATED', evidence: 'Test-only reviewed calibration fixture' }, 'Test-only calibration', true);
  for (const a of Object.values(s.artifactSections)) if (a.payload.kind === 'EstimationUnit' && a.payload.unitType === 'INTEGRATION') setConfig(s, `readiness.${a.id}`, true, 'Confirmed interface availability', true);
  s = calculateEstimate(s, '2026-09-27T00:00:00Z');
  s.revision++; await repo.save(s, s.revision - 1); return s;
}
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'quality-')); repo = new JsonSessionRepository(dir); clean = await fullyAccepted('ai-enabled'); integrated = await fullyAccepted('integration-heavy'); }, 60000);
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

it('passes a fully accepted grounded scenario without modifying canonical state', () => {
  const before = JSON.stringify(clean); const gate = evaluateQuality(clean);
  expect(gate.issues).toEqual([]); expect(gate.status).toBe('PASS');
  expect(QualityGateSchema.safeParse(gate).success).toBe(true); expect(JSON.stringify(clean)).toBe(before);
});
it('blocks a reported browser diagram render failure and clears it after successful rendering', () => {
  const before = JSON.stringify(clean);
  const failed = evaluateQuality(clean, { diagramRendered: false });
  expect(failed.status).toBe('BLOCKED');
  expect(failed.issues.find(i => i.ruleId === 'diagram-render')).toMatchObject({ type: 'STRUCTURAL_INTEGRITY', severity: 'ERROR', blocking: true });
  expect(evaluateQuality(clean, { diagramRendered: true }).status).toBe('PASS');
  expect(JSON.stringify(clean)).toBe(before);
});
it('binds deterministic finding identity and gate currency to revision and rule version', () => {
  const s = structuredClone(clean); s.questions.Q_01!.status = 'OPEN'; delete s.questions.Q_01!.answer; s.scopeReviewFingerprint = scopeFingerprint(s);
  s.gate = evaluateQuality(s); expect(evaluateQuality(s)).toEqual(s.gate); expect(gateCurrent(s)).toBe(true);
  expect(s.gate.ruleVersion).toBe(QUALITY_RULE_VERSION);
  s.revision++; expect(gateCurrent(s)).toBe(false); expect(evaluateQuality(s).issues.map(i => i.key)).toEqual(s.gate.issues.map(i => i.key));
  s.gate = evaluateQuality(s); s.gate.ruleVersion = 'old-rules'; expect(gateCurrent(s)).toBe(false);
});
it('warns for an uncovered HIGH requirement instead of blocking otherwise valid content', () => {
  let s = structuredClone(clean);
  s.requirements.BR_02 = { ...structuredClone(s.requirements.BR_01!), id: 'BR_02', displayId: 'BR_02' };
  s.idCounters.BR = 2; s.collectionCounters.requirements++; s.scopeReviewFingerprint = scopeFingerprint(s);
  s = calculateEstimate(s, '2026-09-27T00:00:00Z');
  const gate = evaluateQuality(s);
  expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe('REVIEW_REQUIRED');
  expect(gate.issues.find(i => i.type === 'UNCOVERED_REQUIREMENT' && i.related.some(n => 'id' in n && n.id === 'BR_02'))).toMatchObject({ severity: 'WARNING', blocking: false });
  expect(gate.issues.filter(i => i.type === 'UNCOVERED_REQUIREMENT' && i.related.some(n => 'id' in n && n.id === 'BR_02')).map(i => i.ruleId)).toEqual(['delivery-coverage-gap', 'design-coverage-gap', 'scope-coverage']);
});
it.each(['Capability', 'Integration', 'AIUseCase'] as const)('blocks accepted unsupported %s', kind => {
  const s = structuredClone(kind === 'Integration' ? integrated : clean); section(s, kind).grounding = [];
  const gate = evaluateQuality(s); expect(gate.status).toBe('BLOCKED'); expect(gate.issues.some(i => i.type === 'UNSUPPORTED_SCOPE' && i.blocking)).toBe(true);
});
it('blocks architecture without valid requirement or assumption justification', () => {
  const s = structuredClone(clean); section(s, 'ArchitectureComponent').grounding = [];
  expect(evaluateQuality(s).issues.some(i => i.type === 'UNJUSTIFIED_COMPONENT' && i.blocking)).toBe(true);
});
it('requires structured strategy inventories or reviewed applicability instead of arbitrary narrative', () => {
  const s = structuredClone(clean), data = section(s, 'DataDomain');
  data.payload = structuredClone(section(s, 'Narrative').payload);
  const missing = evaluateQuality(s);
  expect(missing.issues.some(i => i.ruleId === 'required-inventory' && i.message.startsWith('DATA_STRATEGY') && i.blocking)).toBe(true);
  data.applicability = { state: 'NOT_APPLICABLE', reason: 'Customer explicitly deferred persistence in this scenario.' };
  expect(evaluateQuality(s).issues.some(i => i.ruleId === 'required-inventory' && i.message.startsWith('DATA_STRATEGY'))).toBe(false);
});
it('warns for an included integration with no delivery representation', () => {
  const s = structuredClone(integrated), a = structuredClone(section(s, 'Integration'));
  a.id = `AS_${++s.idCounters.AS}`; a.sectionKey = 'missing-delivery-interface'; s.artifactSections[a.id] = a; s.artifacts[a.artifactId]!.sectionIds.push(a.id);
  const gate = evaluateQuality(s); expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe('REVIEW_REQUIRED'); expect(gate.issues.find(i => i.type === 'MISSING_WORKSTREAM' && i.related.some(n => 'id' in n && n.id === a.id))).toMatchObject({ severity: 'WARNING', blocking: false });
});
it('warns for an accepted AI use case with unresolved mandatory human review', () => {
  const s = structuredClone(clean), a = section(s, 'AIUseCase'); if (a.payload.kind === 'AIUseCase') a.payload.humanReviewControls = { state: 'UNRESOLVED', reason: 'Not designed', questionIds: [] };
  const gate = evaluateQuality(s); expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe('REVIEW_REQUIRED'); expect(gate.issues.some(i => i.type === 'INCOMPLETE_AI_CONTROLS' && !i.blocking)).toBe(true);
});
it('warns when missing rates have explicitly unavailable ROM, but blocks fabricated ROM', () => {
  let s = structuredClone(clean); setConfig(s, 'rates.E', null, 'Rate absent', true); s = calculateEstimate(s, '2026-09-27T00:00:00Z');
  const gate = evaluateQuality(s); expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe('REVIEW_REQUIRED'); expect(gate.issues.some(i => i.type === 'MISSING_ESTIMATE_INPUT' && !i.blocking)).toBe(true);
  const a = section(s, 'EstimateSummary'); if (a.payload.kind === 'EstimateSummary') a.payload.commercials.total = { low: 100, high: 200, unit: 'minor-units' };
  expect(evaluateQuality(s).issues.some(i => i.type === 'COMMERCIAL_INCONSISTENCY' && i.blocking)).toBe(true);
});
it('warns for unresolved questions and reviewed provisional assumptions', () => {
  let s = structuredClone(clean); s.questions.Q_01!.status = 'OPEN'; delete s.questions.Q_01!.answer;
  s.assumptions.ASM_01!.validation = 'PROVISIONAL'; delete s.assumptions.ASM_01!.confirmation; s.scopeReviewFingerprint = scopeFingerprint(s); s = calculateEstimate(s, '2026-09-27T00:00:00Z');
  const gate = evaluateQuality(s); expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe('REVIEW_REQUIRED'); expect(gate.issues.map(i => i.type)).toEqual(expect.arrayContaining(['UNRESOLVED_QUESTION', 'UNVALIDATED_ASSUMPTION']));
});
it.each([['jvm', 'ALLOWED_RUNTIME', 'CONFLICT', 'BLOCKED'], ['customer-approved-suite', 'APPROVED_PRODUCT', 'UNKNOWN', 'REVIEW_REQUIRED']] as const)('handles %s compatibility with approved severity', (value, kind, status, expected) => {
  const s = structuredClone(clean); s.assumptions.ASM_01!.technologyConstraints = [{ key: 'backend-rule', target: 'BACKEND', strength: 'MUST', kind, values: [value] }]; s.scopeReviewFingerprint = scopeFingerprint(s);
  section(s, 'AIUseCase').technologyChoices = [{ key: 'backend', target: 'BACKEND', technologyKey: { state: 'KNOWN', value: 'python-fastapi' } }];
  const gate = evaluateQuality(s); expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe(expected); expect(gate.compatibilityResults.some(r => r.status === status)).toBe(true);
});
it('blocks ledger or aggregate tampering against authoritative recalculation', () => {
  const s = structuredClone(clean), a = section(s, 'EstimateItem'); if (a.payload.kind === 'EstimateItem') a.payload.moneyLedger[0]!.cost.low++;
  expect(evaluateQuality(s).issues.some(i => i.type === 'COMMERCIAL_INCONSISTENCY' && i.blocking)).toBe(true);
});
it('blocks stale required content, unreviewed grounding and dangling references', () => {
  const s = structuredClone(clean); section(s, 'ArchitectureComponent').freshness = 'STALE';
  expect(evaluateQuality(s).status).toBe('BLOCKED');
  const t = structuredClone(clean); t.assumptions.ASM_01!.review = 'DRAFT';
  expect(evaluateQuality(t).status).toBe('BLOCKED');
  const u = structuredClone(clean); section(u, 'ArchitectureComponent').dependencies = ['AS_9999'];
  expect(evaluateQuality(u).issues.some(i => i.type === 'STRUCTURAL_INTEGRITY' && i.blocking)).toBe(true);
});
it('projects stage coverage with stale, pending, excluded and assumption-only boundaries', () => {
  const s = structuredClone(clean); expect(qualityCoverage(s).scope.uncoveredIds).toEqual([]);
  const a = section(s, 'Capability'); const req = a.payload.kind === 'Capability' ? a.payload.requirementIds[0]! : '';
  a.freshness = 'STALE'; expect(qualityCoverage(s).scope.uncoveredIds).toContain(req);
  a.freshness = 'CURRENT'; a.review = 'PROPOSED'; expect(qualityCoverage(s).scope.uncoveredIds).toContain(req);
  s.requirements[req]!.inclusion = 'EXCLUDED'; s.requirements[req]!.exclusionReason = 'Customer deferred';
  expect(qualityCoverage(s).excluded).toContainEqual({ id: req, reason: 'Customer deferred' }); expect(qualityCoverage(s).eligibleRequirementIds).not.toContain(req);
  for (const design of Object.values(s.artifactSections).filter(v => ['ArchitectureComponent', 'DataDomain', 'Integration', 'AIUseCase'].includes(v.payload.kind))) design.grounding = [{ source: { kind: 'Assumption', id: 'ASM_01' }, reviewedRevision: 1, rationale: 'Reviewed operating constraint' }];
  expect(qualityCoverage(s).design.coveredIds).toEqual([]);
  expect(coveragePercentage(qualityCoverage(newSession({ customerName: 'Empty', opportunityName: 'Empty' })), 'scope')).toBeNull();
});
it('does not count payload requirement links that lack matching reviewed grounding', () => {
  const s = structuredClone(clean), a = section(s, 'Capability');
  if (a.payload.kind !== 'Capability') throw new Error('Capability fixture required');
  const req = a.payload.requirementIds[0]!;
  a.grounding = [{ source: { kind: 'Requirement', id: 'FR_01' }, reviewedRevision: 1, rationale: 'Different workflow' }];
  expect(qualityCoverage(s).scope.uncoveredIds).toContain(req);
});
it('keeps unsupported rejected proposal findings at warning severity without accepting coverage', () => {
  const s = structuredClone(clean), run = Object.values(s.generationRuns).find(r => r.operation === 'prd-scope')!;
  const proposal = run.proposals.find(p => 'candidate' in p && p.candidate.kind === 'ArtifactSection' && p.candidate.record.payload.kind === 'Capability')!;
  if (!('candidate' in proposal) || proposal.candidate.kind !== 'ArtifactSection' || !('id' in proposal.target)) throw new Error('Fixture proposal missing');
  proposal.candidate.record.grounding = []; run.decisions![proposal.target.id] = 'REJECTED';
  const gate = evaluateQuality(s); expect(gate.status, JSON.stringify(gate.issues.filter(i => i.blocking))).toBe('REVIEW_REQUIRED');
  expect(gate.issues.find(i => i.ruleId === 'proposal-grounding')).toMatchObject({ severity: 'WARNING', blocking: false });
  expect(gate.coverage.scope.uncoveredIds).toEqual([]);
});
it('detects selected cloud mismatch, invalid catalog, broken diagram endpoint and duplicate result', () => {
  for (const mutation of ['cloud', 'catalog', 'endpoint', 'duplicate'] as const) {
    const s = structuredClone(clean), a = section(s, 'ArchitectureComponent');
    if (a.payload.kind === 'ArchitectureComponent') {
      if (mutation === 'cloud') (a.payload as { cloud: string }).cloud = 'AZURE';
      if (mutation === 'catalog') a.payload.catalogServiceKey = 'aws:invented';
      if (mutation === 'endpoint') a.payload.connections.push({ from: { kind: 'COMPONENT', sectionId: a.id }, to: { kind: 'COMPONENT', sectionId: 'AS_9999' }, description: 'Broken' });
    }
    if (mutation === 'duplicate') {
      const result = structuredClone(section(s, 'EstimateItem')); result.id = `AS_${++s.idCounters.AS}`;
      s.artifactSections[result.id] = result; s.artifacts[result.artifactId]!.sectionIds.push(result.id);
    }
    expect(evaluateQuality(s).status, mutation).toBe('BLOCKED');
  }
});
it('blocks missing or duplicate solution summaries and bad aggregate membership', () => {
  for (const mutation of ['missing', 'retired', 'duplicate', 'membership', 'missing-member', 'duplicate-member'] as const) {
    const s = structuredClone(clean), summary = section(s, 'EstimateSummary');
    if (mutation === 'missing') { delete s.artifactSections[summary.id]; s.artifacts[summary.artifactId]!.sectionIds = s.artifacts[summary.artifactId]!.sectionIds.filter(id => id !== summary.id); }
    if (mutation === 'duplicate') { const other = structuredClone(summary); other.id = `AS_${++s.idCounters.AS}`; other.sectionKey = 'duplicate-summary'; s.artifactSections[other.id] = other; s.artifacts[other.artifactId]!.sectionIds.push(other.id); }
    if (mutation === 'retired') summary.lifecycle = 'RETIRED';
    if (mutation === 'membership' && summary.payload.kind === 'EstimateSummary') summary.payload.estimateIds.push('AS_9999');
    if (mutation === 'missing-member' && summary.payload.kind === 'EstimateSummary') summary.payload.estimateIds.pop();
    if (mutation === 'duplicate-member' && summary.payload.kind === 'EstimateSummary') summary.payload.estimateIds.push(summary.payload.estimateIds[0]!);
    const gate = evaluateQuality(s);
    expect(gate.status, mutation).toBe('BLOCKED');
    expect(gate.issues.some(i => i.ruleId === (['missing', 'retired', 'duplicate'].includes(mutation) ? 'estimate-summary-cardinality' : 'estimate-summary-membership')), mutation).toBe(true);
  }
});
it('reports obsolete pending proposal snapshots without treating historical accepted runs as obsolete', () => {
  const s = structuredClone(clean), run = Object.values(s.generationRuns).find(r => r.operation === 'architecture')!;
  run.acceptance = 'PENDING'; run.decisions = {}; run.acceptanceRevision = s.revision - 1;
  const gate = evaluateQuality(s);
  expect(gate.issues.some(i => i.ruleId === 'proposal-snapshot' && i.related.some(n => 'id' in n && n.id === run.id))).toBe(true);
  expect(gate.status).toBe('REVIEW_REQUIRED');
  run.acceptanceRevision = s.revision;
  expect(evaluateQuality(s).issues.some(i => i.ruleId === 'proposal-snapshot')).toBe(false);
  delete run.acceptanceRevision;
  expect(evaluateQuality(s).issues.some(i => i.ruleId === 'proposal-snapshot')).toBe(true);
  run.acceptance = 'ACCEPTED';
  expect(evaluateQuality(s).issues.some(i => i.ruleId === 'proposal-snapshot')).toBe(false);
});
it('persists quality operationally and refuses obsolete evaluations', async () => {
  const commands = new QualityCommands(repo), before = await repo.load(clean.id);
  const saved = await commands.evaluate(clean.id, { expectedRevision: before.revision });
  expect(saved.revision).toBe(before.revision); expect(saved.gate?.status).toBe('PASS'); expect((await commands.read(clean.id)).current).toBe(true);
  await expect(commands.evaluate(clean.id, { expectedRevision: before.revision - 1 })).rejects.toThrow();
  const changed = await repo.load(clean.id); changed.revision++; changed.context.opportunityName = 'Changed domain'; await repo.save(changed, before.revision);
  expect((await commands.read(clean.id)).current).toBe(false);
});

