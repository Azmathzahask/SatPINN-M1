import {
  AlertPriority,
  FieldProvenance,
  ProvenanceValue,
  TELEMETRY_SCHEMA_VERSION,
  TelemetryPacket,
  TelemetrySnapshot
} from '../../types/comms';

const PROVENANCE: FieldProvenance[] = [
  'MEASURED',
  'EXTERNAL_OBSERVATION',
  'MODEL_PREDICTION',
  'SIMULATED',
  'UNAVAILABLE'
];

const PRIORITIES: AlertPriority[] = ['CRITICAL', 'HIGH', 'ROUTINE'];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateProvenanceValue(
  field: string,
  raw: unknown,
  errors: string[]
): void {
  if (!isRecord(raw)) {
    errors.push(`${field} must be an object with value and provenance`);
    return;
  }
  if (raw.value !== null && typeof raw.value !== 'number') {
    errors.push(`${field}.value must be a number or null`);
  }
  if (typeof raw.value === 'number' && !Number.isFinite(raw.value)) {
    errors.push(`${field}.value must be a finite number`);
  }
  if (!PROVENANCE.includes(raw.provenance as FieldProvenance)) {
    errors.push(`${field}.provenance is invalid`);
  }
  if (raw.provenance === 'UNAVAILABLE' && raw.value !== null) {
    errors.push(`${field}: UNAVAILABLE provenance requires value=null`);
  }
}

const MAX_PACKET_JSON_BYTES = 32_768;

export function validateTelemetryPacket(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['Packet must be a JSON object'] };
  }

  const encoded = JSON.stringify(input);
  if (encoded.length > MAX_PACKET_JSON_BYTES) {
    errors.push(`Packet exceeds maximum size of ${MAX_PACKET_JSON_BYTES} bytes`);
  }

  if (input.schema_version !== TELEMETRY_SCHEMA_VERSION) {
    errors.push(`Unsupported schema_version (expected ${TELEMETRY_SCHEMA_VERSION})`);
  }
  if (typeof input.satellite_id !== 'string' || !input.satellite_id.trim()) {
    errors.push('satellite_id is required');
  }
  if (typeof input.packet_id !== 'string' || !/^[A-Za-z0-9._:-]{8,80}$/.test(input.packet_id)) {
    errors.push('packet_id must be 8-80 characters of letters, digits, . _ : -');
  }
  if (typeof input.generated_at !== 'string' || Number.isNaN(Date.parse(input.generated_at))) {
    errors.push('generated_at must be a valid UTC ISO-8601 timestamp');
  }
  if (typeof input.health_status !== 'string' || !input.health_status.trim()) {
    errors.push('health_status is required');
  }
  if (!PRIORITIES.includes(input.alert_priority as AlertPriority)) {
    errors.push('alert_priority must be CRITICAL, HIGH, or ROUTINE');
  }
  if (typeof input.payload_source !== 'string' || !input.payload_source.trim()) {
    errors.push('payload_source is required');
  }

  for (const field of ['temperature_c', 'voltage_v', 'current_a', 'radiation_level', 'rul_hours']) {
    validateProvenanceValue(field, input[field], errors);
  }

  return { valid: errors.length === 0, errors };
}

export function validateAcknowledgment(
  input: unknown,
  expectedPacketId: string
): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['Acknowledgment must be a JSON object'] };
  }
  if (input.status !== 'ACK') {
    errors.push('acknowledgment status must be ACK');
  }
  if (input.packet_id !== expectedPacketId) {
    errors.push('acknowledgment packet_id does not match transmitted packet');
  }
  if (typeof input.received_at !== 'string' || Number.isNaN(Date.parse(input.received_at))) {
    errors.push('acknowledgment received_at must be a valid timestamp');
  }
  return { valid: errors.length === 0, errors };
}

let packetSeq = 0;

export function resetPacketSequence(value = 0): void {
  packetSeq = value;
}

export function createPacketId(satelliteId: string, nowMs: number): string {
  packetSeq += 1;
  const stamp = new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${satelliteId}-${stamp}-${String(packetSeq).padStart(5, '0')}`;
}

function field(
  value: number | null,
  provenance: FieldProvenance,
  unit?: string
): ProvenanceValue<number> {
  if (value === null || provenance === 'UNAVAILABLE') {
    return { value: null, provenance: provenance === 'UNAVAILABLE' ? 'UNAVAILABLE' : provenance, unit };
  }
  return { value, provenance, unit };
}

export function buildTelemetryPacket(
  snapshot: TelemetrySnapshot,
  options: {
    priority: AlertPriority;
    payloadSource: string;
    nowMs?: number;
    satelliteId?: string;
  }
): TelemetryPacket {
  const nowMs = options.nowMs ?? Date.now();
  const satelliteId = options.satelliteId || snapshot.satelliteId || 'SAT-M1';
  return {
    schema_version: TELEMETRY_SCHEMA_VERSION,
    satellite_id: satelliteId,
    packet_id: createPacketId(satelliteId, nowMs),
    generated_at: new Date(nowMs).toISOString(),
    temperature_c: field(snapshot.temperatureC, snapshot.temperatureProvenance, 'C'),
    voltage_v: field(snapshot.voltageV, snapshot.voltageProvenance, 'V'),
    current_a: field(snapshot.currentA, snapshot.currentProvenance, 'A'),
    radiation_level: field(snapshot.radiationLevel, snapshot.radiationProvenance, 'pfu'),
    rul_hours: field(snapshot.rulHours, snapshot.rulProvenance, 'h'),
    health_status: snapshot.healthStatus,
    alert_priority: options.priority,
    payload_source: options.payloadSource
  };
}

export function parseJsonPacket(raw: string): { packet?: unknown; error?: string } {
  if (raw.length > MAX_PACKET_JSON_BYTES) {
    return { error: 'Payload too large' };
  }
  try {
    return { packet: JSON.parse(raw) };
  } catch {
    return { error: 'Invalid JSON' };
  }
}
