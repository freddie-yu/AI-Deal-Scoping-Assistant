import type { Range } from '../domain/primitives.js';
import { exactRange, outward, R, range, sumExact, type ExactRange } from './arithmetic.js';

export interface ScheduleUnit {
  unitId: string;
  estimateId: string;
  workstreamId: string;
  roles: Record<string, ExactRange> | null;
}
export interface ScheduleWorkstream {
  id: string;
  phaseKey: string;
  phaseOrder: number;
  predecessorRefs: string[];
  milestones: { key: string; label: string }[];
}
export interface ScheduleInput {
  units: ScheduleUnit[];
  workstreams: ScheduleWorkstream[];
  capacities: Record<string, number | null>;
  phaseMinimums: Record<string, number | null>;
  waits: Record<string, Range | null>;
  startDate: string | null;
  workingWeekdays: number[] | null;
  holidays: string[] | null;
  deadline: string | null;
  deadlineRequired?: boolean;
}
export interface SchedulePhase {
  key: string;
  order: number;
  estimateIds: string[];
  roleLoads: { roleId: string; effort: Range | null }[];
  limitingRoles: string[];
  duration: Range | null;
  wait: Range | null;
  startOffset: Range | null;
  finishOffset: Range | null;
  startDates?: { low: string; high: string } | null;
  finishDates?: { low: string; high: string } | null;
  milestones: { key: string; label: string; offset: Range | null; dates?: { low: string; high: string } | null }[];
}
export interface ScheduleResult {
  phases: SchedulePhase[];
  workingDuration: Range | null;
  /** Sum of available phase execution durations, excluding all waits. */
  executionSubtotal: Range | null;
  calendarDuration: Range | null;
  startDate: string | null;
  finishDates: { low: string; high: string } | null;
  deadlineFeasibility: 'INFEASIBLE' | 'AT_RISK' | 'WITHIN_RANGE' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
  missing: string[];
  limitations: string[];
}

const working = (low: number, high = low): Range => ({ low, high, unit: 'working-days' });
function integer(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`);
}
function add(a: Range, b: Range): Range {
  const result = working(a.low + b.low, a.high + b.high);
  integer(result.low, 'Schedule offset'); integer(result.high, 'Schedule offset');
  return result;
}
const DAY = 86_400_000;
function ordinal(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid ISO date: ${value}`);
  return date.getTime() / DAY;
}
const iso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const weekday = (day: number) => ((day + 3) % 7 + 7) % 7 + 1;

/** Bounded search over ISO date ordinals; no local dates or elapsed-hour arithmetic. */
function finishDay(start: number, count: number, weekdays: Set<number>, holidays: number[]): number {
  const last = ordinal('9999-12-31');
  const countThrough = (end: number) => {
    const length = end - start + 1;
    let total = Math.floor(length / 7) * weekdays.size;
    for (let i = 0; i < length % 7; i++) if (weekdays.has(weekday(start + i))) total++;
    for (const holiday of holidays) if (holiday >= start && holiday <= end && weekdays.has(weekday(holiday))) total--;
    return total;
  };
  if (count < 1 || countThrough(last) < count) throw new Error('Schedule finish exceeds supported ISO date range');
  let low = start, high = last;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (countThrough(middle) >= count) high = middle; else low = middle + 1;
  }
  return low;
}

