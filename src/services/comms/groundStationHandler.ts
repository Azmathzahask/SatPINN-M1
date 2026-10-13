import fs from 'fs';
import path from 'path';
import { Acknowledgment, CommsEvent, TelemetryPacket } from '../../types/comms';
import { validateTelemetryPacket } from './packetSchema';

export interface StoredReception {
  packet: TelemetryPacket;
  received_at: string;
  duplicate_count: number;
}

export interface GroundStationMemory {
  packets: StoredReception[];
  events: CommsEvent[];
  invalidCount: number;
  duplicateCount: number;
  startedAt: string;
}

export class GroundStationStore {
  memory: GroundStationMemory;
  private persistFile: string | null;
  private eventSeq = 0;

  constructor(persistDir?: string | null) {
    this.persistFile = persistDir ? path.join(persistDir, 'received.json') : null;
    this.memory = this.load();
    this.eventSeq = this.memory.events.length;
  }

  private load(): GroundStationMemory {
    if (this.persistFile && fs.existsSync(this.persistFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.persistFile, 'utf8')) as GroundStationMemory;
        if (parsed && Array.isArray(parsed.packets)) return parsed;
      } catch {
        // fall through to empty store
      }
    }
    return {
      packets: [],
      events: [],
      invalidCount: 0,
      duplicateCount: 0,
      startedAt: new Date().toISOString()
    };
  }

  private save(): void {
    if (!this.persistFile) return;
    fs.mkdirSync(path.dirname(this.persistFile), { recursive: true });
    fs.writeFileSync(this.persistFile, JSON.stringify(this.memory, null, 2), 'utf8');
  }

  log(category: CommsEvent['category'], message: string, extra?: Partial<CommsEvent>): void {
    this.eventSeq += 1;
    this.memory.events.unshift({
      id: `GS-${this.eventSeq.toString().padStart(6, '0')}`,
      timestamp: extra?.timestamp || new Date().toISOString(),
      category,
      message,
      packetId: extra?.packetId,
      simulated: extra?.simulated ?? false,
      details: extra?.details
    });
    this.memory.events = this.memory.events.slice(0, 500);
  }

  receive(input: unknown, receivedAt = new Date().toISOString()): {
    status: number;
    body: Acknowledgment | { status: 'REJECTED'; errors: string[] };
  } {
    const check = validateTelemetryPacket(input);
    if (!check.valid) {
      this.memory.invalidCount += 1;
      this.log('ERROR', `Invalid packet rejected: ${check.errors.join('; ')}`, {
        simulated: false,
        details: { errors: check.errors }
      });
      this.save();
      return { status: 400, body: { status: 'REJECTED', errors: check.errors } };
    }

    const packet = input as TelemetryPacket;
    const existing = this.memory.packets.find(p => p.packet.packet_id === packet.packet_id);
    if (existing) {
      existing.duplicate_count += 1;
      this.memory.duplicateCount += 1;
      this.log('ACK', `Duplicate packet ${packet.packet_id} — returning original acknowledgment`, {
        packetId: packet.packet_id,
        simulated: false,
        details: { original_received_at: existing.received_at }
      });
      this.save();
      return {
        status: 200,
        body: {
          status: 'ACK',
          packet_id: existing.packet.packet_id,
          satellite_id: existing.packet.satellite_id,
          received_at: existing.received_at,
          duplicate: true
        }
      };
    }

    this.memory.packets.unshift({ packet, received_at: receivedAt, duplicate_count: 0 });
    this.memory.packets = this.memory.packets.slice(0, 2000);
    this.log('TRANSPORT', `Received ${packet.alert_priority} packet ${packet.packet_id}`, {
      packetId: packet.packet_id,
      simulated: false,
      details: { satellite_id: packet.satellite_id, health_status: packet.health_status }
    });
    this.save();
    return {
      status: 200,
      body: {
        status: 'ACK',
        packet_id: packet.packet_id,
        satellite_id: packet.satellite_id,
        received_at: receivedAt,
        duplicate: false
      }
    };
  }

  list(filters?: { priority?: string; q?: string }) {
    let rows = this.memory.packets;
    if (filters?.priority) {
      rows = rows.filter(r => r.packet.alert_priority === filters.priority);
    }
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(r =>
        r.packet.packet_id.toLowerCase().includes(q) ||
        r.packet.satellite_id.toLowerCase().includes(q) ||
        r.packet.health_status.toLowerCase().includes(q)
      );
    }
    return rows;
  }

  stats() {
    const critical = this.memory.packets.filter(p => p.packet.alert_priority === 'CRITICAL').length;
    return {
      received: this.memory.packets.length,
      duplicates: this.memory.duplicateCount,
      invalid: this.memory.invalidCount,
      criticalAlerts: critical,
      startedAt: this.memory.startedAt
    };
  }

  clearHistory(): void {
    this.memory.packets = [];
    this.memory.events = [];
    this.memory.invalidCount = 0;
    this.memory.duplicateCount = 0;
    this.eventSeq = 0;
    this.log('SCENARIO', 'Operator cleared ground-station reception history', { simulated: false });
    this.save();
  }
}

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/;

export function originAllowed(origin: string | undefined, extra: string[]): boolean {
  if (!origin) return true;
  const allow = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    ...extra
  ];
  if (allow.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const portOk = ['3000', '8000', '5173', ''].includes(url.port);
    return PRIVATE_HOST.test(url.hostname) && portOk && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}
