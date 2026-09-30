// Maintainer helper: regenerate compact recorded MOCK fixtures and their manifests.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const scenarios = [
  { id: 'modernization', title: 'Atlas modernization', lines: ['Modernize Atlas to reduce manual order handling.', 'Operations staff need to create and track orders.', 'The database must remain PostgreSQL compatible.', 'Support 5,000 registered users.', 'Encrypt customer records at rest.'], types: ['BR', 'FR', 'DATA', 'NFR', 'SEC'], facts: [[0, 'existingApplication', 'Atlas'], [1, 'workflow', 'order tracking']], inferred: 'Validate imported orders before they enter the new workflow.', subject: 'concurrency', question: 'What peak concurrent user count must the modernized application support?', assumption: 'Operations staff can review a sample migration before rollout.', basis: 'Migration acceptance ownership was not stated; this is provisional for planning.' },
  { id: 'integration-heavy', title: 'Salesforce order synchronization', lines: ['Reduce duplicate customer entry across sales and fulfilment.', 'Existing CRM is Salesforce.', 'Synchronize approved orders with the warehouse API.', 'Retain failed synchronization records for operator review.'], types: ['BR', 'INT', 'INT', 'DATA'], facts: [[1, 'existingCRM', 'Salesforce'], [2, 'workflow', 'order synchronization']], inferred: 'Operators should be able to retry a failed synchronization.', subject: 'apiReadiness', question: 'Is a warehouse API sandbox and its access documentation available?', assumption: 'A named operations reviewer will validate synchronization outcomes.', basis: 'The owner of synchronization acceptance was not stated; confirmation is required.' },
  { id: 'ai-enabled', title: 'Support reply assistant', lines: ['Help support agents draft replies from approved knowledge articles.', 'A support agent must approve every reply before it is sent.', 'Customer identifiers must be removed from AI input.', 'Keep an audit trail of approved and rejected drafts.'], types: ['BR', 'FR', 'SEC', 'DATA'], facts: [[0, 'aiObjective', 'support reply drafting'], [1, 'workflow', 'human reply approval']], inferred: 'Collect reviewer feedback to assess draft usefulness.', subject: 'dataVolume', question: 'How many approved knowledge articles are available and who owns them?', assumption: 'Support leads can supply representative evaluation examples.', basis: 'Evaluation examples and their ownership were not stated; this remains a planning assumption.' },
  { id: 'missing-information', title: 'Discovery with open gaps', lines: ['Build a customer self-service portal.', 'Customers need to view invoices from our billing API.', 'The portal must protect customer information.'], types: ['BR', 'INT', 'SEC'], facts: [[0, 'workflow', 'customer self-service']], inferred: 'Confirm portal capacity before selecting an implementation.', subject: 'concurrency', question: 'What peak concurrency must the portal support?', assumption: 'A customer representative can attend discovery to resolve open facts.', basis: 'Discovery availability was not stated; no capacity, rate or API readiness is assumed.' },
];
for (const s of scenarios) {
  const input = { title: s.title, inputKind: 'PASTED_MARKDOWN', text: `# ${s.title}\n${s.lines.join('\n')}\n` };
  const fingerprint = createHash('sha256').update(input.text).digest('hex');
  const cite = (line, relation = 'DIRECT') => ({ sectionOrdinal: line + 1, excerpt: s.lines[line], relation });
  const requirements = s.lines.map((description, i) => ({ type: s.types[i], description, priority: i === 0 ? 'HIGH' : 'MEDIUM', origin: 'CUSTOMER_STATED', basis: 'Exact customer statement.', evidence: [cite(i)], dependencyRefs: [], assumptionRefs: [], questionRefs: [] }));
  const inferredIndex = requirements.length;
  requirements.push({ type: s.subject === 'concurrency' ? 'NFR' : 'FR', description: s.inferred, priority: 'MEDIUM', origin: 'AI_INFERRED', basis: `Interpretation of the ${s.title} objective; the proposed detail was not explicitly stated.`, evidence: [cite(0, 'CONTEXT')], dependencyRefs: [0], assumptionRefs: [0], questionRefs: [0], ...(s.subject === 'concurrency' ? { measures: { concurrency: { state: 'UNRESOLVED', reason: 'Peak concurrency was not stated.', questionRefs: [0] } } } : {}) });
  if (s.id === 'modernization') {
    requirements[2].technologyConstraints = [{ key: 'postgresql', target: 'DATABASE', strength: 'MUST', kind: 'DATABASE_COMPATIBILITY', values: ['postgresql'] }];
    requirements[3].measures = { expectedUsers: { state: 'KNOWN', value: { value: 5000, unit: 'registered users' } } };
  }
  const assumptions = [{ statement: s.assumption, basis: s.basis, sources: [cite(0, 'CONTEXT')], requirementRefs: [inferredIndex], validation: 'PROVISIONAL' }];
  const questions = [{ question: s.question, criticality: 'HIGH', subject: s.subject, basis: `${s.subject} was not stated in the customer input.`, sources: [cite(0, 'CONTEXT')], requirementRefs: [inferredIndex], assumptionRefs: [0] }];
  if (s.id === 'missing-information') {
    for (const [subject, question] of [['apiReadiness', 'Is the billing API documented and accessible?'], ['rate', 'What role rates and currency are approved for planning?']]) {
      requirements[inferredIndex].questionRefs.push(questions.length);
      questions.push({ question, criticality: 'HIGH', subject, basis: `${subject} was not stated; no value is assumed.`, sources: [cite(1, 'CONTEXT')], requirementRefs: [inferredIndex], assumptionRefs: [] });
    }
    requirements.push({ type: 'FR', description: 'Include a discovery review with the customer representative.', priority: 'LOW', origin: 'ASSUMED', basis: s.basis, evidence: [cite(0, 'CONTEXT')], dependencyRefs: [0], assumptionRefs: [0], questionRefs: [] });
  }
  const context = [
    { topic: 'OBJECTIVES', text: s.lines[0], origin: 'CUSTOMER_STATED', sources: [cite(0)], requirementRefs: [0], facts: [] },
    ...s.facts.map(([i, subject, value]) => ({ topic: subject.startsWith('existing') ? 'SYSTEMS' : 'PERSONAS', text: s.lines[i], origin: 'CUSTOMER_STATED', sources: [cite(i)], requirementRefs: [i], facts: [{ subject, value, requirementRefs: [i] }] })),
    { topic: 'MISSING_INFORMATION', text: questions.map(q => q.basis).join(' '), origin: 'AI_INFERRED', sources: [cite(0, 'CONTEXT')], requirementRefs: [inferredIndex], facts: [] },
    { topic: 'RISKS', text: `Unresolved ${s.subject} may change scope; seek customer validation.`, origin: 'AI_INFERRED', sources: [cite(0, 'CONTEXT')], requirementRefs: [inferredIndex], facts: [] },
  ];
  const expectation = (selector, description, expectedValue, origin, relatedAliases) => ({ selector, description, ...(expectedValue === undefined ? {} : { expectedValue }), ...(origin ? { origin } : {}), relatedAliases });
  const goldens = {
    mustExtract: s.facts.map(([, subject, value]) => expectation('payload.facts', subject, value, undefined, [subject])),
    mustClassify: s.facts.map(([, subject, value]) => expectation('payload.facts', subject, value, 'CUSTOMER_STATED', [subject])),
    mustIdentifyMissing: [expectation(s.subject === 'concurrency' ? 'measures.concurrency' : 'question', s.subject, undefined, undefined, [s.subject])],
    mustNotInvent: [expectation('measures.concurrency', 'concurrency', undefined, undefined, ['concurrency']), ...(s.id === 'integration-heavy' ? [expectation('payload.facts', 'existingCRM', 'HubSpot', undefined, ['existingCRM'])] : [])],
    expectedCapabilities: [], expectedRecommendationConstraints: [], emptyReasons: { expectedCapabilities: 'Connected capabilities belong to Phase 2.', expectedRecommendationConstraints: 'Architecture and AI strategy recommendations belong to Phase 2.' },
  };
  const manifest = { id: s.id, version: '1', phase: 'SCOPE', title: s.title, description: 'Recorded Phase 1 analysis with exact evidence and explicit uncertainty.', context: { customerName: 'Example customer', opportunityName: s.title, analysisSectionIds: [] }, input, mockResponses: [{ operation: 'analyze', variant: 'scope', fixture: 'mock-analysis.json' }], semanticGoldenExpectations: goldens };
  // Preserve the separately maintained Phase 2 expectations and operation inventory.
  const previous = JSON.parse(await readFile(`seeds/${s.id}/manifest.json`, 'utf8').catch(() => '{}'));
  if (previous.phase2Expectations) {
    manifest.phase2Expectations = previous.phase2Expectations;
    manifest.mockResponses = previous.mockResponses;
    goldens.expectedCapabilities = previous.semanticGoldenExpectations.expectedCapabilities;
    goldens.expectedRecommendationConstraints = previous.semanticGoldenExpectations.expectedRecommendationConstraints;
    goldens.emptyReasons = {};
  }
  await writeFile(`seeds/${s.id}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(`seeds/${s.id}/mock-analysis.json`, JSON.stringify({ fingerprint, analysis: { kind: 'Analysis', requirements, assumptions, questions, context } }, null, 2) + '\n');
}
