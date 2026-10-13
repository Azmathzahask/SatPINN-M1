import {
  AlertPriority,
  CommsEvent,
  ContactState,
  DEFAULT_SATELLITE_ID,
  GroundStationConfig,
  OnboardPublicState,
  TelemetryPacket,
  TelemetrySnapshot
} from '../../types/comms';
import { buildTelemetryPacket, validateAcknowledgment, validateTelemetryPacket } from './packetSchema';
import { OnboardTelemetryQueue } from './priorityQueue';
import { LinkSimulator } from './linkSimulator';
import { evaluateDownlinkPolicy } from './policyEngine';

export interface TransportResponse {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export interface CommsTransport {
  postTelemetry(
    url: string,
    packet: TelemetryPacket,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<TransportResponse>;
}

export interface CommsClock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export const realClock: CommsClock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    })
};

export async function fetchTransport(
  url: string,
  packet: TelemetryPacket,
  timeoutMs: number,
  signal: AbortSignal
): Promise<TransportResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
      signal: controller.signal
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, body: null, error: message };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

const DEFAULT_SNAPSHOT: TelemetrySnapshot = {
  satelliteId: DEFAULT_SATELLITE_ID,
  temperatureC: null,
  temperatureProvenance: 'UNAVAILABLE',
  voltageV: null,
  voltageProvenance: 'UNAVAILABLE',
  currentA: null,
  currentProvenance: 'UNAVAILABLE',
  radiationLevel: null,
  radiationProvenance: 'UNAVAILABLE',
  rulHours: null,
  rulProvenance: 'UNAVAILABLE',
  healthStatus: 'UNKNOWN'
};

export class OnboardCommsController {
  readonly queue = new OnboardTelemetryQueue();
  readonly link = new LinkSimulator({ packetLossRate: 0, delayMs: 200, randomSeed: 42 });
  satelliteId = DEFAULT_SATELLITE_ID;
  contact: ContactState = 'OUT_OF_CONTACT';
  autoTelemetry = false;
  autoWindows = false;
  gs: GroundStationConfig = {
    host: process.env.GS_HOST || '127.0.0.1',
    port: Number(process.env.GS_PORT || 8000)
  };
  lastSuccessfulTxAt: string | null = null;
  gsReachable: boolean | null = null;
  gsLastHealthAt: string | null = null;
  generatedCount = 0;
  acknowledgedCount = 0;
  snapshot: TelemetrySnapshot = { ...DEFAULT_SNAPSHOT };
  private events: CommsEvent[] = [];
  private eventSeq = 0;
  private transmitting = false;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private windowTimer: ReturnType<typeof setInterval> | null = null;
  private abortInFlight: AbortController | null = null;
  private stopped = false;

  constructor(
    private transport: CommsTransport['postTelemetry'] = fetchTransport,
    public clock: CommsClock = realClock
  ) {}

  telemetryUrl(): string {
    return `http://${this.gs.host}:${this.gs.port}/telemetry`;
  }

  healthUrl(): string {
    return `http://${this.gs.host}:${this.gs.port}/health`;
  }

  log(
    category: CommsEvent['category'],
    message: string,
    extra?: { packetId?: string; simulated?: boolean; details?: Record<string, unknown> }
  ): void {
    this.eventSeq += 1;
    this.events.unshift({
      id: `EVT-${this.eventSeq.toString().padStart(6, '0')}`,
      timestamp: new Date(this.clock.now()).toISOString(),
      category,
      message,
      packetId: extra?.packetId,
      simulated: extra?.simulated ?? true,
      details: extra?.details
    });
    this.events = this.events.slice(0, 400);
  }

  getState(): OnboardPublicState {
    const link = this.link.getState();
    return {
      satelliteId: this.satelliteId,
      contact: this.contact,
      autoTelemetry: this.autoTelemetry,
      autoWindows: this.autoWindows,
      gs: { ...this.gs },
      packetLossRate: link.packetLossRate,
      delayMs: link.delayMs,
      randomSeed: link.randomSeed,
      dropNextAckArmed: link.dropNextAck,
      queue: this.queue.getAll(),
      stats: { ...this.queue.stats(), generated: this.generatedCount, acknowledged: this.acknowledgedCount },
      events: this.events.slice(0, 120),
      lastSuccessfulTxAt: this.lastSuccessfulTxAt,
      gsReachable: this.gsReachable,
      gsLastHealthAt: this.gsLastHealthAt,
      transmitting: this.transmitting,
      policy: evaluateDownlinkPolicy({
        contact: this.contact,
        snapshot: this.snapshot,
        queue: this.queue.getAll(),
        nowIso: new Date(this.clock.now()).toISOString()
      }),
      labels: {
        contactWindows: 'SIMULATED',
        packetLoss: 'SIMULATED',
        delay: 'SIMULATED',
        networkTransfer: 'REAL_LAN_OR_HOTSPOT'
      }
    };
  }

