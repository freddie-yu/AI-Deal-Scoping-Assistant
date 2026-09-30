import { describe, expect, it } from 'vitest';
import { calculateSchedule, type ScheduleInput } from '../../src/estimation/schedule.js';
import { exactRange, R } from '../../src/estimation/arithmetic.js';
import { EstimateSummaryPayloadSchema } from '../../src/domain/estimation.js';

const days = (low: number, high = low) => ({ low, high, unit: 'working-days' });
const base = (): ScheduleInput => ({
  units: [{ unitId: 'AS_01', estimateId: 'AS_11', workstreamId: 'AS_21', roles: { E: exactRange(1, 3) } }],
  workstreams: [{ id: 'AS_21', phaseKey: 'build', phaseOrder: 1, predecessorRefs: [], milestones: [{ key: 'built', label: 'Built' }] }],
  capacities: { E: 1 }, phaseMinimums: { build: 0 }, waits: { build: days(0) },
  startDate: '2026-10-05', workingWeekdays: [1, 2, 3, 4, 5], holidays: [], deadline: null,
});

describe('pooled phase scheduling', () => {
  it('reproduces the documented six-phase schedule and inclusive calendar dates', () => {
    const input = base();
    const loads = [
      { A: [5, 8] }, { C: [9, 13.5] }, { A: [0.9, 1.5], C: [3.6, 6] },
      { A: [2.4, 3.6], E: [21.6, 32.4] }, { E: [10.8, 18], D: [2.7, 4.5] },
      { D: [6, 10.5] }, { D: [7.5, 12] }, { E: [2.7, 5.4], Q: [10.8, 21.6] }, { A: [1, 1.5], C: [1, 1.5] },
    ];
    const phases = [1, 2, 2, 3, 3, 3, 4, 5, 6];
    input.workstreams = loads.map((_, i) => ({ id: `AS_${20 + i}`, phaseKey: `p${phases[i]}`, phaseOrder: phases[i]!, predecessorRefs: [], milestones: [] }));
    input.units = loads.map((roles, i) => ({ unitId: `AS_${40 + i}`, estimateId: `AS_${60 + i}`, workstreamId: `AS_${20 + i}`, roles: Object.fromEntries(Object.entries(roles).map(([role, bounds]) => [role, exactRange(bounds![0]!, bounds![1]!)])) }));
    input.capacities = { A: 0.5, E: 2, D: 1, C: 1, Q: 1 };
    input.phaseMinimums = Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [`p${i}`, 2]));
    input.waits = Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [`p${i}`, days(0)]));
    const result = calculateSchedule(input);
    expect(result.phases.map(p => p.duration)).toEqual([days(10, 16), days(13, 20), days(17, 26), days(8, 12), days(11, 22), days(2, 3)]);
    expect(result.phases.map(p => p.limitingRoles)).toEqual([['A'], ['C'], ['E'], ['D'], ['Q'], ['A']]);
    expect(result.workingDuration).toEqual(days(61, 99));
    expect(result.finishDates).toEqual({ low: '2026-12-28', high: '2027-02-18' });
    expect(result.calendarDuration).toEqual({ low: 85, high: 137, unit: 'calendar-days' });
    expect(EstimateSummaryPayloadSchema.shape.phases.safeParse(result.phases).success).toBe(true);
  });

  it('pools same-role work before ceiling and preserves role concurrency', () => {
    const input = base();
    input.units[0]!.roles = { E: exactRange(0.1, 0.1), Q: exactRange(0.3, 0.3) };
    input.units.push({ unitId: 'AS_02', estimateId: 'AS_12', workstreamId: 'AS_21', roles: { E: exactRange(0.2, 0.2) } });
    input.capacities = { E: 0.3, Q: 0.3 };
    expect(calculateSchedule(input).workingDuration).toEqual(days(1));
    expect(calculateSchedule(input).phases[0]!.limitingRoles).toEqual(['E', 'Q']);
  });

  it('applies phase minima and one reviewed wait with finish milestones', () => {
    const input = base(); input.phaseMinimums.build = 5; input.waits.build = days(2, 4);
    const result = calculateSchedule(input);
    expect(result.executionSubtotal).toEqual(days(5));
    expect(result.phases[0]).toMatchObject({ startOffset: days(2, 4), finishOffset: days(7, 9), milestones: [{ key: 'built', label: 'Built', offset: days(7, 9) }] });
    expect(result.workingDuration).toEqual(days(7, 9));
  });

  it('skips inactive phases and ignores capacities for roles with no work', () => {
    const input = base(); input.units[0]!.roles!.unused = exactRange(0, 0);
    input.workstreams.push({ id: 'AS_22', phaseKey: 'empty', phaseOrder: 2, predecessorRefs: [], milestones: [] });
    const result = calculateSchedule(input);
    expect(result.phases).toHaveLength(1); expect(result.workingDuration).toEqual(days(1, 3)); expect(result.missing).toEqual([]);
  });

  it('keeps execution subtotal but suppresses all forecasts after an unknown wait', () => {
    const input = base(); input.waits.build = null;
    const result = calculateSchedule(input);
    expect(result.executionSubtotal).toEqual(days(1, 3)); expect(result.workingDuration).toBeNull(); expect(result.finishDates).toBeNull();
    expect(result.phases[0]!.finishOffset).toBeNull(); expect(result.missing).toContain('waits.build');
  });

  it('carries sequential phase barriers forward once, including uncertain waits', () => {
    const input = base();
    input.workstreams.push({ id: 'AS_22', phaseKey: 'test', phaseOrder: 2, predecessorRefs: ['AS_21'], milestones: [] });
    input.units.push({ unitId: 'AS_02', estimateId: 'AS_12', workstreamId: 'AS_22', roles: { E: exactRange(2, 4) } });
    input.phaseMinimums.test = 0; input.waits.test = days(2, 3);
    const result = calculateSchedule(input);
    expect(result.phases[1]).toMatchObject({ startOffset: days(3, 6), finishOffset: days(5, 10) });
    expect(result.executionSubtotal).toEqual(days(3, 7)); expect(result.workingDuration).toEqual(days(5, 10));
    input.waits.build = null;
    const unknown = calculateSchedule(input);
    expect(unknown.phases[1]).toMatchObject({ duration: days(2, 4), startOffset: null, finishOffset: null });
    expect(unknown.executionSubtotal).toEqual(days(3, 7)); expect(unknown.finishDates).toBeNull();
  });

  it.each([null, 0])('does not replace unavailable used-role capacity %s with a default', capacity => {
    const input = base(); input.capacities.E = capacity;
    const result = calculateSchedule(input);
    expect(result.workingDuration).toBeNull(); expect(result.phases[0]!.duration).toBeNull(); expect(result.missing).toContain('capacities.E');
  });

  it('preserves known execution phases separately when a later role allocation is unknown', () => {
    const input = base();
    input.workstreams.push({ id: 'AS_22', phaseKey: 'test', phaseOrder: 2, predecessorRefs: ['AS_21'], milestones: [] });
    input.units.push({ unitId: 'AS_02', estimateId: 'AS_12', workstreamId: 'AS_22', roles: null });
    input.phaseMinimums.test = 0; input.waits.test = days(0);
    const result = calculateSchedule(input);
    expect(result.executionSubtotal).toEqual(days(1, 3)); expect(result.workingDuration).toBeNull(); expect(result.missing).toContain('units.AS_02.roles');
  });

  it('requires an explicit minimum for an active phase', () => {
    const input = base(); input.phaseMinimums.build = null;
    const result = calculateSchedule(input); expect(result.workingDuration).toBeNull(); expect(result.missing).toContain('phaseMinimums.build');
  });

  it('returns zero durations and no finish date for empty scope without requiring calendar inputs', () => {
    const input = base(); input.units = []; input.startDate = null; input.workingWeekdays = null; input.holidays = null;
    const result = calculateSchedule(input);
    expect(result.workingDuration).toEqual(days(0)); expect(result.calendarDuration).toEqual({ low: 0, high: 0, unit: 'calendar-days' });
    expect(result.phases).toEqual([]); expect(result.finishDates).toBeNull(); expect(result.missing).toEqual([]);
  });

  it.each(['same-phase', 'backward', 'cycle', 'missing'] as const)('rejects %s predecessor dependencies', kind => {
    const input = base();
    input.workstreams.push({ id: 'AS_22', phaseKey: kind === 'same-phase' ? 'build' : 'test', phaseOrder: kind === 'same-phase' ? 1 : 2, predecessorRefs: kind === 'cycle' ? ['AS_21'] : [], milestones: [] });
    input.workstreams[0]!.predecessorRefs = [kind === 'missing' ? 'AS_99' : 'AS_22'];
    expect(() => calculateSchedule(input)).toThrow(/predecessor|dependenc|phase|cycle/i);
  });

  it.each(['unit', 'estimate', 'owner', 'phase-order'] as const)('rejects ambiguous %s identities', kind => {
    const input = base();
    if (kind === 'owner') input.units[0]!.workstreamId = 'AS_99';
    else if (kind === 'phase-order') input.workstreams.push({ ...input.workstreams[0]!, id: 'AS_22', phaseOrder: 2 });
    else input.units.push({ ...input.units[0]!, unitId: kind === 'unit' ? 'AS_01' : 'AS_02', estimateId: kind === 'unit' ? 'AS_12' : 'AS_11' });
    expect(() => calculateSchedule(input)).toThrow();
  });

  it.each([-1, Infinity, NaN])('rejects invalid capacity %s', value => {
    const input = base(); input.capacities.E = value; expect(() => calculateSchedule(input)).toThrow();
  });

  it.each([-1, 0.5, Infinity])('rejects invalid phase minimum %s', value => {
    const input = base(); input.phaseMinimums.build = value; expect(() => calculateSchedule(input)).toThrow();
  });

  it.each([days(-1), days(2, 1), days(0.5), { low: 1, high: 2, unit: 'calendar-days' }])('rejects invalid wait %j', wait => {
    const input = base(); input.waits.build = wait; expect(() => calculateSchedule(input)).toThrow();
  });

  it('rejects reversed and negative role loads', () => {
    const input = base(); input.units[0]!.roles = { E: { low: R(3), high: R(1) } };
    expect(() => calculateSchedule(input)).toThrow();
    input.units[0]!.roles = { E: exactRange(-1, 1) }; expect(() => calculateSchedule(input)).toThrow();
  });
});

