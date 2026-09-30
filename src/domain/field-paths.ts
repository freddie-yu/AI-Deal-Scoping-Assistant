// Explicitly registered substantive paths. Whole structured fields may be watched;
// nested paths are admitted only where their owning contract defines them.
const roots = new Set(['exists', 'membership', 'description', 'type', 'priority', 'origin', 'evidence', 'inclusion', 'lifecycle', 'dependencyIds', 'assumptionIds', 'questionIds', 'measures', 'technologyConstraints', 'statement', 'basis', 'sources', 'contextRefs', 'validation', 'value', 'question', 'criticality', 'related', 'status', 'answer', 'sectionIds', 'payload', 'grounding', 'inputs', 'technologyChoices', 'context', 'entries', 'version', 'hash']);
for (const field of ['exclusionReason', 'confirmation', 'text', 'title', 'inputKind', 'supersedesId', 'filename', 'documentId', 'ordinal', 'start', 'end', 'heading', 'page', 'line', 'sectionKey', 'templateVersion', 'activeSourceIds']) roots.add(field);
roots.add('owner'); roots.add('field');
roots.add('dependencies'); roots.add('applicability');
const payloadFields = new Set(['kind', 'topic', 'facts', 'paragraphs', 'referencedIds', 'affectedRefs', 'description', 'priority', 'inclusion', 'classification', 'requirementIds', 'module', 'package', 'exclusionReason', 'name', 'cloud', 'catalogServiceKey', 'purpose', 'rationale', 'tradeOffs', 'securityControls', 'connections', 'sources', 'ownership', 'ingestion', 'storageRefs', 'quality', 'governance', 'metadata', 'retention', 'privacy', 'security', 'analytics', 'recovery', 'flows', 'endpoints', 'pattern', 'dataDomainRefs', 'authentication', 'errors', 'retry', 'monitoring', 'synchronization', 'aiRequirementIds', 'deterministicAlternative', 'humanDecisions', 'modelOptions', 'frameworkRationale', 'retrieval', 'orchestration', 'prompts', 'outputManagement', 'evaluation', 'safety', 'feedback', 'humanReviewControls', 'phaseKey', 'phaseOrder', 'predecessorRefs', 'milestones', 'risks', 'exclusions', 'waitInput', 'displayGroups', 'unitType', 'workstreamId', 'source', 'quantity', 'drivers', 'complexity', 'baseEffortRef', 'productivityRef', 'roleAllocationRef', 'multiplierConfig', 'ruleSetRef', 'advisoryAIComplexity', 'unitId', 'ruleSet', 'roleEffort', 'effort', 'timeline', 'commercials', 'resultStatus', 'confidence', 'confidenceByMetric', 'limitations', 'missingInputs', 'ledger', 'moneyLedger', 'estimateIds', 'phases', 'workingDuration', 'calendarDuration', 'startDate', 'finishDates', 'deadlineFeasibility', 'sectionIds', 'renderingVersion', 'templateVersion', 'exportReceiptId']);
const nested = [
  /^context\.(customerName|opportunityName|analysisSectionIds)$/,
  /^answer\.(text|evidence|basis)$/,
  /^confirmation\.(note|evidence)$/,
  /^value\.(kind|state|value|unit|reason|questionIds)$/,
  /^measures\.(expectedUsers|concurrency|dataVolume|availability|responseTime)(\.(state|reason|questionIds|value(\.(value|unit))?))?$/,
  /^payload\.complexity\.(score|rationale|band(\.(state|value|reason|questionIds))?)$/,
  /^payload\.(inclusion|quantity)\.(state|value|reason|questionIds)$/,
  /^payload\.source\.(kind|sectionId|key|name|boundary|scopeRefs|unitId|sessionId)$/,
  /^payload\.drivers\.(policy|flags(\.[012](\.(key|inputs|derivation))?)?)$/,
  /^payload\.(effort|timeline|workingDuration|calendarDuration)\.(low|high|unit)$/,
  /^payload\.commercials\.(currency|minorUnitDigits|(base|contingency|total)(\.(low|high|unit))?)$/,
  /^payload\.confidenceByMetric\.(effort|timeline|commercials)$/,
  /^payload\.ruleSet\.(id|version|hash)$/,
  /^payload\.finishDates\.(low|high)$/,
  /^technologyConstraints\.\d+\.(key|target|strength|kind|values)$/,
  /^technologyChoices\.\d+\.(key|target|technologyKey(\.(state|value|reason|questionIds))?)$/,
  /^entries\.(cloud|deliveryDeadline|aiProviderPreference|currency|contingencyPercent|productivity|startDate|workingWeekdays|holidays|daysPerPersonWeek|effortRounding|calendarRounding|commercialRounding|calibration|supportedVolumeThreshold|contingencyReviewThreshold|expectedUsers|securityNeeds|baseEffort\.(DISCOVERY|APPLICATION|INTEGRATION|DATA|CLOUD|AI|SECURITY|TESTING|HANDOVER)|complexityMultipliers\.(LOW|MEDIUM|HIGH)|inventoryComplete\.(APPLICATION|INTEGRATION|DATA|CLOUD|AI|SECURITY)|(?:rates|capacity|roleAllocation|productivity|phaseMinimumDays|wait|integrationComplexity|scopeInclusion)\.[A-Za-z0-9_-]+)(\.(value|basis|origin|validation|owner|field))?$/,
];
export function isRegisteredFieldPath(path: string): boolean {
  if (roots.has(path)) return true;
  const parts = path.split('.');
  if (parts.length === 2 && parts[0] === 'payload' && payloadFields.has(parts[1]!)) return true;
  return nested.some(pattern => pattern.test(path));
}
