import type { Range } from '../domain/index.js';
import { R, range, outward, type ExactRange } from './arithmetic.js';
export function computeEffort(base: Range, multiplier: number, productivity: number, shares: Record<string, number>) {
  if (![base.low, base.high, multiplier, productivity].every(v => Number.isFinite(v) && v > 0) || base.low > base.high || base.unit !== 'person-days/unit') throw new Error('Invalid baseline, multiplier or productivity');
  if (!Object.values(shares).every(v => Number.isFinite(v) && v >= 0 && v <= 1) || Object.values(shares).reduce((s, v) => s.add(R(v)), R(0)).compare(R(1))) throw new Error('Role shares must sum exactly to one');
  const exact = { low: R(base.low).mul(R(multiplier)).div(R(productivity)), high: R(base.high).mul(R(multiplier)).div(R(productivity)) };
  const roles: Record<string, ExactRange> = {};
  for (const [role, share] of Object.entries(shares).sort()) if (share > 0) roles[role] = { low: exact.low.mul(R(share)), high: exact.high.mul(R(share)) };
  return { exact, effort: range(exact, 'person-days'), roles };
}
export function computeCommercials(roles: Record<string, ExactRange>, rates: Record<string, number>, percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Invalid contingency');
  const lines = Object.entries(roles).map(([roleId, days]) => {
    const rate = rates[roleId]; if (!rate || !Number.isSafeInteger(rate) || rate <= 0) throw new Error(`Invalid rate: ${roleId}`);
    return { roleId, rate, cost: { low: outward(days.low.mul(R(rate)), 'low'), high: outward(days.high.mul(R(rate)), 'high'), unit: 'minor-units' } };
  });
  const base = { low: lines.reduce((s, l) => s + l.cost.low, 0), high: lines.reduce((s, l) => s + l.cost.high, 0), unit: 'minor-units' };
  return { lines, base, ...computeContingency(base, percent) };
}
/** Apply contingency to already rounded canonical-unit base rows, without repricing labor. */
export function computeContingency(base: Range, percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Invalid contingency');
  const contingency = { low: outward(R(base.low).mul(R(percent)).div(R(100)), 'low'), high: outward(R(base.high).mul(R(percent)).div(R(100)), 'high'), unit: 'minor-units' };
  const total = { low: base.low + contingency.low, high: base.high + contingency.high, unit: 'minor-units' };
  if (![base.low, base.high, total.low, total.high].every(Number.isSafeInteger)) throw new Error('Money exceeds safe integer range');
  return { contingency, total };
}
