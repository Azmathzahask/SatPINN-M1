/**
 * Satellite Reliability AI - Core Type Definitions
 * Physics-Informed Neural Network (PINN) + Remaining Useful Life (RUL) + Agentic Mitigation
 */

export type DataOrigin = 'MEASURED' | 'SIMULATED' | 'PREDICTED' | 'COMMANDED';

export type RulRiskBand = 
  | 'CRITICAL'                 // Case 1: RUL <= 100 Hours (Immediate protective response)
  | 'HIGH_RISK'                // Case 2: 100 < RUL <= 250 Hours (Preventive action & monitoring)
  | 'WARNING'                  // Case 3: 250 < RUL <= 500 Hours (Preventive monitoring & optimisation)
  | 'HEALTHY'                  // Case 4: RUL > 500 Hours (Routine operation)
  | 'INVALID_OR_UNAVAILABLE'   // Invalid or unavailable prediction
  | 'HIGH'                     // Alias for HIGH_RISK
  | 'NOMINAL'                  // Alias for HEALTHY (>1000h)
  | 'CRITICAL_24H'             // Critical emergency sub-tier (<24h)
  | 'ADVISORY'                 // Advisory sub-tier (500-1000h)
  | 'INDETERMINATE';

export type AgentWorkflowPhase =
  | 'IDLE_NOMINAL'
  | 'RED_ALERT'              // 5-second flashing red hazard alert
  | 'ESTIMATING_RUL'         // SciML Engine solving PINN and Newton-Raphson root finding
  | 'AGENT_REASONING_RAG'    // 5-second agent thinking & RAG retrieval across RUL bands
  | 'EXECUTING_MITIGATION'   // Voltage reduction / DVFS command + thermal relief
  | 'RECALCULATING_RECOVERY' // Major increase in RUL displayed on screen
  | 'POST_MITIGATION_RAG'    // Retrieving safety rules & Ground Station telemetry packet downlink
  | 'MISSION_STABILIZED';    // Recovered state (Green LED)

export interface GroundStationTransfer {
  inProgress: boolean;
  progressPercent: number;
  bytesTransferred: number;
  totalBytes: number;
  downlinkStatus: 'STANDBY' | 'ACQUIRING_LOCK' | 'DOWNLINKING' | 'ACKNOWLEDGED';
  frequencyMhz: number;
  packetsSent: number;
  logChecksum: string;
}

export interface WorkflowStatusState {
  phase: AgentWorkflowPhase;
  secondsRemaining: number;
  phaseTitle: string;
  phaseDetails: string;
  solverIteration?: number;
  selectedRuleAction?: string;
  voltageReductionTarget?: number;
  preMitigationRul?: number;
  postMitigationRul?: number;
  transferState?: GroundStationTransfer;
}

export type OperatingProfileId = 
  | 'NOMINAL' 
  | 'CONSERVATIVE_PROFILE_A' 
  | 'SAFE_LOW_POWER_B' 
  | 'CRITICAL_ISOLATION';

export interface OperatingProfile {
  id: OperatingProfileId;
  name: string;
  vddTarget: number; // Volts (e.g. 1.20V nominal)
  clockScale: number; // 0.0 to 1.0
  loadResistance: number; // Ohms
  dutyCycle: number; // 0.0 to 1.0
  description: string;
  isSafeMode: boolean;
  permittedInBands: RulRiskBand[];
}

export interface SpaceWeatherRecord {
  timeTag: string; // ISO timestamp
  satellite: string; // e.g. "GOES-16"
  energyChannel: string; // e.g. ">=10 MeV", ">=50 MeV", ">=100 MeV"
  flux: number; // pfu = particles/(cm^2*s*sr)
  qualityFlag: number;
  origin: 'MEASURED' | 'SIMULATED';
  eventTag?: 'NOMINAL' | 'SEP_EVENT' | 'CME_PEAK' | 'SOLAR_STORM_S3' | 'DECAY_PHASE';
}

export interface HardwareTelemetry {
  timestamp: string;
  origin: 'MEASURED' | 'SIMULATED';
  connectionMode: 'VIRTUAL_TESTBENCH' | 'REAL_ESP32_SERIAL';
  vdd: number; // Core test voltage (V)
  currentMa: number; // Current (mA)
  powerMw: number; // Power (mW) = vdd * currentMa
  probeTempC: number; // DS18B20 probe surface temp (°C) - NOT junction temp
  sensorStatus: {
    ina219Healthy: boolean;
    ds18b20Healthy: boolean;
    serialOk: boolean;
  };
  activeProfile: OperatingProfileId;
  lastCommandAck?: string;
}

export interface PinnModelParams {
  kappa: number; // Radiation susceptibility coefficient (V / (pfu * h))
  gamma0: number; // Thermal recovery attempt frequency (1/h)
  ea: number; // Activation energy (eV) (typical MOS oxide annealing: ~0.18 eV)
  vthInitial: number; // Initial threshold voltage shift at t=0 (default: 0.0 V)
}

