import {
  CommsPolicyRecommendation,
  ContactState,
  QueuedPacket,
  TelemetrySnapshot
} from '../../types/comms';

/**
 * Deterministic downlink policy. An LLM must not control the transport loop.
 * Existing ReAct/autonomous agent recommendations are advisory only.
 */
export function evaluateDownlinkPolicy(input: {
  contact: ContactState;
  snapshot: TelemetrySnapshot;
  queue: QueuedPacket[];
  nowIso: string;
}): CommsPolicyRecommendation {
  const recommendations: string[] = [];
  const criticalQueued = input.queue.filter(
    q => q.packet.alert_priority === 'CRITICAL' && q.status !== 'ACKNOWLEDGED' && q.status !== 'EXHAUSTED'
  );
  const routineQueued = input.queue.filter(
    q => q.packet.alert_priority === 'ROUTINE' && (q.status === 'QUEUED' || q.status === 'FAILED_RETRY')
  );
  const rul = input.snapshot.rulHours;

  if (input.contact === 'OUT_OF_CONTACT') {
    recommendations.push('Delay routine telemetry until a ground-station contact window is open.');
    if (criticalQueued.length > 0 || (typeof rul === 'number' && rul < 100)) {
      recommendations.push('Keep critical health/RUL alerts queued for immediate transmission when contact resumes.');
    }
  } else {
    if (criticalQueued.length > 0) {
      recommendations.push('Send critical telemetry first; hold routine packets until the high-priority queue is clear.');
    } else {
      recommendations.push('Transmit routine telemetry in FIFO order during the open contact window.');
    }
  }

  if (typeof rul === 'number' && rul < 100) {
    recommendations.push('Escalate critical RUL alerts and attach diagnostic context (voltage, current, temperature, flux).');
  }

  if (routineQueued.length > 8) {
    recommendations.push('Prioritise limited simulated transmission capacity: drain critical/high packets before the backlog of routine frames.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No downlink policy change. Continue store-and-forward operations.');
  }

  return {
    engine: 'DETERMINISTIC_POLICY',
    timestamp: input.nowIso,
    recommendations,
    queueOrderRationale:
      'Delivery order is CRITICAL, then HIGH, then ROUTINE, with FIFO among equal priority. Policy text is advisory and cannot bypass validation or the transport loop.',
    notes:
      'This engine is deterministic. It does not fabricate LLM outputs. Existing autonomous-agent mitigation remains independent of packet transport.'
  };
}
