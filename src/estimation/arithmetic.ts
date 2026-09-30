// Decimal inputs are interpreted as exact base-10 numbers. BigInts stay internal;
// ledgers retain the original inputs and exact fractions for reproduction.
export class Rational {
  readonly n: bigint; readonly d: bigint;
  constructor(n: bigint, d = 1n) {
    if (!d) throw new Error('Division by zero');
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b) { const r = a % b; a = b; b = r; }
    this.n = n / a; this.d = d / a;
  }
  static from(value: number | string): Rational {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Expected finite decimal');
    const s = String(value);
    if (s.includes('/')) { const [n, d] = s.split('/'); return new Rational(BigInt(n!), BigInt(d!)); }
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(s);
    if (!match) throw new Error('Expected decimal');
    const scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
    const n = BigInt(`${match[1]}${match[2]}${match[3] ?? ''}`);
    return scale >= 0 ? new Rational(n, 10n ** BigInt(scale)) : new Rational(n * 10n ** BigInt(-scale));
  }
  add(v: Rational) { return new Rational(this.n * v.d + v.n * this.d, this.d * v.d); }
  mul(v: Rational) { return new Rational(this.n * v.n, this.d * v.d); }
  div(v: Rational) { return new Rational(this.n * v.d, this.d * v.n); }
  compare(v: Rational) { const d = this.n * v.d - v.n * this.d; return d < 0n ? -1 : d > 0n ? 1 : 0; }
  toNumber() { const n = Number(this.n) / Number(this.d); if (!Number.isFinite(n)) throw new Error('Calculation exceeds finite range'); return n; }
  toString() { return `${this.n}/${this.d}`; }
}
export const R = Rational.from;
export function outward(value: Rational, bound: 'low' | 'high') {
  if (value.n < 0n) throw new Error('Expected nonnegative amount');
  const n = value.n / value.d + (bound === 'high' && value.n % value.d ? 1n : 0n);
  const result = Number(n);
  if (!Number.isSafeInteger(result)) throw new Error('Calculation exceeds safe integer range');
  return result;
}
export type ExactRange = { low: Rational; high: Rational };
export const exactRange = (low: number, high: number): ExactRange => ({ low: R(low), high: R(high) });
export const sumExact = (values: ExactRange[]): ExactRange => values.reduce((a, b) => ({ low: a.low.add(b.low), high: a.high.add(b.high) }), exactRange(0, 0));
export const range = (v: ExactRange, unit: string) => ({ low: v.low.toNumber(), high: v.high.toNumber(), unit });
export const headline = (v: ExactRange, quantum: number, unit: string) => ({ low: R(outward(v.low.div(R(quantum)), 'low')).mul(R(quantum)).toNumber(), high: R(outward(v.high.div(R(quantum)), 'high')).mul(R(quantum)).toNumber(), unit });