describe('date-only calendars and deadlines', () => {
  it('counts start as day one and skips holidays and weekends', () => {
    const input = base(); input.startDate = '2026-10-09'; input.holidays = ['2026-10-12'];
    const result = calculateSchedule(input);
    expect(result.finishDates).toEqual({ low: '2026-10-09', high: '2026-10-14' });
    expect(result.calendarDuration).toEqual({ low: 1, high: 6, unit: 'calendar-days' });
  });

  it('supports custom working weeks over leap day', () => {
    const input = base(); input.startDate = '2028-02-27'; input.workingWeekdays = [7];
    expect(calculateSchedule(input).finishDates).toEqual({ low: '2028-02-27', high: '2028-03-12' });
  });

  it('rejects forecasts beyond ISO date limits without an unbounded day-by-day loop', () => {
    const input = base(); input.startDate = '9999-12-31'; input.workingWeekdays = [1, 2, 3, 4, 5, 6, 7];
    expect(() => calculateSchedule(input)).toThrow(/date range/i);
  });

  it.each(['startDate', 'workingWeekdays', 'holidays'] as const)('retains working duration when %s is unknown', field => {
    const input = base(); input[field] = null;
    const result = calculateSchedule(input);
    expect(result.workingDuration).toEqual(days(1, 3)); expect(result.finishDates).toBeNull(); expect(result.calendarDuration).toBeNull(); expect(result.missing).toContain(field);
  });

  it.each(['2026-02-30', '2026-10-10', '2026-10-05T00:00:00Z'])('rejects invalid or nonworking start %s', start => {
    const input = base(); input.startDate = start; expect(() => calculateSchedule(input)).toThrow();
  });

  it.each([{ weekdays: [] }, { weekdays: [0] }, { weekdays: [8] }, { weekdays: [1.5] }])('rejects invalid working-week configuration $weekdays', ({ weekdays }) => {
    const input = base(); input.workingWeekdays = weekdays; expect(() => calculateSchedule(input)).toThrow();
  });

  it('rejects invalid holiday and deadline dates and a holiday start', () => {
    const input = base(); input.holidays = ['2026-02-30']; expect(() => calculateSchedule(input)).toThrow();
    input.holidays = ['2026-10-05']; expect(() => calculateSchedule(input)).toThrow();
    input.holidays = []; input.deadline = '2026-13-01'; expect(() => calculateSchedule(input)).toThrow();
  });

  it.each([
    ['2026-10-04', 'INFEASIBLE'], ['2026-10-05', 'AT_RISK'], ['2026-10-06', 'AT_RISK'], ['2026-10-07', 'WITHIN_RANGE'], ['2026-10-08', 'WITHIN_RANGE'],
  ])('classifies deadline %s as %s without compressing work', (deadline, expected) => {
    const input = base(); input.deadline = deadline!;
    const result = calculateSchedule(input); expect(result.deadlineFeasibility).toBe(expected); expect(result.workingDuration).toEqual(days(1, 3));
  });

  it('distinguishes optional absence, required unknown deadline, and unavailable dates', () => {
    const input = base(); expect(calculateSchedule(input).deadlineFeasibility).toBe('NOT_APPLICABLE');
    input.deadlineRequired = true;
    expect(calculateSchedule(input).deadlineFeasibility).toBe('UNAVAILABLE'); expect(calculateSchedule(input).missing).toContain('deadline');
    input.deadline = '2026-10-08'; input.startDate = null;
    expect(calculateSchedule(input).deadlineFeasibility).toBe('UNAVAILABLE');
  });
});
