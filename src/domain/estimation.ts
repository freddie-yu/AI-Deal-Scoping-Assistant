import { z } from 'zod';
import { text, ids, InputRefSchema, NodeRefSchema, computationalKnowledge, InclusionSchema, RangeSchema, ConfidenceSchema, TypedValueSchema, FieldPathSchema, counter } from './primitives.js';
export const UnitTypeSchema = z.enum(['DISCOVERY', 'APPLICATION', 'INTEGRATION', 'DATA', 'CLOUD', 'AI', 'SECURITY', 'TESTING', 'HANDOVER']);
export const ComplexityBandSchema = ConfidenceSchema;
export const UnitSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('DOMAIN'), sectionId: ids.ArtifactSection }).strict(),
  z.object({ kind: z.literal('MIGRATION_PACKAGE'), key: text, name: text, boundary: text, scopeRefs: z.array(ids.ArtifactSection).nonempty() }).strict(),
  z.object({ kind: z.literal('ENVIRONMENT'), key: text, name: text, boundary: text, scopeRefs: z.array(ids.ArtifactSection).nonempty() }).strict(),
  z.object({ kind: z.literal('TEST_TARGET'), unitId: ids.ArtifactSection }).strict(),
  z.object({ kind: z.literal('SOLUTION'), sessionId: ids.ScopingSession }).strict(),
]);
export const DriverRefSchema = z.object({ key: text, inputs: z.array(InputRefSchema).nonempty(), derivation: z.literal('ANY_INCLUDED_HIGH').optional() }).strict();
export const EstimationUnitPayloadSchema = z.object({
  kind: z.literal('EstimationUnit'), unitType: UnitTypeSchema, workstreamId: ids.ArtifactSection, source: UnitSourceSchema,
  inclusion: computationalKnowledge(InclusionSchema), exclusionReason: text.optional(), quantity: computationalKnowledge(z.union([z.literal(0), z.literal(1)])),
  drivers: z.discriminatedUnion('policy', [z.object({ policy: z.literal('THREE_FLAGS'), flags: z.tuple([DriverRefSchema, DriverRefSchema, DriverRefSchema]) }).strict(), z.object({ policy: z.literal('FIXED_LOW') }).strict()]),
  complexity: z.object({ score: z.number().int().min(0).max(3).nullable(), band: computationalKnowledge(ComplexityBandSchema), rationale: text }).strict(),
  baseEffortRef: InputRefSchema, productivityRef: InputRefSchema, roleAllocationRef: InputRefSchema, multiplierConfig: NodeRefSchema, ruleSetRef: InputRefSchema,
  advisoryAIComplexity: ComplexityBandSchema.optional(),
}).strict().superRefine((v, ctx) => {
  const permitted: Record<z.infer<typeof UnitTypeSchema>, string[]> = { APPLICATION: ['DOMAIN'], INTEGRATION: ['DOMAIN'], AI: ['DOMAIN'], DATA: ['MIGRATION_PACKAGE'], CLOUD: ['ENVIRONMENT'], SECURITY: ['SOLUTION'], DISCOVERY: ['SOLUTION'], HANDOVER: ['SOLUTION'], TESTING: ['TEST_TARGET', 'SOLUTION'] };
  if (!permitted[v.unitType].includes(v.source.kind)) ctx.addIssue({ code: 'custom', path: ['source'], message: 'Source kind does not match canonical unit type' });
  if (['DISCOVERY', 'HANDOVER'].includes(v.unitType) !== (v.drivers.policy === 'FIXED_LOW')) ctx.addIssue({ code: 'custom', path: ['drivers'], message: 'Only discovery/handover use fixed LOW policy' });
  if (v.inclusion.state === 'KNOWN' && v.inclusion.value === 'EXCLUDED' && !v.exclusionReason) ctx.addIssue({ code: 'custom', path: ['exclusionReason'], message: 'Exclusion requires a reason' });
  if (v.inclusion.state === 'KNOWN' && v.quantity.state === 'KNOWN' && v.quantity.value !== (v.inclusion.value === 'INCLUDED' ? 1 : 0)) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Canonical quantity must agree with inclusion' });
  if (v.inclusion.state === 'UNRESOLVED' && v.quantity.state === 'KNOWN') ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Unknown inclusion cannot have a known quantity' });
});
export const EffortRangeSchema = RangeSchema.refine(v => v.unit === 'person-days', 'Effort uses person-days');
export const WorkingDaysRangeSchema = RangeSchema.refine(v => v.unit === 'working-days' && Number.isInteger(v.low) && Number.isInteger(v.high), 'Schedule uses integer working days');
export const MoneyRangeSchema = RangeSchema.refine(v => v.unit === 'minor-units' && Number.isInteger(v.low) && Number.isInteger(v.high), 'Money uses integer minor units');
export const CalendarDaysRangeSchema = RangeSchema.refine(v => v.unit === 'calendar-days' && Number.isInteger(v.low) && Number.isInteger(v.high), 'Calendar duration uses integer calendar days');
const dateRange = z.object({ low: z.iso.date(), high: z.iso.date() }).strict();
export const CommercialsSchema = z.object({ currency: z.string().regex(/^[A-Z]{3}$/).nullable(), minorUnitDigits: z.number().int().min(0).max(4).nullable(), base: MoneyRangeSchema.nullable(), contingency: MoneyRangeSchema.nullable(), total: MoneyRangeSchema.nullable() }).strict();
const resultFields = {
  roleEffort: z.array(z.object({ roleId: text, effort: EffortRangeSchema.nullable() }).strict()),
  effort: EffortRangeSchema.nullable(), timeline: WorkingDaysRangeSchema.nullable(), commercials: CommercialsSchema,
  resultStatus: z.enum(['COMPLETE', 'PARTIAL', 'UNAVAILABLE']), confidence: ConfidenceSchema,
  confidenceByMetric: z.object({ effort: ConfidenceSchema, timeline: ConfidenceSchema, commercials: ConfidenceSchema }).strict(),
  limitations: z.array(z.object({ reason: text, related: z.array(NodeRefSchema) }).strict()),
  missingInputs: z.array(z.object({ node: NodeRefSchema, field: FieldPathSchema, reason: text }).strict()),
  ledger: z.array(z.object({ ruleStep: text, inputs: z.array(InputRefSchema), inputValues: z.array(TypedValueSchema), result: RangeSchema.nullable() }).strict()),
  moneyLedger: z.array(z.object({ unitId: ids.ArtifactSection, roleId: text, metric: z.enum(['BASE', 'CONTINGENCY', 'TOTAL']), rate: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/), cost: MoneyRangeSchema }).strict()),
  knownSubtotals: z.object({ effort: EffortRangeSchema, base: MoneyRangeSchema, contingency: MoneyRangeSchema, total: MoneyRangeSchema }).strict().optional(),
  exactEffort: z.object({ low: text, high: text }).strict().nullable().optional(),
  exactRoleEffort: z.record(text, z.object({ low: text, high: text }).strict()).optional(),
  presentation: z.object({ personWeeks: RangeSchema.nullable(), calendarWeeks: RangeSchema.nullable(), rom: RangeSchema.nullable() }).strict().optional(),
};
export const EstimatePayloadSchema = z.object({ unitId: ids.ArtifactSection, ruleSet: z.object({ id: text, version: text, hash: text }).strict(), ...resultFields }).strict();
export const EstimateItemPayloadSchema = EstimatePayloadSchema.extend({ kind: z.literal('EstimateItem') });
export const EstimateSummaryPayloadSchema = z.object({ kind: z.literal('EstimateSummary'), estimateIds: z.array(ids.ArtifactSection), ...resultFields,
  phases: z.array(z.object({ key: text, order: counter, estimateIds: z.array(ids.ArtifactSection), roleLoads: z.array(z.object({ roleId: text, effort: EffortRangeSchema.nullable() }).strict()), limitingRoles: z.array(text), duration: WorkingDaysRangeSchema.nullable(), wait: WorkingDaysRangeSchema.nullable(), startOffset: WorkingDaysRangeSchema.nullable(), finishOffset: WorkingDaysRangeSchema.nullable(), startDates: dateRange.nullable().optional(), finishDates: dateRange.nullable().optional(), milestones: z.array(z.object({ key: text, label: text, offset: WorkingDaysRangeSchema.nullable(), dates: dateRange.nullable().optional() }).strict()) }).strict()),
  workingDuration: WorkingDaysRangeSchema.nullable(), calendarDuration: CalendarDaysRangeSchema.nullable(), startDate: z.iso.date().nullable(), finishDates: z.object({ low: z.iso.date(), high: z.iso.date() }).strict().nullable(), deadlineFeasibility: z.enum(['INFEASIBLE', 'AT_RISK', 'WITHIN_RANGE', 'UNAVAILABLE', 'NOT_APPLICABLE']),
}).strict();
export type UnitType = z.infer<typeof UnitTypeSchema>;
export type ComplexityBand = z.infer<typeof ComplexityBandSchema>;
export type UnitSource = z.infer<typeof UnitSourceSchema>;
export type DriverRef = z.infer<typeof DriverRefSchema>;
export type EstimationUnitPayload = z.infer<typeof EstimationUnitPayloadSchema>;
export type EstimatePayload = z.infer<typeof EstimatePayloadSchema>;
export type EstimateItem = z.infer<typeof EstimateItemPayloadSchema>;
export type EstimateSummary = z.infer<typeof EstimateSummaryPayloadSchema>;