  updateSnapshot(snapshot: TelemetrySnapshot): void {
    this.snapshot = { ...this.snapshot, ...snapshot };
    if (snapshot.satelliteId) this.satelliteId = snapshot.satelliteId;
  }

  configure(patch: {
    gsHost?: string;
    gsPort?: number;
    packetLossRate?: number;
    delayMs?: number;
    randomSeed?: number | null;
    dropNextAck?: boolean;
    autoWindows?: boolean;
  }): void {
    if (typeof patch.gsHost === 'string' && patch.gsHost.trim()) {
      this.gs.host = patch.gsHost.trim();
    }
    if (typeof patch.gsPort === 'number' && patch.gsPort > 0 && patch.gsPort < 65536) {
      this.gs.port = patch.gsPort;
    }
    this.link.configure({
      packetLossRate: patch.packetLossRate,
      delayMs: patch.delayMs,
      randomSeed: patch.randomSeed,
      dropNextAck: patch.dropNextAck
    });
    if (typeof patch.autoWindows === 'boolean') {
      this.setAutoWindows(patch.autoWindows);
    }
    this.log('LINK', `Link/config updated host=${this.gs.host} port=${this.gs.port}`, {
      simulated: true,
      details: { ...patch }
    });
  }

  setContact(open: boolean, reason = 'operator'): void {
    const next: ContactState = open ? 'IN_CONTACT' : 'OUT_OF_CONTACT';
    if (next === this.contact) return;
    this.contact = next;
    this.log('LINK', `Contact window ${next} (${reason})`, { simulated: true });
    if (!open) {
      this.abortInFlight?.abort();
    }
  }

  setAutoTelemetry(enabled: boolean): void {
    this.autoTelemetry = enabled;
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    if (enabled) {
      this.autoTimer = setInterval(() => {
        this.generate('ROUTINE', 'AUTO_TELEMETRY_GENERATOR');
      }, 2500);
    }
    this.log('QUEUE', `Automatic telemetry ${enabled ? 'started' : 'paused'}`, { simulated: false });
  }

  setAutoWindows(enabled: boolean): void {
    this.autoWindows = enabled;
    if (this.windowTimer) {
      clearInterval(this.windowTimer);
      this.windowTimer = null;
    }
    if (enabled) {
      this.setContact(true, 'auto-schedule');
      let open = true;
      this.windowTimer = setInterval(() => {
        open = !open;
        this.setContact(open, 'auto-schedule');
      }, 20_000);
    }
  }

  generate(priority: AlertPriority, payloadSource?: string): TelemetryPacket {
    const source =
      payloadSource ||
      (priority === 'CRITICAL'
        ? 'ONBOARD_HEALTH_ALERT'
        : 'ONBOARD_ROUTINE_TELEMETRY');
    const packet = buildTelemetryPacket(this.snapshot, {
      priority,
      payloadSource: source,
      nowMs: this.clock.now(),
      satelliteId: this.satelliteId
    });
    const check = validateTelemetryPacket(packet);
    if (!check.valid) {
      this.log('ERROR', `Packet validation failed: ${check.errors.join('; ')}`, {
        simulated: false,
        details: { errors: check.errors }
      });
      throw new Error(check.errors.join('; '));
    }
    this.generatedCount += 1;
    this.queue.enqueue(packet, this.clock.now());
    this.log('QUEUE', `Generated ${priority} packet ${packet.packet_id}`, {
      packetId: packet.packet_id,
      simulated: false,
      details: { priority, payload_source: packet.payload_source }
    });
    return packet;
  }

  resetOnboard(): void {
    this.abortInFlight?.abort();
    this.queue.reset();
    this.events = [];
    this.eventSeq = 0;
    this.generatedCount = 0;
    this.acknowledgedCount = 0;
    this.lastSuccessfulTxAt = null;
    this.autoTelemetry = false;
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    this.setAutoWindows(false);
    this.contact = 'OUT_OF_CONTACT';
    this.link.configure({ packetLossRate: 0, delayMs: 200, dropNextAck: false, randomSeed: 42 });
    this.log('SCENARIO', 'Onboard simulation reset. Ground-station reception history was not deleted.', {
      simulated: false
    });
  }

