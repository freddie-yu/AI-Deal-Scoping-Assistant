import type { ScopingSession, ArtifactSection, QualityGate } from '../domain/index.js';
import { acceptedCurrent } from '../traceability/quality-coverage.js';
import { artifactEligible } from '../application/deliverable-inputs.js';
import { hash, RULESET } from '../estimation/config.js';
import { TEMPLATE_VERSION, DISCLAIMER_VERSION, SECTION_TITLES } from './constants.js';
export const findingsHash = (gate: QualityGate) => hash({ status: gate.status, issues: gate.issues, coverage: gate.coverage, compatibilityResults: gate.compatibilityResults });
export function acknowledged(s: ScopingSession): boolean {
  const a = s.gate?.acknowledgment;
  return !!a && a.revision === s.revision && a.findingsHash === findingsHash(s.gate!);
}
export function packageSections(s: ScopingSession): ArtifactSection[] {
  return Object.values(s.artifactSections).filter(a => {
    if (s.artifacts[a.artifactId]?.kind === 'ANALYSIS') return a.lifecycle === 'ACTIVE' && a.freshness === 'CURRENT';
    if (a.payload.kind === 'EstimationUnit' || a.payload.kind === 'EstimateItem') return acceptedCurrent(s, a); // Numerical inputs use Phase 3 hashes; current QualityGate reproduces their ledger.
    if (a.payload.kind === 'EstimateSummary') return a.lifecycle === 'ACTIVE' && a.freshness === 'CURRENT' && a.review === 'REVIEWED' && a.reviewedRevision === a.revision;
    return acceptedCurrent(s, a) && artifactEligible(s, a);
  }).sort((a,b) => a.id.localeCompare(b.id, 'en'));
}
/** Ephemeral reference composition. Domain payloads remain solely in the session. */
export function assemblePackage(s: ScopingSession) {
  if (!s.gate) throw new Error('Evaluate quality before preview.');
  const sections = packageSections(s);
  const kind = (k: string) => sections.filter(a => s.artifacts[a.artifactId]?.kind === k).map(a => a.id);
  const topic = (...topics: string[]) => sections.filter(a => a.payload.kind === 'Narrative' && topics.includes(a.payload.topic)).map(a => a.id);
  const all = sections.map(a => a.id);
  const references = [topic('EXECUTIVE_SUMMARY', 'OVERVIEW', 'PROBLEM'), topic('OBJECTIVES'), [], kind('PRD'), kind('FUNCTIONAL_SCOPE'), kind('ARCHITECTURE'), kind('ARCHITECTURE'), kind('DATA_STRATEGY'), kind('INTEGRATION_STRATEGY'), kind('AI_STRATEGY'), sections.filter(a => a.technologyChoices?.length || a.payload.kind === 'ArchitectureComponent' || a.payload.kind === 'AIUseCase').map(a => a.id), kind('DELIVERY_PLAN'), kind('ESTIMATE'), kind('ESTIMATE'), topic('ASSUMPTIONS'), topic('RISKS'), topic('DEPENDENCIES'), topic('QUESTIONS'), [], all, [], [], []];
  const basis = { sessionId: s.id, revision: s.revision, gateId: s.gate.id, gateRuleVersion: s.gate.ruleVersion, findingsHash: findingsHash(s.gate), sectionRevisions: sections.map(a => ({ id: a.id, revision: a.revision })), estimationRuleSet: RULESET, templateVersion: TEMPLATE_VERSION, disclaimerVersion: DISCLAIMER_VERSION };
  return { basis, sections: SECTION_TITLES.map((title, index) => ({ key: 'package-' + (index + 1), title, sectionIds: references[index]! })) };
}


