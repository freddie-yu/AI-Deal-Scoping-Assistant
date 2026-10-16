import type { Range } from '../domain/index.js';
/** Escape all customer-controlled Markdown syntax and HTML, including table pipes. */
export function escapeText(value: unknown): string {
  return String(value ?? 'Unavailable').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*[\]{}()!#|~]/g, c => '&#' + c.charCodeAt(0) + ';')
    .replace(/\r\n|\r|\n/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}
export function readable(value: unknown): string {
  if (value === null || value === undefined) return 'Unavailable';
  if (Array.isArray(value)) return value.length ? value.map(readable).join('; ') : 'None';
  if (typeof value !== 'object') return String(value);
  const v = value as Record<string, unknown>;
  if (v.state === 'KNOWN') return readable(v.value);
  if (v.state === 'UNRESOLVED' || v.state === 'NOT_APPLICABLE') return v.state + ': ' + v.reason + (Array.isArray(v.questionIds) && v.questionIds.length ? ' [' + v.questionIds.join(', ') + ']' : '');
  if ('low' in v && 'high' in v) return v.low + '–' + v.high + (v.unit ? ' ' + v.unit : '');
  return Object.entries(v).map(([k,x]) => words(k) + ': ' + readable(x)).join('; ');
}
export const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
export const range = (r: Range | null | undefined) => r ? r.low + '–' + r.high + ' ' + r.unit : 'Unavailable';
export function money(r: Range | null | undefined, currency: string | null, digits: number | null): string {
  return r && currency && digits !== null ? currency + ' ' + (r.low / 10 ** digits).toFixed(digits) + '–' + (r.high / 10 ** digits).toFixed(digits) : 'Unavailable';
}
export function table(headers: string[], rows: unknown[][]): string {
  if (!rows.length) return 'None / not applicable to the current reviewed scope.\n';
  return [headers, headers.map(() => '---'), ...rows.map(r => r.map(readable))].map(row => '| ' + row.map(escapeText).join(' | ') + ' |').join('\n') + '\n';
}
export function filename(s: { id: string; context: { customerName: string; opportunityName: string } }): string {
  const clean = (v: string) => v.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 45);
  return 'scoping-' + (clean(s.context.customerName) || 'customer') + '-' + (clean(s.context.opportunityName) || 'opportunity') + '-' + s.id.replace(/[^a-z0-9-]/g, '') + '.md';
}