  startLoop(intervalMs = 120): void {
    if (this.loopTimer) return;
    this.stopped = false;
    this.loopTimer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stop(): void {
    this.stopped = true;
    this.abortInFlight?.abort();
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.autoTimer) clearInterval(this.autoTimer);
    if (this.windowTimer) clearInterval(this.windowTimer);
    this.loopTimer = this.autoTimer = this.windowTimer = null;
  }

  async tick(): Promise<void> {
    if (this.stopped || this.transmitting) return;
    if (this.contact !== 'IN_CONTACT') return;
    const now = this.clock.now();
    const next = this.queue.peekReady(now);
    if (!next) return;
    this.transmitting = true;
    try {
      await this.transmit(next.packet.packet_id);
    } finally {
      this.transmitting = false;
    }
  }

  async probeGroundStation(): Promise<boolean> {
    try {
      const res = await fetch(this.healthUrl(), { signal: AbortSignal.timeout(2500) });
      this.gsReachable = res.ok;
      if (res.ok) this.gsLastHealthAt = new Date(this.clock.now()).toISOString();
      return res.ok;
    } catch {
      this.gsReachable = false;
      return false;
    }
  }

  private async transmit(packetId: string): Promise<void> {
    const item = this.queue.find(packetId);
    if (!item) return;
    this.queue.markTransmitting(packetId);
    this.abortInFlight = new AbortController();
    const signal = this.abortInFlight.signal;

    try {
      const delay = this.link.delayMs();
      if (delay > 0) {
        this.log('LINK', `Simulated transmission delay ${delay} ms`, {
          packetId,
          simulated: true
        });
        await this.clock.sleep(delay, signal);
      }

      if (this.contact !== 'IN_CONTACT') {
        this.queue.markFailed(packetId, this.clock.now(), 'Contact lost before RF-sim send');
        this.log('LINK', 'Contact interrupted before send', { packetId, simulated: true });
        return;
      }

      if (this.link.shouldDropAttempt()) {
        this.queue.markFailed(packetId, this.clock.now(), 'Simulated packet loss (not sent on network)');
        this.log('TRANSPORT', 'Simulated packet loss — HTTP POST skipped', {
          packetId,
          simulated: true
        });
        return;
      }

      this.queue.markAwaitingAck(packetId, this.clock.now());
      const response = await this.transport(this.telemetryUrl(), item.packet, 5000, signal);

      if (this.link.consumeDropNextAck()) {
        this.queue.markFailed(packetId, this.clock.now(), 'Simulated lost acknowledgment (receiver may have stored packet)');
        this.log('ACK', 'Simulated lost ACK — packet retained for retry', {
          packetId,
          simulated: true
        });
        return;
      }

      if (!response.ok) {
        const reason = response.error || `HTTP ${response.status}`;
        this.queue.markFailed(packetId, this.clock.now(), reason);
        this.gsReachable = response.status !== 0 ? true : false;
        this.log('TRANSPORT', `Delivery failed: ${reason}`, {
          packetId,
          simulated: false,
          details: { status: response.status }
        });
        return;
      }

      const ackCheck = validateAcknowledgment(response.body, packetId);
      if (!ackCheck.valid) {
        this.queue.markFailed(packetId, this.clock.now(), `Invalid ACK: ${ackCheck.errors.join('; ')}`);
        this.log('ACK', `Invalid acknowledgment: ${ackCheck.errors.join('; ')}`, {
          packetId,
          simulated: false
        });
        return;
      }

      this.queue.markAcknowledged(packetId, this.clock.now());
      this.queue.removeAcknowledged(packetId);
      this.acknowledgedCount += 1;
      this.lastSuccessfulTxAt = new Date(this.clock.now()).toISOString();
      this.gsReachable = true;
      this.gsLastHealthAt = this.lastSuccessfulTxAt;
      const duplicate = Boolean((response.body as { duplicate?: boolean }).duplicate);
      this.log('ACK', `Acknowledged ${packetId}${duplicate ? ' (duplicate retransmission)' : ''}`, {
        packetId,
        simulated: false,
        details: { received_at: (response.body as { received_at?: string }).received_at, duplicate }
      });
    } catch (err) {
      const aborted = (err instanceof Error && err.name === 'AbortError') || signal.aborted;
      this.queue.markFailed(
        packetId,
        this.clock.now(),
        aborted ? 'Transmission aborted (contact closed or reset)' : err instanceof Error ? err.message : String(err)
      );
      this.log('TRANSPORT', aborted ? 'Transmission aborted' : `Transport error: ${String(err)}`, {
        packetId,
        simulated: false
      });
    } finally {
      this.abortInFlight = null;
    }
  }
}
