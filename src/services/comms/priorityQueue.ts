import {
  DEFAULT_RETRY_POLICY,
  PRIORITY_RANK,
  QueuedPacket,
  RetryPolicy,
  TelemetryPacket
} from '../../types/comms';

export function compareQueuedPackets(a: QueuedPacket, b: QueuedPacket): number {
  const pa = PRIORITY_RANK[a.packet.alert_priority];
  const pb = PRIORITY_RANK[b.packet.alert_priority];
  if (pa !== pb) return pa - pb;
  const ta = Date.parse(a.enqueuedAt);
  const tb = Date.parse(b.enqueuedAt);
  if (ta !== tb) return ta - tb;
  return a.packet.packet_id.localeCompare(b.packet.packet_id);
}

export function sortQueue(items: QueuedPacket[]): QueuedPacket[] {
  return [...items].sort(compareQueuedPackets);
}

export function backoffMs(attempts: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const exp = Math.min(policy.maxBackoffMs, policy.baseBackoffMs * 2 ** Math.max(0, attempts - 1));
  return exp;
}

export class OnboardTelemetryQueue {
  private items: QueuedPacket[] = [];

  constructor(private retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {}

  enqueue(packet: TelemetryPacket, nowMs: number): QueuedPacket {
    const item: QueuedPacket = {
      packet,
      status: 'QUEUED',
      enqueuedAt: new Date(nowMs).toISOString(),
      attempts: 0,
      nextRetryAt: nowMs
    };
    this.items.push(item);
    return item;
  }

  getAll(): QueuedPacket[] {
    return sortQueue(this.items);
  }

  find(packetId: string): QueuedPacket | undefined {
    return this.items.find(i => i.packet.packet_id === packetId);
  }

  peekReady(nowMs: number, inFlightId?: string): QueuedPacket | undefined {
    const ready = this.getAll().filter(item => {
      if (item.status === 'ACKNOWLEDGED' || item.status === 'EXHAUSTED') return false;
      if (item.status === 'TRANSMITTING' && item.packet.packet_id !== inFlightId) return false;
      if (item.nextRetryAt > nowMs) return false;
      return true;
    });
    return ready[0];
  }

  markTransmitting(packetId: string): void {
    const item = this.find(packetId);
    if (item) item.status = 'TRANSMITTING';
  }

  markAwaitingAck(packetId: string, nowMs: number): void {
    const item = this.find(packetId);
    if (item) {
      item.status = 'AWAITING_ACK';
      item.lastAttemptAt = new Date(nowMs).toISOString();
    }
  }

  markAcknowledged(packetId: string, nowMs: number): QueuedPacket | undefined {
    const item = this.find(packetId);
    if (!item) return undefined;
    item.status = 'ACKNOWLEDGED';
    item.acknowledgedAt = new Date(nowMs).toISOString();
    return item;
  }

  removeAcknowledged(packetId: string): void {
    this.items = this.items.filter(
      i => !(i.packet.packet_id === packetId && i.status === 'ACKNOWLEDGED')
    );
  }

  markFailed(packetId: string, nowMs: number, error: string): QueuedPacket | undefined {
    const item = this.find(packetId);
    if (!item) return undefined;
    item.attempts += 1;
    item.lastError = error;
    item.lastAttemptAt = new Date(nowMs).toISOString();
    if (item.attempts >= this.retryPolicy.maxAttempts) {
      item.status = 'EXHAUSTED';
      item.nextRetryAt = Number.MAX_SAFE_INTEGER;
    } else {
      item.status = 'FAILED_RETRY';
      item.nextRetryAt = nowMs + backoffMs(item.attempts, this.retryPolicy);
    }
    return item;
  }

  interruptInFlight(nowMs: number, reason: string): void {
    for (const item of this.items) {
      if (item.status === 'TRANSMITTING' || item.status === 'AWAITING_ACK') {
        this.markFailed(item.packet.packet_id, nowMs, reason);
      }
    }
  }

  stats() {
    const all = this.items;
    return {
      generated: all.length,
      queued: all.filter(i => i.status === 'QUEUED').length,
      transmitting: all.filter(i => i.status === 'TRANSMITTING' || i.status === 'AWAITING_ACK').length,
      transmitted: all.filter(i =>
        i.status === 'ACKNOWLEDGED' || i.status === 'TRANSMITTING' || i.status === 'AWAITING_ACK'
      ).length,
      acknowledged: all.filter(i => i.status === 'ACKNOWLEDGED').length,
      failed: all.filter(i => i.status === 'FAILED_RETRY' || i.status === 'EXHAUSTED').length,
      awaitingRetry: all.filter(i => i.status === 'FAILED_RETRY').length,
      exhausted: all.filter(i => i.status === 'EXHAUSTED').length
    };
  }

  reset(): void {
    this.items = [];
  }

  get retry(): RetryPolicy {
    return this.retryPolicy;
  }
}
