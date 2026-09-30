import { describe, expect, it } from 'vitest';
import { evaluateConfidence, minimumConfidence, type ConfidenceInput } from '../../src/estimation/confidence.js';

const baseline = (): ConfidenceInput => ({
  availability: { effort: true, timeline: true, commercials: true },
  signals: [], calibrated: true, interfaceCount: 3, calibrationLimit: 20,
  contingencyPercent: 15, contingencyReviewThreshold: 50, deadlineFeasibility: 'NOT_APPLICABLE',
});

describe('ordered confidence rules (§8)', () => {
  it('keeps fully calibrated, available outputs HIGH without limitations', () => {
    expect(evaluateConfidence(baseline())).toEqual({
      confidenceByMetric: { effort: 'HIGH', timeline: 'HIGH', commercials: 'HIGH' }, confidence: 'HIGH', limitations: [],
    });
  });

  it.each([
    ['Critical question remains open', 'LOW'],
    ['Assumptions conflict', 'LOW'],
    ['External readiness is unconfirmed', 'LOW'],
    ['Security needs are materially unknown', 'LOW'],
    ['Scale is materially unknown', 'LOW'],
    ['Data volume is materially unknown', 'LOW'],
    ['Noncritical question remains open', 'MEDIUM'],
    ['Assumption remains provisional', 'MEDIUM'],
  ] as const)('applies consumed signal: %s', (reason, severity) => {
    const input = baseline();
    const related = [{ kind: 'Question', id: 'Q_01' }] as const;
    input.signals = [{ reason, severity, related: [...related], metrics: ['effort', 'timeline', 'commercials'] }];
    const result = evaluateConfidence(input);
    expect(result.confidenceByMetric).toEqual({ effort: severity, timeline: severity, commercials: severity });
    expect(result.confidence).toBe(severity);
    expect(result.limitations).toContainEqual({ reason, related });
  });

  it('does not average away LOW when later MEDIUM signals apply', () => {
    const input = baseline();
    input.signals = [
      { reason: 'Readiness unknown', related: [], severity: 'LOW', metrics: ['timeline'] },
      { reason: 'Provisional assumption', related: [], severity: 'MEDIUM', metrics: ['effort', 'timeline'] },
    ];
    expect(evaluateConfidence(input).confidenceByMetric).toEqual({ effort: 'MEDIUM', timeline: 'LOW', commercials: 'HIGH' });
    expect(evaluateConfidence(input).confidence).toBe('LOW');
    expect(evaluateConfidence(input).limitations).toHaveLength(2);
  });

  it('ignores signals with no included metric consumers', () => {
    const input = baseline();
    input.signals = [{ reason: 'Excluded scope', related: [], severity: 'LOW', metrics: [] }];
    expect(evaluateConfidence(input)).toEqual(evaluateConfidence(baseline()));
  });

  it('keeps approved demo baselines MEDIUM without calibration evidence', () => {
    const result = evaluateConfidence({ ...baseline(), calibrated: false });
    expect(result.confidenceByMetric).toEqual({ effort: 'MEDIUM', timeline: 'MEDIUM', commercials: 'MEDIUM' });
    expect(result.confidence).toBe('MEDIUM');
    expect(result.limitations).toContainEqual(expect.objectContaining({ related: [{ kind: 'CONFIGURATION', id: 'CFG_01', key: 'calibration' }] }));
  });

  it.each(['INFEASIBLE', 'AT_RISK', 'UNAVAILABLE'] as const)('lowers only timeline for requested deadline %s', deadlineFeasibility => {
    const result = evaluateConfidence({ ...baseline(), deadlineFeasibility });
    expect(result.confidenceByMetric).toEqual({ effort: 'HIGH', timeline: 'LOW', commercials: 'HIGH' });
    expect(result.confidence).toBe('LOW');
    expect(result.limitations).toContainEqual(expect.objectContaining({ related: [{ kind: 'CONFIGURATION', id: 'CFG_01', key: 'deliveryDeadline' }] }));
  });

  it.each(['NOT_APPLICABLE', 'WITHIN_RANGE'] as const)('does not penalize deadline %s', deadlineFeasibility => {
    expect(evaluateConfidence({ ...baseline(), deadlineFeasibility }).confidence).toBe('HIGH');
  });

  it.each(['effort', 'timeline', 'commercials'] as const)('unavailable %s only degrades its own metric', metric => {
    const input = baseline();
    input.availability[metric] = false;
    const expected = { effort: 'HIGH', timeline: 'HIGH', commercials: 'HIGH', [metric]: 'LOW' };
    const result = evaluateConfidence(input);
    expect(result.confidenceByMetric).toEqual(expected);
    expect(result.confidence).toBe('LOW');
    expect(result.limitations).toHaveLength(1);
  });

  it('missing rate preserves calibrated effort and timeline confidence', () => {
    const input = baseline();
    input.availability.commercials = false;
    input.signals = [{ reason: 'Rate unavailable', related: [{ kind: 'CONFIGURATION', id: 'CFG_01', key: 'rates.E' }], severity: 'LOW', metrics: ['commercials'] }];
    const result = evaluateConfidence(input);
    expect(result.confidenceByMetric).toEqual({ effort: 'HIGH', timeline: 'HIGH', commercials: 'LOW' });
    expect(result.limitations).toContainEqual({ reason: 'Rate unavailable', related: [{ kind: 'CONFIGURATION', id: 'CFG_01', key: 'rates.E' }] });
  });

  it.each([[20, 'HIGH'], [21, 'LOW']] as const)('uses strict reviewed interface limit at count %i', (interfaceCount, confidence) => {
    const result = evaluateConfidence({ ...baseline(), interfaceCount });
    expect(result.confidenceByMetric).toEqual({ effort: confidence, timeline: confidence, commercials: confidence });
  });

  it('uses the configured interface limit instead of hardcoding demo 20', () => {
    expect(evaluateConfidence({ ...baseline(), interfaceCount: 21, calibrationLimit: 30 }).confidence).toBe('HIGH');
    expect(evaluateConfidence({ ...baseline(), interfaceCount: 4, calibrationLimit: 3 }).confidence).toBe('LOW');
  });

  it.each([[0, 'HIGH'], [50, 'HIGH'], [51, 'MEDIUM']] as const)('contingency %i caps only commercial confidence', (contingencyPercent, confidence) => {
    const result = evaluateConfidence({ ...baseline(), contingencyPercent });
    expect(result.confidenceByMetric).toEqual({ effort: 'HIGH', timeline: 'HIGH', commercials: confidence });
    expect(result.confidence).toBe(confidence);
  });

  it('uses the configured contingency review threshold', () => {
    expect(evaluateConfidence({ ...baseline(), contingencyPercent: 51, contingencyReviewThreshold: 60 }).confidence).toBe('HIGH');
    expect(evaluateConfidence({ ...baseline(), contingencyPercent: 16, contingencyReviewThreshold: 15 }).confidence).toBe('MEDIUM');
  });

  it.each([
    ['calibrated', 'calibration', { effort: 'MEDIUM', timeline: 'MEDIUM', commercials: 'MEDIUM' }],
    ['calibrationLimit', 'supportedVolumeThreshold', { effort: 'LOW', timeline: 'LOW', commercials: 'LOW' }],
    ['contingencyPercent', 'contingencyPercent', { effort: 'HIGH', timeline: 'HIGH', commercials: 'LOW' }],
    ['contingencyReviewThreshold', 'contingencyReviewThreshold', { effort: 'HIGH', timeline: 'HIGH', commercials: 'MEDIUM' }],
  ] as const)('exposes unknown policy %s conservatively', (field, configKey, expected) => {
    const result = evaluateConfidence({ ...baseline(), [field]: null });
    expect(result.confidenceByMetric).toEqual(expected);
    expect(result.limitations).toContainEqual(expect.objectContaining({ related: [{ kind: 'CONFIGURATION', id: 'CFG_01', key: configKey }] }));
  });

  it('does not mutate inputs and returns deterministic independent limitations', () => {
    const input = baseline();
    input.signals = [{ reason: 'Critical question', related: [{ kind: 'Question', id: 'Q_01' }], severity: 'LOW', metrics: ['effort'] }];
    const original = structuredClone(input);
    const result = evaluateConfidence(input);
    expect(evaluateConfidence(input)).toEqual(result);
    result.limitations[0]!.related.push({ kind: 'Question', id: 'Q_02' });
    expect(input).toEqual(original);
  });
});

it('minimumConfidence takes the weakest value with HIGH as the empty identity', () => {
  expect(minimumConfidence([])).toBe('HIGH');
  expect(minimumConfidence(['HIGH', 'MEDIUM', 'HIGH'])).toBe('MEDIUM');
  expect(minimumConfidence(['LOW', 'HIGH', 'MEDIUM'])).toBe('LOW');
});