export interface DegradationPoint {
  timeHours: number;
  protonFlux: number; // pfu
  probeTempC: number;
  deltaVthOde: number; // Numerical Runge-Kutta 4th Order Baseline (V)
  deltaVthPinn: number; // Physics-Informed Neural Network Prediction (V)
  deltaVthMlBaseline: number; // Pure ML (Unconstrained polynomial/MLP) which drifts during CME
  physicsResidual: number; // |dΔVth/dt - (κΦ - γΔVth)|
  uncertaintyLower: number; // -2 sigma
  uncertaintyUpper: number; // +2 sigma
}

export interface RulCalculationResult {
  estimatedRulHours: number; // Time until failure threshold crossing (or horizon if not crossed)
  failureThresholdVth: number; // Configurable failure criterion (e.g. -1.50 V)
  riskBand: RulRiskBand;
  solverMethod: 'Newton-Raphson + Brent Bracketed';
  converged: boolean;
  iterations: number;
  trajectoryHorizonHours: number;
  crossingTimestamp?: string;
  uncertaintyHours: number;
  reasoningNotes: string;
  predictionStatus?: 'CONVERGED' | 'THRESHOLD_EXCEEDED_AT_INIT' | 'THRESHOLD_NOT_REACHED_WITHIN_HORIZON' | 'INDETERMINATE';
  deltaRulHours?: number;
  improvementPercent?: number;
}

export interface InterventionEvaluation {
  actionId: OperatingProfileId | 'NO_ACTION' | 'PRIORITIZE_TELEMETRY';
  actionName: string;
  initialDegradationVth: number;
  failureThresholdVth: number;
  baselineVdd: number;
  baselineTempC: number;
  interventionVdd: number;
  interventionTempC: number;
  baselineRulHours: number;
  interventionRulHours: number;
  deltaRulHours: number;
  improvementPercent: number | null; // null if baseline is 0 or undefined
  hasPhysicalBenefit: boolean;
  modelValidity: 'PHYSICALLY_VALIDATED' | 'NO_EFFECT_ON_MOS_RADIATION' | 'THRESHOLD_NOT_CROSSED';
  reasoningSummary: string;
  evidenceCitation: string;
  limitations: string;
}

export interface AerospaceDocument {
  id: string;
  standardCode: string; // e.g. "NASA-HDBK-4002A", "ECSS-Q-ST-60-15C"
  title: string;
  issuingOrg: 'NASA' | 'ESA' | 'ISRO' | 'NOAA' | 'DOD/MIL';
  revisionDate: string;
  section: string;
  normativeStatus: 'NORMATIVE' | 'INFORMATIVE' | 'RESEARCH_BASIS';
  excerpt: string;
  sourceUrl: string;
  applicability: string;
}

export interface ExtractedRule {
  id: string;
  ruleCode: string;
  documentId: string;
  summary: string;
  applicabilityCondition: string;
  recommendedAction: OperatingProfileId | 'TELEMETRY_DUMP' | 'OPERATOR_HOLD';
  voltageLimitMin?: number;
  voltageLimitMax?: number;
  maxAllowableTempC?: number;
  verifiedByHuman: boolean;
  verificationNotes: string;
}

export interface AgentRecommendation {
  id: string;
  timestamp: string;
  triggeringRulHours: number;
  triggeringRiskBand: RulRiskBand;
  proposedProfile: OperatingProfileId;
  reasoningTrace: string[];
  retrievedCitations: Array<{
    standardCode: string;
    section: string;
    text: string;
  }>;
  safetyValidation: {
    passed: boolean;
    voltageWithinPermittedRange: boolean;
    tempSafe: boolean;
    hardwareSupportsAdjustment: boolean;
    operatorApprovalRequired: boolean;
    rejectionReason?: string;
  };
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: 'STATE_TRANSITION' | 'RUL_BAND_CHANGE' | 'AGENT_RECOMMENDATION' | 'SAFETY_CHECK' | 'MITIGATION_EXECUTION' | 'OPERATOR_OVERRIDE' | 'SENSOR_ALERT';
  summary: string;
  details: Record<string, unknown>;
  author: 'AUTONOMOUS_POLICY' | 'REACT_AGENT' | 'OPERATOR_USER' | 'SAFETY_VALIDATOR';
}

export interface ExperimentRun {
  id: string;
  name: string;
  description: string;
  mode: 'A_NOMINAL' | 'B_RADIATION_UNMITIGATED' | 'C_POLICY_MITIGATED' | 'D_FAULT_TELEMETRY' | 'E_RAG_CITATION_BENCHMARK';
  status: 'IDLE' | 'RUNNING' | 'COMPLETED';
  results?: {
    rmsePinnVsOde: number;
    rmseMlVsOde: number;
    rulDegradationHours: number;
    recoveredRulHours?: number;
    rulesRetrievedCount: number;
    safetyViolationsBlocked: number;
    executiveSummary: string;
  };
}
