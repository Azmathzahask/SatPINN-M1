/**
 * Satellite-to-Ground communication simulator types.
 * Contact windows, delay, and packet loss are SIMULATED.
 * Packet delivery between computers uses the real LAN/hotspot network.
 */

export const TELEMETRY_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_SATELLITE_ID = 'SAT-M1';

export type FieldProvenance =
  | 'MEASURED'
  | 'EXTERNAL_OBSERVATION'
  | 'MODEL_PREDICTION'
  | 'SIMULATED'
  | 'UNAVAILABLE';

export type AlertPriority = 'CRITICAL' | 'HIGH' | 'ROUTINE';

export type PacketTxStatus =
  | 'QUEUED'
  | 'TRANSMITTING'
  | 'AWAITING_ACK'
  | 'ACKNOWLEDGED'
  | 'FAILED_RETRY'
  | 'EXHAUSTED';

export type ContactState = 'IN_CONTACT' | 'OUT_OF_CONTACT';

export type LinkConditionLabel = 'SIMULATED';

export interface ProvenanceValue<T> {
  value: T | null;
  provenance: FieldProvenance;
  unit?: string;
  notes?: string;
}

export interface TelemetryPacket {
  schema_version: string;
  satellite_id: string;
  packet_id: string;
  generated_at: string;
  temperature_c: ProvenanceValue<number>;
  voltage_v: ProvenanceValue<number>;
  current_a: ProvenanceValue<number>;
  radiation_level: ProvenanceValue<number>;
  rul_hours: ProvenanceValue<number>;
  health_status: string;
  alert_priority: AlertPriority;
  payload_source: string;
}

export interface TelemetrySnapshot {
  satelliteId?: string;
  temperatureC: number | null;
  temperatureProvenance: FieldProvenance;
  voltageV: number | null;
  voltageProvenance: FieldProvenance;
  currentA: number | null;
  currentProvenance: FieldProvenance;
  radiationLevel: number | null;
  radiationProvenance: FieldProvenance;
  rulHours: number | null;
  rulProvenance: FieldProvenance;
  healthStatus: string;
}

export interface Acknowledgment {
  status: 'ACK';
  packet_id: string;
  satellite_id: string;
  received_at: string;
  duplicate: boolean;
}

export interface QueuedPacket {
  packet: TelemetryPacket;
  status: PacketTxStatus;
  enqueuedAt: string;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  lastAttemptAt?: string;
  acknowledgedAt?: string;
}

export interface CommsEvent {
  id: string;
  timestamp: string;
  category: 'QUEUE' | 'LINK' | 'TRANSPORT' | 'ACK' | 'SCENARIO' | 'POLICY' | 'ERROR';
  message: string;
  packetId?: string;
  simulated: boolean;
  details?: Record<string, unknown>;
}

export interface CommsStats {
  generated: number;
  queued: number;
  transmitting: number;
  transmitted: number;
  acknowledged: number;
  failed: number;
  awaitingRetry: number;
  exhausted: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

export interface GroundStationConfig {
  host: string;
  port: number;
}

export interface LinkSimConfig {
  packetLossRate: number;
  delayMs: number;
  randomSeed: number | null;
  dropNextAck: boolean;
  forceDrop?: boolean;
}

export interface CommsPolicyRecommendation {
  engine: 'DETERMINISTIC_POLICY';
  timestamp: string;
  recommendations: string[];
  queueOrderRationale: string;
  notes: string;
}

export const PRIORITY_RANK: Record<AlertPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  ROUTINE: 2
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseBackoffMs: 250,
  maxBackoffMs: 4000
};

export interface OnboardPublicState {
  satelliteId: string;
  contact: ContactState;
  autoTelemetry: boolean;
  autoWindows: boolean;
  gs: GroundStationConfig;
  packetLossRate: number;
  delayMs: number;
  randomSeed: number | null;
  dropNextAckArmed: boolean;
  queue: QueuedPacket[];
  stats: CommsStats;
  events: CommsEvent[];
  lastSuccessfulTxAt: string | null;
  gsReachable: boolean | null;
  gsLastHealthAt: string | null;
  transmitting: boolean;
  policy: CommsPolicyRecommendation;
  labels: {
    contactWindows: 'SIMULATED';
    packetLoss: 'SIMULATED';
    delay: 'SIMULATED';
    networkTransfer: 'REAL_LAN_OR_HOTSPOT';
  };
}
