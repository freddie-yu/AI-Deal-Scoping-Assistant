import type { Confidence, NodeRef } from '../domain/primitives.js';

export type ConfidenceMetric = 'effort' | 'timeline' | 'commercials';
export interface ConfidenceSignal {
  reason: string;
  related: NodeRef[];
  severity: 'LOW' | 'MEDIUM';
  metrics: ConfidenceMetric[];
}
export interface ConfidenceInput {
  availability: Record<ConfidenceMetric, boolean>;
  signals: ConfidenceSignal[];
  calibrated: boolean | null;
  interfaceCount: number;
  calibrationLimit: number | null;
  contingencyPercent: number | null;
  contingencyReviewThreshold: number | null;
  deadlineFeasibility: 'INFEASIBLE' | 'AT_RISK' | 'WITHIN_RANGE' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
}
export interface ConfidenceResult {
  confidenceByMetric: Record<ConfidenceMetric, Confidence>;
  confidence: Confidence;
  limitations: { reason: string; related: NodeRef[] }[];
}

export function minimumConfidence(values: readonly Confidence[]): Confidence {
  if (values.includes('LOW')) return 'LOW';
  return values.includes('MEDIUM') ? 'MEDIUM' : 'HIGH';
}

const metrics: ConfidenceMetric[] = ['effort', 'timeline', 'commercials'];
const configuration = (key: string): NodeRef => ({ kind: 'CONFIGURATION', id: 'CFG_01', key });

/** Evaluate only supplied, consumed-input signals; the caller owns scope relevance. */
export function evaluateConfidence(input: ConfidenceInput): ConfidenceResult {
  const confidenceByMetric: ConfidenceResult['confidenceByMetric'] = { effort: 'HIGH', timeline: 'HIGH', commercials: 'HIGH' };
  const limitations: ConfidenceResult['limitations'] = [];
  const apply = (severity: 'LOW' | 'MEDIUM', affected: readonly ConfidenceMetric[], reason: string, related: readonly NodeRef[] = []) => {
    if (affected.length === 0) return;
    for (const metric of affected) confidenceByMetric[metric] = minimumConfidence([confidenceByMetric[metric], severity]);
    limitations.push({ reason, related: related.map(node => ({ ...node })) });
  };

  for (const metric of metrics) {
    if (!input.availability[metric]) apply('LOW', [metric], `${metric} calculation is unavailable.`);
  }
  for (const signal of input.signals) apply(signal.severity, signal.metrics, signal.reason, signal.related);

  if (input.calibrationLimit === null) {
    apply('LOW', metrics, 'Reviewed interface calibration limit is unknown.', [configuration('supportedVolumeThreshold')]);
  } else if (input.interfaceCount > input.calibrationLimit) {
    apply('LOW', metrics, `Interface count ${input.interfaceCount} exceeds reviewed calibration limit ${input.calibrationLimit}.`, [configuration('supportedVolumeThreshold')]);
  }

  if (input.deadlineFeasibility === 'INFEASIBLE' || input.deadlineFeasibility === 'AT_RISK' || input.deadlineFeasibility === 'UNAVAILABLE') {
    apply('LOW', ['timeline'], `Requested deadline feasibility is ${input.deadlineFeasibility}.`, [configuration('deliveryDeadline')]);
  }

  // Approval does not establish calibration; all effort-dependent metrics retain this cap.
  if (input.calibrated !== true) {
    apply('MEDIUM', metrics, input.calibrated === false ? 'Demo baselines remain uncalibrated.' : 'Baseline calibration evidence is unknown.', [configuration('calibration')]);
  }

  if (input.contingencyPercent === null) {
    apply('LOW', ['commercials'], 'Contingency percentage is unknown.', [configuration('contingencyPercent')]);
  }
  if (input.contingencyReviewThreshold === null) {
    apply('MEDIUM', ['commercials'], 'Contingency review threshold is unknown.', [configuration('contingencyReviewThreshold')]);
  } else if (input.contingencyPercent !== null && input.contingencyPercent > input.contingencyReviewThreshold) {
    apply('MEDIUM', ['commercials'], `Contingency ${input.contingencyPercent}% exceeds review threshold ${input.contingencyReviewThreshold}%.`, [configuration('contingencyPercent'), configuration('contingencyReviewThreshold')]);
  }

  return { confidenceByMetric, confidence: minimumConfidence(Object.values(confidenceByMetric)), limitations };
}
