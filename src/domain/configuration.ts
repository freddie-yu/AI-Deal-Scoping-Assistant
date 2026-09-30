import { z } from 'zod';
import { ids, text, revision, OriginSchema, knowledge, computationalKnowledge, NodeRefSchema, FieldPathSchema, RangeSchema, ResourceSchema } from './primitives.js';
const entryBase = z.object({ key: text, revision, basis: text, origin: OriginSchema, validation: z.enum(['UNVALIDATED', 'VALIDATED']) }).strict();
export const configEntry = <T extends z.ZodType>(value: T, optional = false) => z.discriminatedUnion('kind', [
  entryBase.extend({ kind: z.literal('VALUE'), value: optional ? knowledge(value) : computationalKnowledge(value) }),
  entryBase.extend({ kind: z.literal('ALIAS'), owner: NodeRefSchema, field: FieldPathSchema }),
]);
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
function exactShareTotal(values: number[]) {
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0 || v > 1)) return false;
  const decimals = values.map(v => { const [mantissa, exponent = '0'] = String(v).split('e'); const [whole, fraction = ''] = mantissa!.split('.'); return { integer: BigInt(whole! + fraction), scale: fraction.length - Number(exponent) }; });
  const scale = Math.max(0, ...decimals.map(v => v.scale));
  return decimals.reduce((sum, v) => sum + v.integer * 10n ** BigInt(scale - v.scale), 0n) === 10n ** BigInt(scale);
}
const shares = z.record(text, z.number().finite().min(0).max(1)).refine(v => exactShareTotal(Object.values(v)), 'Role shares must total exactly one');
const valueSchemas = {
  cloud: z.literal('AWS'), deliveryDeadline: z.iso.date(), aiProviderPreference: text,
  currency: z.object({ code: z.string().regex(/^[A-Z]{3}$/), minorUnitDigits: z.number().int().min(0).max(4) }).strict(),
  contingencyPercent: z.number().finite().min(0).max(100), productivity: positive,
  startDate: z.iso.date(), workingWeekdays: z.array(z.number().int().min(1).max(7)).nonempty(), holidays: z.array(z.iso.date()),
  daysPerPersonWeek: positive, effortRounding: positive, calendarRounding: positive, commercialRounding: positive,
  calibration: z.object({ status: z.enum(['DEMO', 'CALIBRATED']), evidence: text }).strict(), supportedVolumeThreshold: z.number().int().positive(), contingencyReviewThreshold: z.number().min(0).max(100),
};
const rate = z.object({ amount: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/), unit: z.literal('minor-units/person-day') }).strict();
const entry = z.union([configEntry(z.boolean()), configEntry(z.number().finite()), configEntry(text, true), configEntry(RangeSchema), configEntry(shares), configEntry(rate), configEntry(valueSchemas.currency), configEntry(valueSchemas.calibration), configEntry(valueSchemas.workingWeekdays), configEntry(valueSchemas.holidays), configEntry(ResourceSchema)]);
export const ConfigurationSchema = z.object({ id: ids.Configuration, revision, entries: z.record(text, entry) }).strict().superRefine((v, ctx) => {
  for (const [key, item] of Object.entries(v.entries)) {
    let schema: z.ZodType | undefined = valueSchemas[key as keyof typeof valueSchemas];
    if (/^baseEffort\.(DISCOVERY|APPLICATION|INTEGRATION|DATA|CLOUD|AI|SECURITY|TESTING|HANDOVER)$/.test(key)) schema = RangeSchema.refine(r => r.low > 0 && r.unit === 'person-days/unit', 'Baseline must be unadjusted positive person-days/unit');
    if (/^complexityMultipliers\.(LOW|MEDIUM|HIGH)$/.test(key) || /^(productivity|rates)\.[A-Za-z0-9_-]+$/.test(key)) schema = positive;
    if (/^rates\./.test(key)) schema = z.object({ amount: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/), unit: z.literal('minor-units/person-day') }).strict();
    if (/^capacity\.[A-Za-z0-9_-]+$/.test(key)) schema = nonnegative;
    if (/^roleAllocation\.[A-Za-z0-9_-]+$/.test(key)) schema = shares;
    if (/^inventoryComplete\.(APPLICATION|INTEGRATION|DATA|CLOUD|AI|SECURITY)$/.test(key)) schema = z.boolean();
    if (/^drivers\.(AS_\d+|solution)\.[A-Za-z][A-Za-z0-9]*$/.test(key) || /^readiness\.AS_\d+$/.test(key)) schema = z.boolean();
    if (/^phaseMinimumDays\.[A-Za-z0-9_-]+$/.test(key)) schema = z.number().int().nonnegative();
    if (/^wait\.[A-Za-z0-9_-]+$/.test(key)) schema = RangeSchema.refine(r => r.unit === 'working-days' && Number.isInteger(r.low) && Number.isInteger(r.high));
    if (/^resources\.(RULESET|AWS_CATALOG|TECH_COMPATIBILITY|DOCUMENT_TEMPLATE)$/.test(key)) schema = ResourceSchema;
    const aliasOnly = /^(expectedUsers|securityNeeds|integrationComplexity\.[A-Za-z0-9_-]+|scopeInclusion\.[A-Za-z0-9_-]+)$/.test(key);
    if (key !== item.key || (!schema && !aliasOnly)) ctx.addIssue({ code: 'custom', path: ['entries', key], message: 'Unregistered or mismatched configuration key' });
    if (aliasOnly && item.kind !== 'ALIAS') ctx.addIssue({ code: 'custom', path: ['entries', key], message: 'This value belongs to its scope/assumption owner' });
    if (schema && item.kind === 'VALUE') {
      const checked = (key === 'deliveryDeadline' || key === 'aiProviderPreference' ? knowledge(schema) : computationalKnowledge(schema)).safeParse(item.value);
      if (!checked.success) ctx.addIssue({ code: 'custom', path: ['entries', key, 'value'], message: 'Invalid value/domain for configuration key' });
    }
    const visited = new Set([key]); let next = item;
    while (next.kind === 'ALIAS' && next.owner.kind === 'CONFIGURATION') {
      if (visited.has(next.owner.key)) { ctx.addIssue({ code: 'custom', path: ['entries', key], message: 'Configuration alias cycle' }); break; }
      visited.add(next.owner.key);
      const target = v.entries[next.owner.key];
      if (!target) { ctx.addIssue({ code: 'custom', path: ['entries', key], message: 'Missing alias target' }); break; }
      next = target;
    }
  }
});
export type Configuration = z.infer<typeof ConfigurationSchema>;
