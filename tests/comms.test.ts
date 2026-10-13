import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import {
  TELEMETRY_SCHEMA_VERSION,
  TelemetryPacket,
  TelemetrySnapshot
} from '../src/types/comms';
import {
  buildTelemetryPacket,
  resetPacketSequence,
  validateAcknowledgment,
  validateTelemetryPacket
} from '../src/services/comms/packetSchema';
import { OnboardTelemetryQueue, compareQueuedPackets, sortQueue } from '../src/services/comms/priorityQueue';
import { LinkSimulator } from '../src/services/comms/linkSimulator';
import { SeededRng } from '../src/services/comms/seededRng';
import { OnboardCommsController, CommsClock } from '../src/services/comms/onboardController';
import { GroundStationStore } from '../src/services/comms/groundStationHandler';
import { mountGroundStationRoutes } from '../src/services/comms/mountGroundStation';
import { evaluateDownlinkPolicy } from '../src/services/comms/policyEngine';

const SNAP: TelemetrySnapshot = {
  satelliteId: 'SAT-M1',
  temperatureC: 38.6,
  temperatureProvenance: 'SIMULATED',
  voltageV: 1.2,
  voltageProvenance: 'SIMULATED',
  currentA: 0.0824,
  currentProvenance: 'SIMULATED',
  radiationLevel: 12.5,
  radiationProvenance: 'EXTERNAL_OBSERVATION',
  rulHours: 1200,
  rulProvenance: 'MODEL_PREDICTION',
  healthStatus: 'NOMINAL'
};

function fakeClock(start = 1_700_000_000_000): CommsClock & { advance(ms: number): void } {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    sleep: async (ms: number, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      now += ms;
    }
  };
}

function samplePacket(overrides: Partial<TelemetryPacket> = {}): TelemetryPacket {
  return {
    schema_version: TELEMETRY_SCHEMA_VERSION,
    satellite_id: 'SAT-M1',
    packet_id: 'SAT-M1-TESTPKT-00001',
    generated_at: '2026-10-12T16:00:00.000Z',
    temperature_c: { value: 38.6, provenance: 'SIMULATED', unit: 'C' },
    voltage_v: { value: 1.2, provenance: 'SIMULATED', unit: 'V' },
    current_a: { value: 0.082, provenance: 'SIMULATED', unit: 'A' },
    radiation_level: { value: 10, provenance: 'EXTERNAL_OBSERVATION', unit: 'pfu' },
    rul_hours: { value: 90, provenance: 'MODEL_PREDICTION', unit: 'h' },
    health_status: 'CRITICAL',
    alert_priority: 'ROUTINE',
    payload_source: 'TEST',
    ...overrides
  };
}

describe('1. packet schema validation', () => {
  it('accepts a versioned packet and rejects invalid payloads', () => {
    resetPacketSequence();
    const pkt = buildTelemetryPacket(SNAP, { priority: 'ROUTINE', payloadSource: 'TEST', nowMs: Date.UTC(2026, 9, 12) });
    assert.equal(validateTelemetryPacket(pkt).valid, true);
    assert.equal(validateTelemetryPacket({}).valid, false);
    assert.equal(validateTelemetryPacket(null).valid, false);
    const bad = { ...pkt, schema_version: '0.0' };
    assert.equal(validateTelemetryPacket(bad).valid, false);
  });
});

describe('2. priority sorting and FIFO', () => {
  it('sends CRITICAL before ROUTINE and preserves FIFO within a priority', () => {
    const q = new OnboardTelemetryQueue();
    const t0 = 1_000;
    q.enqueue(samplePacket({ packet_id: 'SAT-M1-TESTPKT-R1', alert_priority: 'ROUTINE' }), t0);
    q.enqueue(samplePacket({ packet_id: 'SAT-M1-TESTPKT-R2', alert_priority: 'ROUTINE' }), t0 + 1);
    q.enqueue(samplePacket({ packet_id: 'SAT-M1-TESTPKT-C1', alert_priority: 'CRITICAL' }), t0 + 2);
    const ordered = q.getAll().map(i => i.packet.packet_id);
    assert.deepEqual(ordered, ['SAT-M1-TESTPKT-C1', 'SAT-M1-TESTPKT-R1', 'SAT-M1-TESTPKT-R2']);
    assert.ok(compareQueuedPackets(q.getAll()[0], q.getAll()[1]) <= 0);
    assert.equal(sortQueue(q.getAll())[0].packet.alert_priority, 'CRITICAL');
  });
});

