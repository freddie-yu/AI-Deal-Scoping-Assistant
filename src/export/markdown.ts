import { createHash } from 'node:crypto';
import type { ScopingSession, ArtifactSection, EstimateSummary } from '../domain/index.js';
import { buildDiagram } from '../architecture/diagram.js';
import { AWS_CATALOG, isServiceKey } from '../architecture/catalog.js';
import { estimationCoverage } from '../traceability/estimation.js';
import { hash, resolveConfig } from '../estimation/config.js';
import { assemblePackage, packageSections, acknowledged } from './package.js';
import { DISCLAIMER } from './constants.js';
import { escapeText as e, readable, words, range, money, table, filename } from './text.js';

function sectionText(a: ArtifactSection): string {
  const p = a.payload;
  let body = '### ' + e(a.title) + '\n\n' + e(a.id + ' · revision ' + a.revision + ' · ' + a.origin + ' · ' + a.review + ' · ' + a.freshness) + '\n\n';
  if (a.applicability) body += 'Applicability: ' + e(readable(a.applicability)) + '\n\n';
  if (p.kind === 'Narrative') {
    body += p.paragraphs.map(x => e(x.text) + '\n\nOrigin: ' + e(x.origin) + (x.anchors.length ? ' · Evidence: ' + e(x.anchors.map(a => a.documentId + '/' + a.sectionId + ' [' + a.start + ',' + a.end + ')').join('; ')) : '')).join('\n\n') + '\n\n';
  } else {
    body += table(['Field', 'Reviewed value'], Object.entries(p).filter(([k]) => k !== 'kind').map(([k,v]) => [words(k), readable(v)])) + '\n';
  }
  if (a.grounding.length) body += table(['Grounding', 'Reviewed revision', 'Rationale'], a.grounding.map(g => [g.source.kind + ' ' + g.source.id, g.reviewedRevision, g.rationale])) + '\n';
  if (a.dependencies?.length) body += 'Dependencies: ' + e(a.dependencies.join(', ')) + '\n\n';
  return body;
}
const list = (values: string[]) => values.length ? values.map(v => '- ' + e(v)).join('\n') + '\n' : 'None recorded.\n';
export function renderPackage(s: ScopingSession) {
  const composite = assemblePackage(s), accepted = packageSections(s), byId = new Map(accepted.map(a => [a.id,a]));
  const summary = accepted.find(a => a.payload.kind === 'EstimateSummary')?.payload as EstimateSummary | undefined;
  const render = (ids: string[]) => ids.map(id => sectionText(byId.get(id)!)).join('\n') || 'Unavailable / no current accepted content.\n';
  const requirements = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE').sort((a,b) => a.id.localeCompare(b.id));
  const assumptions = Object.values(s.assumptions).filter(r => r.lifecycle === 'ACTIVE').sort((a,b) => a.id.localeCompare(b.id));
  const questions = Object.values(s.questions).filter(r => r.lifecycle === 'ACTIVE').sort((a,b) => a.id.localeCompare(b.id));
  const coverage = s.gate!.coverage, gate = s.gate!;
  const sections = composite.sections.map((part, i) => {
    let body: string;
    switch (i) {
      case 0: body = e(s.context.customerName + ' — ' + s.context.opportunityName) + '\n\nMOCK: seeded MockAI responses; review, edits, impact, estimation, quality and export use live deterministic application logic. Arbitrary unrecorded analysis is not fabricated.\n\n' + render(part.sectionIds); break;
      case 2: body = table(['Requirement', 'Description', 'Priority', 'Origin', 'Scope', 'Review', 'Measures / constraints'], requirements.map(r => [r.id,r.description,r.priority,r.origin,r.inclusion + (r.exclusionReason ? ': '+r.exclusionReason : ''),r.review,readable(r.measures) + '; ' + readable(r.technologyConstraints)])); break;
      case 6: {
        const components = accepted.filter(a => a.payload.kind === 'ArchitectureComponent');
        try {
          const diagram = buildDiagram(components);
          body = '```mermaid\n' + diagram.source + '\n```\n\nComponent inventory (readable without Mermaid):\n\n' +
            table(['Component', 'Name / AWS service', 'Purpose', 'Grounding / rationale'], components.map(a => {
              if (a.payload.kind !== 'ArchitectureComponent') return [];
              const p = a.payload; return [a.id,p.name + ' / ' + (isServiceKey(p.catalogServiceKey) ? AWS_CATALOG[p.catalogServiceKey].name : p.catalogServiceKey),p.purpose,a.grounding.map(g => g.source.id).join(', ') + ': ' + p.rationale];
            })) + '\nConnection inventory:\n\n' + table(['From', 'To', 'Connection'], diagram.edges.map(x => [x.from,x.to,x.description])) + '\nExternal endpoints:\n\n' + table(['ID', 'Name'], diagram.nodes.filter(n => n.external).map(n => [n.id,n.label]));
        } catch { body = 'Diagram unavailable: repair current quality findings. No unsafe or stale diagram is included.\n'; }
        break;
      }
      case 10: body = table(['Section', 'Technology / framework', 'Grounding / rationale'], accepted.flatMap(a => [
        ...(a.technologyChoices ?? []).map(t => [a.id,readable(t.technologyKey),a.grounding.map(g => g.source.id + ': ' + g.rationale).join('; ')]),
        ...(a.payload.kind === 'ArchitectureComponent' ? [[a.id,a.payload.catalogServiceKey,a.payload.rationale]] : []),
        ...(a.payload.kind === 'AIUseCase' ? [[a.id,readable(a.payload.modelOptions),readable(a.payload.frameworkRationale)]] : []),
      ])); break;
      case 11: body = render(part.sectionIds) + '\nCanonical delivery membership:\n\n' + table(['Unit', 'Type / source', 'Workstream', 'Inclusion / quantity', 'Complexity / basis'], accepted.flatMap(a => a.payload.kind === 'EstimationUnit' ? [[a.id,a.payload.unitType + ': ' + readable(a.payload.source),a.payload.workstreamId,readable(a.payload.inclusion) + ' / ' + readable(a.payload.quantity),readable(a.payload.complexity)]] : [])); break;
      case 12: body = summary ? estimate(summary, accepted) : 'Unavailable: no current accepted estimate.\n'; break;
      case 13: body = summary ? commercials(s, summary, accepted) : 'Unavailable: no current accepted commercial ledger.\n'; break;
      case 14: body = table(['ID', 'Assumption', 'Validation / review', 'Basis', 'Value / sources'], assumptions.map(a => [a.id,a.statement,a.validation + ' / ' + a.review,a.basis,readable(a.value) + '; ' + a.sources.map(x => x.documentId+'/'+x.sectionId).join(', ')])) + '\n' + render(part.sectionIds) + '\nEstimation configuration (reviewed assumptions; never market benchmarks):\n\n' + table(['Key', 'Value', 'Origin / validation', 'Basis'], Object.values(s.configuration.entries).sort((a,b) => a.key.localeCompare(b.key)).map(x => [x.key,x.kind === 'VALUE' ? readable(x.value) : readable(x.owner) + '.' + x.field,x.origin + ' / ' + x.validation,x.basis])); break;
      case 15: body = render(part.sectionIds) + '\nDelivery risks:\n\n' + list(accepted.flatMap(a => a.payload.kind === 'Workstream' ? a.payload.risks.map(r => a.id + ': '+r) : [])); break;
      case 16: body = render(part.sectionIds) + '\n' + table(['Item', 'Dependencies'], [...requirements.filter(r => r.dependencyIds.length).map(r => [r.id,r.dependencyIds]),...accepted.filter(a => a.dependencies?.length || a.payload.kind === 'Workstream').map(a => [a.id,a.payload.kind === 'Workstream' ? a.payload.predecessorRefs : a.dependencies])] ); break;
      case 17: body = table(['ID', 'Question', 'Criticality', 'State / review', 'Related items', 'Answer / basis'], questions.map(q => [q.id,q.question,q.criticality,q.status + ' / ' + q.review,q.related,q.answer ? q.answer.text + ': ' + q.answer.basis : 'UNRESOLVED — human input required'])) + '\n' + render(part.sectionIds); break;
      case 18: body = 'Eligible reviewed included requirements: ' + coverage.eligibleRequirementIds.length + '\n\n' + table(['Stage', 'Covered / eligible', 'Uncovered'], (['scope','design','delivery'] as const).map(k => [k,coverage.eligibleRequirementIds.length ? coverage[k].coveredIds.length + '/' + coverage.eligibleRequirementIds.length : 'N/A',coverage[k].uncoveredIds])) + '\nExcluded requirements:\n\n' + table(['ID','Reason'],coverage.excluded.map(r => [r.id,r.reason])); break;
      case 19: body = trace(s, accepted); break;
      case 20: {
        const change = s.controlledChange;
        if (!change) { body = 'No reviewed controlled change has occurred in this estimated session. N/A.\n'; break; }
        const impact = change.impact;
        body = 'Latest controlled change: ' + e(impact.changeId) + ' · evaluated through revision ' + change.evaluatedRevision + '\n\n' + table(['Changed item', 'Field', 'Before', 'After'], impact.change?.changes.flatMap(c => (c.fieldChanges ?? []).map(f => [readable(c.node),f.field,f.before.value,f.after.value])) ?? []) +
        '\nAffected areas (including potential transitive consumers):\n\n' + list([...impact.direct,...impact.transitive].map(n => readable(n))) +
        '\nUnaffected reviewed areas still byte-equivalent:\n\n' + list(impact.unaffectedReviewed.filter(a => s.artifactSections[a.id] && hash(s.artifactSections[a.id]) === a.hash).map(a => a.id + ': ' + s.artifactSections[a.id]!.title)) +
        '\nRegenerated / recalculated items with changed canonical payloads:\n\n' + list(change.updatedSectionIds.map(id => id + ': ' + (s.artifactSections[id]?.title ?? 'Retired'))) +
        '\nUnresolved stale items:\n\n' + list(Object.values(s.artifactSections).filter(a => a.lifecycle === 'ACTIVE' && a.freshness === 'STALE').map(a => a.id + ': ' + a.title)); break;
      }
      case 21: body = 'QualityGate: ' + gate.status + '\n\n' + e(gate.id + ' · revision ' + gate.evaluatedRevision + ' · rules ' + gate.ruleVersion) + '\n\n' +
        (acknowledged(s) ? 'Warnings acknowledged for this exact revision/findings at ' + gate.acknowledgment!.timestamp + '. Acknowledgment is not resolution.\n\n' : 'Warnings acknowledgment: ' + (gate.status === 'PASS' ? 'Not required.' : 'Not acknowledged.') + '\n\n') +
        (gate.issues.length ? table(['Severity / status','Finding','Related items','Human validation'],gate.issues.map(x => [x.severity+' / '+x.status,x.message,x.related,x.blocking ? 'Repair and rerun quality; export blocked.' : 'Qualified stakeholders must validate this unresolved item.'])) : 'No current deterministic findings.\n') +
        '\nA passing gate does not prove business, architecture or commercial correctness.\n'; break;
      case 22: body = DISCLAIMER + '\n'; break;
      default: body = render(part.sectionIds);
    }
    return { ...part, body };
  });
  const basis = composite.basis;
  const header = '# Integrated Scoping Package\n\n' + e(s.context.customerName + ' — ' + s.context.opportunityName) + '\n\nSession: ' + s.id + ' · domain revision ' + s.revision + '\n\nTemplate: ' + basis.templateVersion + ' · disclaimer: ' + basis.disclaimerVersion + '\n\nGate: ' + basis.gateId + ' · rules: ' + basis.gateRuleVersion + ' · findings SHA-256: ' + basis.findingsHash + '\n\nEstimation rules: ' + e(basis.estimationRuleSet.version) + '\n\nSection revisions: ' + e(basis.sectionRevisions.map(a => a.id + '@' + a.revision).join(', ')) + '\n\n';
  const markdown = header + sections.map(p => '## ' + p.title + '\n\n' + p.body.trimEnd() + '\n').join('\n');
  const fileHash = createHash('sha256').update(markdown, 'utf8').digest('hex');
  const snapshotHash = hash({ basis, fileHash, acknowledgment: gate.acknowledgment ?? null });
  return { basis, sections, markdown, snapshotHash, fileHash, filename: filename(s), gate, acknowledged: acknowledged(s), exportReady: gate.status === 'PASS' || gate.status === 'REVIEW_REQUIRED' && acknowledged(s) };
}
function estimate(p: EstimateSummary, accepted: ArtifactSection[]) {
  return table(['Metric','Authoritative result'], [['Effort',range(p.effort)],['Person weeks (presentation)',range(p.presentation?.personWeeks)],['Working timeline',range(p.workingDuration)],['Calendar timeline',range(p.calendarDuration)],['Calendar weeks (presentation)',range(p.presentation?.calendarWeeks)],['Start',p.startDate],['Finish',readable(p.finishDates)],['Deadline feasibility',p.deadlineFeasibility],['Confidence',p.confidence],['Metric confidence',readable(p.confidenceByMetric)],['Result status',p.resultStatus],['Known effort subtotal (not full total)',range(p.knownSubtotals?.effort)]]) +
    '\nRoles:\n\n' + table(['Role','Effort'],p.roleEffort.map(r => [r.roleId,range(r.effort)])) +
    '\nPhases and milestones:\n\n' + table(['Phase','Duration','Wait','Limiting roles','Finish / milestones'],p.phases.map(x => [x.key,range(x.duration),range(x.wait),x.limitingRoles,readable(x.finishDates) + '; ' + readable(x.milestones)])) +
    '\nLimitations:\n\n' + list([...new Set(p.limitations.map(x => x.reason))]) +
    '\nMissing inputs:\n\n' + table(['Input','Field','Reason'],p.missingInputs.map(x => [readable(x.node),x.field,x.reason])) +
    '\nCalculation basis: each canonical unit selects one reviewed baseline, complexity multiplier, productivity and role allocation. Phase duration pools role workloads and capacity.\n\n' +
    table(['Estimate / unit','Effort','Rules','Calculation steps'],accepted.flatMap(a => a.payload.kind === 'EstimateItem' ? [[a.id + ' / ' + a.payload.unitId,range(a.payload.effort),a.payload.ruleSet.version,a.payload.ledger.map(l => l.ruleStep + ': ' + readable(l.inputValues) + ' => ' + range(l.result)).join('; ')]] : []));
}
function commercials(s: ScopingSession, p: EstimateSummary, accepted: ArtifactSection[]) {
  const m = (r: Parameters<typeof money>[0]) => money(r,p.commercials.currency,p.commercials.minorUnitDigits);
  return table(['Metric','Ledger value'],[['Currency',p.commercials.currency],['Base',m(p.commercials.base)],['Contingency percent',resolveConfig(s,'contingencyPercent').value],['Contingency',m(p.commercials.contingency)],['ROM exact ledger',m(p.commercials.total)],['ROM outward headline',range(p.presentation?.rom)],['Known priced subtotal (not full ROM)',m(p.knownSubtotals?.total)],['Commercial confidence',p.confidenceByMetric.commercials]]) +
    '\nPer-unit commercials:\n\n' + table(['Estimate / unit','Base','Contingency','ROM'],accepted.flatMap(a => a.payload.kind === 'EstimateItem' ? [[a.id+' / '+a.payload.unitId,m(a.payload.commercials.base),m(a.payload.commercials.contingency),m(a.payload.commercials.total)]] : [])) +
    '\nRole pricing ledger:\n\n' + table(['Unit','Role','Rate (minor units/person-day)','Currency','Cost'],p.moneyLedger.map(x => [x.unitId,x.roleId,x.rate,x.currency,m(x.cost)])) +
    '\nBasis: role effort × reviewed role rate; per-unit outward minor-unit rounding; separately calculated contingency. No taxes, margin, travel, licenses, AI consumption or cloud operating costs are included. Unknown values remain unavailable; no FX conversion.\n';
}
function trace(s: ScopingSession, accepted: ArtifactSection[]) {
  const validIds = new Set(accepted.map(a => a.id)), delivery = estimationCoverage(s).filter(r => validIds.has(r.sourceId));
  const rows = Object.values(s.requirements).filter(r => r.lifecycle === 'ACTIVE').sort((a,b) => a.id.localeCompare(b.id)).map(r => {
    const linked = accepted.filter(a => a.grounding.some(g => g.source.kind === 'Requirement' && g.source.id === r.id));
    const source = r.evidence.map(a => a.documentId+'/'+a.sectionId+' ['+a.start+','+a.end+') '+a.relation+': '+a.excerpt).join('; ');
    const units = [...new Set(delivery.filter(x => linked.some(a => a.id === x.sourceId)).flatMap(x => x.unitIds))].filter(id => validIds.has(id)).sort();
    const streams = [...new Set(units.flatMap(id => { const p = s.artifactSections[id]?.payload; return p?.kind === 'EstimationUnit' ? [p.workstreamId] : []; }))].sort();
    return [r.id,r.origin,source,linked.filter(a => a.payload.kind === 'Capability' && a.payload.inclusion === 'INCLUDED').map(a => a.id),linked.filter(a => ['ArchitectureComponent','DataDomain','Integration','AIUseCase'].includes(a.payload.kind)).map(a => a.id),streams,units,r.assumptionIds,r.inclusion === 'EXCLUDED' ? 'EXCLUDED: '+r.exclusionReason : (['scope','design','delivery'] as const).map(k => k+': '+(s.gate!.coverage[k].coveredIds.includes(r.id) ? 'COVERED' : 'UNCOVERED')).join('; ')];
  });
  return table(['Requirement','Origin','Source / exact excerpt','Capability','Architecture / Data / Integration / AI','Workstream','EstimationUnit','Assumptions','Coverage'], rows) +
    '\nRecommendation rationale and assumption-only grounding:\n\n' + table(['Section','Origin','Grounding','Why'],accepted.flatMap(a => a.grounding.map(g => [a.id+' '+a.title,a.origin,g.source.kind+' '+g.source.id,g.rationale])));
}



