import { expect, it } from 'vitest';
import { Rational, outward } from '../../src/estimation/arithmetic.js';
import { computeEffort, computeCommercials } from '../../src/estimation/math.js';

it('C1/C2 applies the selected configured multiplier exactly once', () => {
  for (const [m, low, high] of [[1.25, 5, 7.5], [1.75, 7, 10.5], [2.25, 9, 13.5]]) {
    const result = computeEffort({ low: 4, high: 6, unit: 'person-days/unit' }, m!, 1, { E: 1 });
    expect(result.effort).toEqual({ low, high, unit: 'person-days' });
  }
  expect(computeEffort({ low: 3, high: 5, unit: 'person-days/unit' }, 1.5, 1, { E: .8, D: .2 }).effort.low).toBe(4.5);
  expect(computeEffort({ low: 3, high: 5, unit: 'person-days/unit' }, 2, 1, { E: .8, D: .2 }).effort.high).toBe(10);
});
it('C3 prices unrounded allocated role days and applies contingency once', () => {
  const e = computeEffort({ low: 3, high: 5, unit: 'person-days/unit' }, 2, 1, { E: .8, D: .2 });
  expect(e.roles.E!.low.toNumber()).toBe(4.8);
  expect(e.roles.D!.high.toNumber()).toBe(2);
  const c = computeCommercials(e.roles, { E: 80000, D: 90000 }, 15);
  expect(c.base).toEqual({ low: 492000, high: 820000, unit: 'minor-units' });
  expect(c.contingency).toEqual({ low: 73800, high: 123000, unit: 'minor-units' });
  expect(c.total).toEqual({ low: 565800, high: 943000, unit: 'minor-units' });
});
it('U3 rounds per canonical unit; exact decimal inputs never become binary rounding errors', () => {
  const e = computeEffort({ low: 1, high: 1, unit: 'person-days/unit' }, 1, 1, { E: 1 });
  const c = computeCommercials(e.roles, { E: 1 }, 15);
  expect([c.total.low * 2, c.total.high * 2]).toEqual([2, 4]);
  expect(Rational.from(.1).add(Rational.from(.2)).toString()).toBe('3/10');
  expect(outward(Rational.from(1).div(Rational.from(3)), 'high')).toBe(1);
});
it('C4 rejects invalid input domains and shares not summing exactly to one', () => {
  for (const m of [0, -1, Infinity, NaN]) expect(() => computeEffort({ low: 3, high: 5, unit: 'person-days/unit' }, m, 1, { E: 1 })).toThrow();
  expect(() => computeEffort({ low: 5, high: 3, unit: 'person-days/unit' }, 1, 1, { E: 1 })).toThrow();
  expect(() => computeEffort({ low: 3, high: 5, unit: 'person-days/unit' }, 1, 1, { E: .9999999999 })).toThrow();
});