export function calculateSchedule(input: ScheduleInput): ScheduleResult {
  const missing = new Set<string>();
  const workstreams = new Map<string, ScheduleWorkstream>();
  const phaseOrders = new Map<string, number>();
  const orderKeys = new Map<number, string>();
  for (const stream of input.workstreams) {
    if (workstreams.has(stream.id)) throw new Error(`Duplicate workstream owner: ${stream.id}`);
    integer(stream.phaseOrder, 'Phase order');
    if (phaseOrders.has(stream.phaseKey) && phaseOrders.get(stream.phaseKey) !== stream.phaseOrder) throw new Error('Conflicting order for phase');
    if (orderKeys.has(stream.phaseOrder) && orderKeys.get(stream.phaseOrder) !== stream.phaseKey) throw new Error('Distinct phases require distinct phase orders');
    workstreams.set(stream.id, stream); phaseOrders.set(stream.phaseKey, stream.phaseOrder); orderKeys.set(stream.phaseOrder, stream.phaseKey);
  }
  for (const stream of input.workstreams) for (const ref of stream.predecessorRefs) {
    const predecessor = workstreams.get(ref);
    if (!predecessor) throw new Error(`Missing predecessor: ${ref}`);
    if (predecessor.phaseOrder >= stream.phaseOrder) throw new Error(`Same-phase, backward or cyclic predecessor dependency: ${ref} -> ${stream.id}`);
  }
  for (const [role, capacity] of Object.entries(input.capacities)) if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) throw new Error(`Invalid capacity: ${role}`);
  for (const [key, minimum] of Object.entries(input.phaseMinimums)) if (minimum !== null) integer(minimum, `Phase minimum ${key}`);
  for (const [key, wait] of Object.entries(input.waits)) if (wait !== null) {
    integer(wait.low, `Wait ${key}`); integer(wait.high, `Wait ${key}`);
    if (wait.low > wait.high || wait.unit !== 'working-days') throw new Error(`Invalid wait range: ${key}`);
  }
  const start = input.startDate === null ? null : ordinal(input.startDate);
  const deadline = input.deadline === null ? null : ordinal(input.deadline);
  const holidays = input.holidays === null ? null : [...new Set(input.holidays.map(ordinal))];
  const weekdays = input.workingWeekdays === null ? null : new Set(input.workingWeekdays);
  if (weekdays && (!weekdays.size || [...weekdays].some(d => !Number.isInteger(d) || d < 1 || d > 7))) throw new Error('Invalid working weekdays');
  if (start !== null && ((weekdays && !weekdays.has(weekday(start))) || holidays?.includes(start))) throw new Error('Start date must be a working date');

  const grouped = new Map<string, ScheduleUnit[]>();
  const unitIds = new Set<string>(), estimateIds = new Set<string>();
  for (const unit of input.units) {
    if (unitIds.has(unit.unitId)) throw new Error(`Duplicate canonical unit: ${unit.unitId}`);
    if (estimateIds.has(unit.estimateId)) throw new Error(`Duplicate current estimate: ${unit.estimateId}`);
    unitIds.add(unit.unitId); estimateIds.add(unit.estimateId);
    const owner = workstreams.get(unit.workstreamId);
    if (!owner) throw new Error(`Missing workstream owner for ${unit.unitId}`);
    if (unit.roles) {
      for (const role of Object.values(unit.roles)) if (role.low.compare(R(0)) < 0 || role.low.compare(role.high) > 0) throw new Error(`Invalid role effort for ${unit.unitId}`);
      if (!Object.values(unit.roles).some(role => role.high.compare(R(0)) > 0)) continue;
    }
    const group = grouped.get(owner.phaseKey) ?? [];
    group.push(unit); grouped.set(owner.phaseKey, group);
  }

  const phases: SchedulePhase[] = [];
  let previous: Range | null = working(0), executionSubtotal = working(0);
  for (const [key, members] of [...grouped.entries()].sort(([a], [b]) => phaseOrders.get(a)! - phaseOrders.get(b)!)) {
    members.sort((a, b) => a.unitId.localeCompare(b.unitId));
    const roleTotals = new Map<string, ExactRange>();
    let complete = true;
    for (const member of members) {
      if (member.roles === null) { missing.add(`units.${member.unitId}.roles`); complete = false; continue; }
      for (const [role, effort] of Object.entries(member.roles)) if (effort.high.compare(R(0)) > 0) roleTotals.set(role, sumExact([roleTotals.get(role) ?? exactRange(0, 0), effort]));
    }
    const rolesKnown = complete;
    const minimum = input.phaseMinimums[key];
    if (minimum == null) { missing.add(`phaseMinimums.${key}`); complete = false; }
    const ratios = new Map<string, ExactRange>();
    for (const [role, effort] of roleTotals) {
      const capacity = input.capacities[role];
      if (capacity == null || capacity === 0) { missing.add(`capacities.${role}`); complete = false; }
      else ratios.set(role, { low: effort.low.div(R(capacity)), high: effort.high.div(R(capacity)) });
    }
    let duration: Range | null = null;
    const limiting = new Set<string>();
    if (complete) {
      const maxima = exactRange(minimum!, minimum!);
      for (const bound of ['low', 'high'] as const) {
        for (const ratio of ratios.values()) if (ratio[bound].compare(maxima[bound]) > 0) maxima[bound] = ratio[bound];
        for (const [role, ratio] of ratios) if (ratio[bound].compare(R(0)) > 0 && ratio[bound].compare(maxima[bound]) === 0) limiting.add(role);
      }
      duration = working(outward(maxima.low, 'high'), outward(maxima.high, 'high'));
      executionSubtotal = add(executionSubtotal, duration);
    }
    const wait = input.waits[key] ?? null;
    if (wait === null) missing.add(`waits.${key}`);
    const startOffset: Range | null = previous && wait ? add(previous, wait) : null;
    const finishOffset: Range | null = startOffset && duration ? add(startOffset, duration) : null;
    const milestoneLabels = new Map<string, string>();
    for (const stream of input.workstreams.filter(s => s.phaseKey === key)) for (const milestone of stream.milestones) {
      if (milestoneLabels.has(milestone.key) && milestoneLabels.get(milestone.key) !== milestone.label) throw new Error(`Conflicting milestone: ${milestone.key}`);
      milestoneLabels.set(milestone.key, milestone.label);
    }
    phases.push({ key, order: phaseOrders.get(key)!, estimateIds: members.map(m => m.estimateId), roleLoads: [...roleTotals].sort(([a], [b]) => a.localeCompare(b)).map(([roleId, effort]) => ({ roleId, effort: rolesKnown ? range(effort, 'person-days') : null })), limitingRoles: [...limiting].sort(), duration, wait: wait && { ...wait }, startOffset, finishOffset, milestones: [...milestoneLabels].sort(([a], [b]) => a.localeCompare(b)).map(([milestoneKey, label]) => ({ key: milestoneKey, label, offset: finishOffset && { ...finishOffset } })) });
    previous = finishOffset;
  }

  let finishDates: ScheduleResult['finishDates'] = null;
  let calendarDuration: Range | null = phases.length ? null : { low: 0, high: 0, unit: 'calendar-days' };
  if (phases.length) {
    if (start === null) missing.add('startDate');
    if (weekdays === null) missing.add('workingWeekdays');
    if (holidays === null) missing.add('holidays');
    if (previous && start !== null && weekdays && holidays) {
      const low = finishDay(start, previous.low, weekdays, holidays), high = finishDay(start, previous.high, weekdays, holidays);
      finishDates = { low: iso(low), high: iso(high) };
      calendarDuration = { low: low - start + 1, high: high - start + 1, unit: 'calendar-days' };
    }
  }
  let deadlineFeasibility: ScheduleResult['deadlineFeasibility'] = 'NOT_APPLICABLE';
  for (const phase of phases) {
    const dates = (offset: Range | null, firstDay: boolean) => offset && start !== null && weekdays && holidays && (firstDay || offset.low > 0) ? { low: iso(finishDay(start, offset.low + (firstDay ? 1 : 0), weekdays, holidays)), high: iso(finishDay(start, offset.high + (firstDay ? 1 : 0), weekdays, holidays)) } : null;
    phase.startDates = dates(phase.startOffset, true); phase.finishDates = dates(phase.finishOffset, false);
    for (const milestone of phase.milestones) milestone.dates = dates(milestone.offset, false);
  }
  if (deadline !== null) deadlineFeasibility = !finishDates ? 'UNAVAILABLE' : deadline < ordinal(finishDates.low) ? 'INFEASIBLE' : deadline < ordinal(finishDates.high) ? 'AT_RISK' : 'WITHIN_RANGE';
  else if (input.deadlineRequired) { missing.add('deadline'); deadlineFeasibility = 'UNAVAILABLE'; }
  const limitations = phases.length ? ['Sequential phases assume divisible work within each phase and no unmodeled intra-phase handoffs.'] : [];
  if (previous === null) limitations.push('The execution subtotal includes only known phase execution durations; it is not a finish-date forecast.');
  return { phases, workingDuration: previous, executionSubtotal, calendarDuration, startDate: input.startDate, finishDates, deadlineFeasibility, missing: [...missing].sort(), limitations };
}