describe('3-4. queue vs contact window', () => {
  it('keeps packets queued while OUT OF CONTACT and transmits when contact opens', async () => {
    const posts: string[] = [];
    const clock = fakeClock();
    const controller = new OnboardCommsController(async (_url, packet) => {
      posts.push(packet.packet_id);
      return {
        ok: true,
        status: 200,
        body: {
          status: 'ACK',
          packet_id: packet.packet_id,
          satellite_id: packet.satellite_id,
          received_at: new Date(clock.now()).toISOString(),
          duplicate: false
        }
      };
    }, clock);
    controller.link.configure({ delayMs: 0, packetLossRate: 0 });
    controller.updateSnapshot(SNAP);
    controller.generate('ROUTINE', 'TEST');
    await controller.tick();
    assert.equal(posts.length, 0);
    assert.equal(controller.queue.getAll()[0].status, 'QUEUED');
    controller.setContact(true, 'test');
    await controller.tick();
    assert.equal(posts.length, 1);
    assert.equal(controller.queue.getAll().length, 0);
    assert.equal(controller.acknowledgedCount, 1);
  });
});

describe('5. simulated packet loss', () => {
  it('is reproducible with a seed and does not call transport on a dropped attempt', async () => {
    const a = new LinkSimulator({ packetLossRate: 0.5, randomSeed: 99 });
    const b = new LinkSimulator({ packetLossRate: 0.5, randomSeed: 99 });
    const seqA = Array.from({ length: 20 }, () => a.shouldDropAttempt());
    const seqB = Array.from({ length: 20 }, () => b.shouldDropAttempt());
    assert.deepEqual(seqA, seqB);
    assert.ok(seqA.some(Boolean));
    assert.ok(seqA.some(v => !v));

    const rng = new SeededRng(1);
    assert.equal(typeof rng.next(), 'number');

    let posts = 0;
    const clock = fakeClock();
    const controller = new OnboardCommsController(async (_url, packet) => {
      posts += 1;
      return {
        ok: true,
        status: 200,
        body: {
          status: 'ACK',
          packet_id: packet.packet_id,
          satellite_id: 'SAT-M1',
          received_at: new Date().toISOString(),
          duplicate: false
        }
      };
    }, clock);
    controller.updateSnapshot(SNAP);
    controller.link.configure({ delayMs: 0, forceDrop: true });
    controller.setContact(true);
    controller.generate('HIGH', 'LOSS');
    await controller.tick();
    assert.equal(posts, 0);
    assert.equal(controller.queue.getAll()[0].status, 'FAILED_RETRY');
  });
});

describe('6. retry and exhaustion', () => {
  it('retries with backoff then marks EXHAUSTED', async () => {
    const clock = fakeClock();
    const controller = new OnboardCommsController(async () => {
      throw new Error('should not send');
    }, clock);
    controller.updateSnapshot(SNAP);
    controller.link.configure({ delayMs: 0, forceDrop: true });
    controller.setContact(true);
    controller.generate('ROUTINE', 'RETRY');
    for (let i = 0; i < 5; i++) {
      clock.advance(10_000);
      await controller.tick();
    }
    assert.equal(controller.queue.getAll()[0].status, 'EXHAUSTED');
    assert.equal(controller.queue.getAll()[0].attempts, 5);
  });
});

describe('7. acknowledgment validation', () => {
  it('rejects mismatched packet IDs', () => {
    const ok = validateAcknowledgment(
      { status: 'ACK', packet_id: 'SAT-M1-TESTPKT-00001', received_at: '2026-10-12T16:00:00.000Z' },
      'SAT-M1-TESTPKT-00001'
    );
    assert.equal(ok.valid, true);
    const bad = validateAcknowledgment(
      { status: 'ACK', packet_id: 'OTHER', received_at: '2026-10-12T16:00:00.000Z' },
      'SAT-M1-TESTPKT-00001'
    );
    assert.equal(bad.valid, false);
  });
});

describe('8-9. duplicate reception and lost ACK', () => {
  it('deduplicates by packet_id and returns the original ACK', () => {
    const store = new GroundStationStore(null);
    const pkt = samplePacket({ packet_id: 'SAT-M1-TESTPKT-DUP1' });
    const first = store.receive(pkt, '2026-10-12T16:00:00.000Z');
    const second = store.receive(pkt, '2026-10-12T16:05:00.000Z');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((second.body as { duplicate: boolean }).duplicate, true);
    assert.equal((second.body as { received_at: string }).received_at, '2026-10-12T16:00:00.000Z');
    assert.equal(store.memory.packets.length, 1);
    assert.equal(store.stats().duplicates, 1);
  });
});

describe('10. receiver offline', () => {
  it('retains the packet for retry when the receiver is unreachable', async () => {
    const clock = fakeClock();
    const controller = new OnboardCommsController(async () => {
      return { ok: false, status: 0, body: null, error: 'fetch failed' };
    }, clock);
    controller.updateSnapshot(SNAP);
    controller.link.configure({ delayMs: 0 });
    controller.setContact(true);
    controller.generate('ROUTINE', 'OFFLINE');
    await controller.tick();
    const item = controller.queue.getAll()[0];
    assert.equal(item.status, 'FAILED_RETRY');
    assert.match(item.lastError || '', /fetch failed/);
  });
});

describe('11. invalid payload handling', () => {
  it('records invalid packets without storing them', () => {
    const store = new GroundStationStore(null);
    const result = store.receive({ not: 'a packet' });
    assert.equal(result.status, 400);
    assert.equal(store.memory.packets.length, 0);
    assert.equal(store.stats().invalid, 1);
  });
});

describe('12. end-to-end HTTP delivery', () => {
  it('delivers over HTTP and requires a matching ACK', async () => {
    const store = new GroundStationStore(null);
    const app = express();
    app.use(express.json());
    mountGroundStationRoutes(app, store, []);
    const server: Server = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    const clock = fakeClock();
    const controller = new OnboardCommsController(undefined, clock);
    controller.gs.host = '127.0.0.1';
    controller.gs.port = addr.port;
    controller.link.configure({ delayMs: 0, packetLossRate: 0 });
    controller.updateSnapshot(SNAP);
    controller.setContact(true);
    const pkt = controller.generate('CRITICAL', 'E2E');
    await controller.tick();
    assert.equal(controller.acknowledgedCount, 1);
    assert.equal(store.memory.packets[0].packet.packet_id, pkt.packet_id);
    assert.equal(store.memory.packets.length, 1);

    const lost = controller.generate('HIGH', 'LOST_ACK');
    controller.link.configure({ dropNextAck: true });
    await controller.tick();
    assert.equal(store.memory.packets.some(p => p.packet.packet_id === lost.packet_id), true);
    clock.advance(1000);
    await controller.tick();
    assert.equal(store.memory.packets.filter(p => p.packet.packet_id === lost.packet_id).length, 1);
    assert.ok(store.stats().duplicates >= 1);

    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  });
});

describe('policy engine', () => {
  it('is deterministic and does not claim LLM control', () => {
    const rec = evaluateDownlinkPolicy({
      contact: 'OUT_OF_CONTACT',
      snapshot: { ...SNAP, rulHours: 40 },
      queue: [],
      nowIso: '2026-10-12T16:00:00.000Z'
    });
    assert.equal(rec.engine, 'DETERMINISTIC_POLICY');
    assert.ok(rec.recommendations.some(r => r.toLowerCase().includes('delay routine')));
  });
});
