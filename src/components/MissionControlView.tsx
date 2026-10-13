/**
 * Unified Mission Cockpit (Flagship Consolidated Dashboard)
 * Directly integrates Reference Image 1 (visual style, 3D Earth, PHM Prognostics, Radar)
 * and Reference Image 2 (SciML PINN, Newton-Raphson RUL, ReAct Agent RAG, Post-Action Health, Dual RGB LED).
 */

import React, { useState } from 'react';
import {
  Satellite,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Thermometer,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Gauge,
  Radio,
  Cpu,
  Layers,
  ArrowRight,
  Activity,
  Flame,
  CheckCircle2,
  RefreshCw,
  Sliders,
  History,
  TrendingUp,
  BrainCircuit,
  Terminal,
  RotateCcw,
  Bot
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ComposedChart
} from 'recharts';
import { EarthGlobe } from './EarthGlobe';
import { RadarWidget } from './RadarWidget';
import { AgentWorkflowController } from './AgentWorkflowController';
import { LiveNoaaProtonFluxGraph } from './LiveNoaaProtonFluxGraph';
import {
  HardwareTelemetry,
  SpaceWeatherRecord,
  DegradationPoint,
  RulCalculationResult,
  OperatingProfileId,
  AgentRecommendation,
  AuditLogEntry,
  WorkflowStatusState
} from '../types';
import { PREQUALIFIED_PROFILES } from '../services/aerospaceKnowledgeBase';

interface MissionControlViewProps {
  telemetry: HardwareTelemetry;
  spaceWeather: SpaceWeatherRecord[];
  trajectory: DegradationPoint[];
  rulResult: RulCalculationResult;
  agentRec?: AgentRecommendation;
  auditLogs: AuditLogEntry[];
  isAutonomousMode: boolean;
  workflow: WorkflowStatusState;
  cmeSeverityFlux?: number;
  onChangeCmeSeverityFlux?: (val: number) => void;
  onOpenAgent: () => void;
  onExecuteMitigation: (profileId: OperatingProfileId) => void;
  onSimulateCme: (peakFlux?: number) => void;
  onResetNominal: () => void;
  onToggleHardwareMode: () => void;
  failureThresholdVth: number;
  onUpdateFailureThreshold: (val: number) => void;
  onTriggerFullSequence: (flux?: number) => void;
  onOpenAlertModal: () => void;
}

export const MissionControlView: React.FC<MissionControlViewProps> = ({
  telemetry,
  spaceWeather,
  trajectory,
  rulResult,
  agentRec,
  auditLogs,
  isAutonomousMode,
  workflow,
  cmeSeverityFlux = 4500,
  onChangeCmeSeverityFlux,
  onOpenAgent,
  onExecuteMitigation,
  onSimulateCme,
  onResetNominal,
  onToggleHardwareMode,
  failureThresholdVth,
  onUpdateFailureThreshold,
  onTriggerFullSequence,
  onOpenAlertModal
}) => {
  const [quickQuery, setQuickQuery] = useState('');
  const latestFlux = spaceWeather[spaceWeather.length - 1]?.flux || 1.2;
  const isCmeSpike = latestFlux > 100 || rulResult.riskBand === 'CRITICAL' || rulResult.riskBand === 'HIGH' || rulResult.riskBand === 'HIGH_RISK';
  const isThreatActive = isCmeSpike;
  const isRecovered = telemetry.activeProfile !== 'NOMINAL';
  const currentProfile = PREQUALIFIED_PROFILES[telemetry.activeProfile] || PREQUALIFIED_PROFILES.NOMINAL;

  // Incident Timeline comparison: Initial nominal health (100h), sharp fall during CME flare to 20.1h,
  // followed by autonomous mitigation recovery rising back up to 44.1h
  const origLife = workflow.preMitigationRul !== undefined 
    ? workflow.preMitigationRul 
    : (isCmeSpike ? 20.1 : 100);

  const targetRecoveredLife = isRecovered 
    ? (workflow.postMitigationRul !== undefined 
        ? workflow.postMitigationRul 
        : (rulResult.estimatedRulHours > 0 ? rulResult.estimatedRulHours : 44.1))
    : origLife;

  const comparisonData = [
    { hour: 0, originalRul: 100, recoveredRul: 100 },
    { hour: 10, originalRul: 75, recoveredRul: 75 },
    { hour: 25, originalRul: 48, recoveredRul: 48 },
    { hour: 40, originalRul: origLife, recoveredRul: origLife },
    {
      hour: 55,
      originalRul: Math.max(0, Number((origLife * 0.5).toFixed(1))),
      recoveredRul: isRecovered
        ? Number((origLife + (targetRecoveredLife - origLife) * 0.55).toFixed(1))
        : Math.max(0, Number((origLife * 0.5).toFixed(1)))
    },
    {
      hour: 70,
      originalRul: 0,
      recoveredRul: isRecovered
        ? Number((origLife + (targetRecoveredLife - origLife) * 0.88).toFixed(1))
        : 0
    },
    {
      hour: 85,
      originalRul: 0,
      recoveredRul: isRecovered ? targetRecoveredLife : 0
    },
    {
      hour: 100,
      originalRul: 0,
      recoveredRul: isRecovered ? targetRecoveredLife : 0
    }
  ];

  const getRiskBandBadge = () => {
    switch (rulResult.riskBand) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-950/80 text-red-300 border-red-700/80 glow-red',
          label: 'CASE 1: CRITICAL (≤100h)',
          icon: ShieldAlert
        };
      case 'HIGH_RISK':
      case 'HIGH':
        return {
          bg: 'bg-amber-950/80 text-amber-300 border-amber-700/80 glow-amber',
          label: 'CASE 2: HIGH RISK (100–250h)',
          icon: AlertTriangle
        };
      case 'WARNING':
        return {
          bg: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80',
          label: 'CASE 3: WARNING (250–500h)',
          icon: Clock
        };
      case 'HEALTHY':
      case 'NOMINAL':
      default:
        return {
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 glow-emerald',
          label: 'CASE 4: HEALTHY (>500h)',
          icon: ShieldCheck
        };
    }
  };

  const badge = getRiskBandBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="w-full flex flex-col gap-5">
      
      {/* Interactive Agent Workflow Controller (Red Alert -> RUL Calc -> RAG Thinking -> DVFS Cut -> Recovery -> Downlink) */}
      <AgentWorkflowController
        workflow={workflow}
        telemetry={telemetry}
        latestFlux={latestFlux}
        currentRul={rulResult.estimatedRulHours}
        riskBand={rulResult.riskBand}
        onTriggerFullSequence={() => onTriggerFullSequence(cmeSeverityFlux)}
        onResetSequence={onResetNominal}
        onOpenAlertModal={onOpenAlertModal}
      />

      {/* Main 3-Column Grid Matching Reference Image 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ================= LEFT COLUMN: AVIONICS PROGNOSTICS & HEALTH (Cols 1-3) ================= */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-cyan-900/40">
              <h2 className="text-xs font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-2 font-mono">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>PROGNOSTICS & HEALTH (PHM)</span>
              </h2>
              {onOpenAlertModal && (
                <button
                  onClick={onOpenAlertModal}
                  className="text-[10px] px-2 py-1 rounded-lg font-mono font-bold border border-cyan-700/60 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/60 transition-colors flex items-center gap-1 shadow-sm"
                  title="Open Sat - M1 FDIR Flight Console"
                >
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  <span>FDIR HUD</span>
                </button>
              )}
            </div>

            {/* Card 1: Prediction */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-2 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Prediction</span>
                <span className="text-[10px] text-cyan-400 font-mono">SciML PINN</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center p-1">
                  <Satellite className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-mono">Satellite Payload</span>
                  <span className="text-sm font-bold text-slate-100">Sat - M1 (COTS Node)</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isThreatActive ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className="text-[11px] text-amber-300 font-mono">
                      ΔVth: {trajectory[trajectory.length - 1]?.deltaVthPinn.toFixed(3) || '0.000'} V
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Semi-empirical MOS charge transport differential equation embedded in neural surrogate. Tracks trap accumulation under {latestFlux.toFixed(1)} pfu proton fluence.
              </p>
            </div>

            {/* Card 2: About to Expire / RUL Countdown */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-2 relative overflow-hidden transition-all ${
              workflow.phase === 'RED_ALERT'
                ? 'bg-red-950/60 border-red-500 glow-red animate-pulse'
                : workflow.phase === 'ESTIMATING_RUL'
                ? 'bg-amber-950/60 border-amber-500 glow-amber'
                : isRecovered || workflow.phase === 'MISSION_STABILIZED'
                ? 'bg-emerald-950/30 border-emerald-600/60 glow-emerald'
                : rulResult.riskBand === 'CRITICAL' || rulResult.riskBand === 'CRITICAL_24H'
                ? 'bg-red-950/40 border-red-800/60'
                : 'bg-slate-900/60 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Prognostics</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  workflow.phase === 'RED_ALERT'
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : workflow.phase === 'ESTIMATING_RUL'
                    ? 'bg-amber-950 text-amber-300 border-amber-500 animate-pulse'
                    : isRecovered || workflow.phase === 'MISSION_STABILIZED'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                    : badge.bg
                }`}>
                  {workflow.phase === 'RED_ALERT'
                    ? 'STAGE 1: TRIAGE'
                    : workflow.phase === 'ESTIMATING_RUL'
                    ? 'STAGE 2: SOLVING...'
                    : isRecovered || workflow.phase === 'MISSION_STABILIZED'
                    ? `RECOVERED (${rulResult.estimatedRulHours.toFixed(0)}h)`
                    : badge.label}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-mono">
                  {workflow.phase === 'RED_ALERT'
                    ? 'Stage 1: CME Anomaly Flagged (Pending PINN Solver)'
                    : workflow.phase === 'ESTIMATING_RUL'
                    ? 'Newton-Raphson Solving...'
                    : 'Newton-Raphson RUL'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold font-mono ${
                    workflow.phase === 'RED_ALERT'
                      ? 'text-red-400 animate-pulse'
                      : workflow.phase === 'ESTIMATING_RUL'
                      ? 'text-amber-300 animate-pulse'
                      : rulResult.estimatedRulHours >= 150
                      ? 'text-emerald-400'
                      : rulResult.riskBand === 'CRITICAL' || rulResult.riskBand === 'CRITICAL_24H'
                      ? 'text-red-400'
                      : 'text-slate-100'
                  }`}>
                    {workflow.phase === 'RED_ALERT'
                      ? 'PENDING PINN SOLVER'
                      : workflow.phase === 'ESTIMATING_RUL'
                      ? 'SOLVING ROOT...'
                      : rulResult.predictionStatus === 'THRESHOLD_NOT_REACHED_WITHIN_HORIZON'
                      ? `> 1,000 Hours (${Math.round(rulResult.estimatedRulHours).toLocaleString()}h Nominal)`
                      : `${rulResult.estimatedRulHours.toFixed(1)} Hours`}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">to ΔV_crit ({failureThresholdVth}V)</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                <span>
                  {workflow.phase === 'RED_ALERT'
                    ? 'Solver: Standby for Stage 2'
                    : workflow.phase === 'ESTIMATING_RUL'
                    ? `Solver: Iteration ${workflow.solverIteration || 3}/4`
                    : `Solver: ${rulResult.iterations} iters`}
                </span>
                <span className="text-cyan-400">
                  {workflow.phase === 'RED_ALERT'
                    ? 'Pre-estimation'
                    : workflow.phase === 'ESTIMATING_RUL'
                    ? 'Root Finding'
                    : 'Tolerance: 1e-4'}
                </span>
              </div>
            </div>

            {/* Card 3: Autonomous Agent Recommendation & Knowledge Base Check */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
              workflow.phase === 'AGENT_REASONING_RAG'
                ? 'bg-cyan-950/70 border-cyan-400 glow-cyan animate-pulse'
                : 'bg-slate-900/60 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Autonomous Mitigation</span>
                <span className={`text-[10px] font-mono font-bold ${
                  workflow.phase === 'AGENT_REASONING_RAG'
                    ? 'text-cyan-300 animate-pulse'
                    : isRecovered
                    ? 'text-emerald-400'
                    : 'text-cyan-400'
                }`}>
                  {workflow.phase === 'AGENT_REASONING_RAG'
                    ? 'RAG RULE MATCHING...'
                    : isRecovered
                    ? 'PROFILE APPLIED'
                    : 'RULE-GROUNDED'}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/60 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {isRecovered ? 'Safe Hold Mode B (0.95V applied)' : 'Safe Hold Mode B (0.95V)'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Rule: NASA-HDBK-4002A Sec 5.3.2 &middot; ECSS-Q-ST-60-15C
                  </span>
                </div>
              </div>

              {/* RUL Evaluation Band Checklist requested by user */}
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono text-slate-400 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span>&lt; 24h &amp; &lt; 100h:</span>
                  <span className="text-red-400 font-bold">EMERGENCY SAFE MODE (DVFS 0.95V)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>100h &le; RUL &lt; 250h:</span>
                  <span className="text-amber-400">Profile A (1.05V, clock -25%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>250h &le; RUL &lt; 500h:</span>
                  <span className="text-yellow-400">Warning (Duty cycle 75%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>500h &le; RUL &lt; 1000h:</span>
                  <span className="text-slate-400">Advisory Baseline</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>&ge; 1000h:</span>
                  <span className="text-emerald-400">Nominal Science (1.20V)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Duty: {(currentProfile.dutyCycle * 100).toFixed(0)}%</span>
                <button
                  onClick={onOpenAgent}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                >
                  <span>Agent Trace</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Center Column: Glowing Earth & Directives (Cols 4-8) */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          
          {/* Glowing Earth Globe Panel */}
          <div className="relative rounded-2xl glass-panel border border-cyan-900/40 p-4 min-h-[460px] flex flex-col justify-between overflow-hidden">
            
            {/* Top Subheader with Live Proton Flux */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono text-cyan-300 tracking-wider">
                  EARTH OBSERVATION / LEO RADIATION PASS
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <span className="text-slate-400">FLUX (&gt;10 MeV):</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  latestFlux > 100 ? 'bg-red-950 text-red-300 border border-red-700' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}>
                  {latestFlux.toFixed(1)} pfu
                </span>
              </div>
            </div>

            {/* Earth Globe Canvas */}
            <div className="relative flex-1 w-full my-1">
              <EarthGlobe
                satelliteName="Sat - M1"
                altitudeKm={450}
                velocityKmS={7.3}
                isThreatDetected={isCmeSpike}
              />
            </div>

            {/* Quick Directive / Natural Language Input Bar */}
            <div className="relative z-10 w-full max-w-xl mx-auto mt-2">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-cyan-400" />
                <input
                  type="text"
                  value={quickQuery}
                  onChange={e => setQuickQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') onOpenAgent();
                  }}
                  placeholder="Give directive or query standards (e.g. 'Simulate CME flare', 'NASA-HDBK-4002A limits')..."
                  className="w-full pl-10 pr-24 py-2.5 rounded-full bg-slate-950/80 border border-cyan-600/30 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-inner font-sans"
                />
                <button
                  onClick={onOpenAgent}
                  className="absolute right-1.5 px-3 py-1 rounded-full bg-cyan-900/60 hover:bg-cyan-800/80 text-cyan-200 text-xs font-mono border border-cyan-500/40 transition-colors"
                >
                  ASK AGENT
                </button>
              </div>
            </div>

          </div>

          {/* Quick Space-Weather Anomaly Injection Strip */}
          <div className="p-3 rounded-xl glass-panel-subtle border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Flame className="w-4 h-4 text-red-400" />
              <span>Simulate Solar Environment:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSimulateCme(3800)}
                className="px-3 py-1 rounded-lg bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-800/60 text-xs transition-colors"
              >
                CME Spike (3,800 pfu)
              </button>
              <button
                onClick={() => onSimulateCme(12000)}
                className="px-3 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 text-xs transition-colors"
              >
                Severe S4 Flare (12,000 pfu)
              </button>
              <button
                onClick={onResetNominal}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Quiet Baseline</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Code Sat - M1 & Radar (Cols 9-12) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          
          <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-xs text-slate-400 font-mono uppercase">Code</span>
                <h3 className="text-lg font-bold font-display text-cyan-300">Sat - M1</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                NORAD #54192
              </span>
            </div>

            {/* Orbital Parameters 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono block">Current Altitude</span>
                <span className="text-sm font-bold font-mono text-slate-100">450 KM</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono block">Orbital Velocity</span>
                <span className="text-sm font-bold font-mono text-slate-100">7.3 KM/S</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono block">Orbital Period</span>
                <span className="text-sm font-bold font-mono text-slate-100">78 MIN</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono block">Type of Orbit</span>
                <span className="text-sm font-bold font-mono text-slate-100">550 SSO</span>
              </div>
            </div>

            {/* Radar Widget (Reference Image 1) */}
            <RadarWidget isAlert={isCmeSpike} />

            {/* Hardware Telemetry Live Summary */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-mono uppercase">Hardware Rail (ESP32)</span>
                <button
                  onClick={onToggleHardwareMode}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-mono border border-cyan-800/60 transition-colors"
                >
                  {telemetry.connectionMode}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Vdd: {telemetry.vdd.toFixed(2)}V</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>T_probe: {telemetry.probeTempC.toFixed(1)}°C</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  <span>I: {telemetry.currentMa.toFixed(1)}mA</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>P: {telemetry.powerMw.toFixed(1)}mW</span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Ack:</span>
                <span className="font-semibold text-cyan-300 truncate max-w-[170px]">{telemetry.lastCommandAck}</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ================= SECTION 2: INTEGRATED SCIML PINN & POST-ACTION HEALTH (Image 2 Architecture) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left: Physics-Informed Neural Network vs RK4 ODE vs ML Baseline */}
        <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                PINN Model: Vth Threshold Shift (&Delta;Vth Trajectory)
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
              d(&Delta;Vth)/dt = &kappa;&Phi; - &gamma;(T)&Delta;Vth
            </span>
          </div>

          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trajectory} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
                <XAxis dataKey="timeHours" stroke="#64748b" tick={{ fontSize: 10 }} unit="h" />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[-2.2, 0.1]} unit="V" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090e1d', borderColor: '#1e3a66', borderRadius: '8px' }}
                  labelStyle={{ color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <ReferenceLine
                  y={failureThresholdVth}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `Threshold (${failureThresholdVth}V)`, fill: '#ef4444', fontSize: 10, position: 'top' }}
                />
                <Line
                  type="monotone"
                  dataKey="deltaVthOde"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  name="Physical RK4 ODE Baseline"
                />
                <Line
                  type="monotone"
                  dataKey="deltaVthPinn"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="PINN SciML Prediction"
                />
                <Line
                  type="monotone"
                  dataKey="deltaVthMlBaseline"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Unconstrained ML Drift"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Residual Loss: |L_phys| &lt; 1e-4</span>
            <span className="text-emerald-400">PINN Constrained (No Domain Drift)</span>
          </div>
        </div>

        {/* Right: Post-Action System Health & Dual RGB LED (Matching Image 2) */}
        <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Post-Action System Health (Orig. Decay vs Recovered RUL)
              </h3>
            </div>

            {/* RGB Status LED (Directly from Reference Image 2) */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono">RGB LED:</span>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    !isRecovered ? 'bg-red-500 shadow-md shadow-red-500/80 animate-pulse' : 'bg-red-950 border border-red-900'
                  }`}
                  title="RED LED: Threat Detected"
                />
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    isRecovered ? 'bg-emerald-400 shadow-md shadow-emerald-400/80 animate-pulse' : 'bg-emerald-950 border border-emerald-900'
                  }`}
                  title="GREEN LED: Recovered & Protected"
                />
              </div>
            </div>
          </div>

          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} unit="h" />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="h" domain={[0, 110]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090e1d', borderColor: '#1e3a66', borderRadius: '8px' }}
                  labelStyle={{ color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Line
                  type="monotone"
                  dataKey="originalRul"
                  stroke="#ef4444"
                  strokeWidth={2.2}
                  dot={false}
                  name={`Unmitigated CME Decay (${origLife.toFixed(1)}h)`}
                />
                <Line
                  type="monotone"
                  dataKey="recoveredRul"
                  stroke="#22c55e"
                  strokeWidth={2.2}
                  dot={false}
                  name={isRecovered ? `Recovered RUL (${targetRecoveredLife.toFixed(1)} Hours)` : 'Recovered RUL (Standby)'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
            <span className="font-bold">
              {isRecovered ? `RECOVERED RUL: ${targetRecoveredLife.toFixed(1)} HOURS` : `ORIGIN DECAY: ${origLife.toFixed(1)} HOURS`}
            </span>
            <span className="text-slate-300">
              {isRecovered ? 'Core Vdd: 0.95V | Temp: 28.5°C' : 'Core Vdd: 1.20V | Temp: 45.0°C'}
            </span>
          </div>
        </div>

      </div>

      {/* ================= SECTION 3: IMMUTABLE AUDIT TRAIL LOG ================= */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
              Autonomous Operations Audit Trail
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {auditLogs.length} Events Persisted
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Agent / Actor</th>
                <th className="pb-2">Summary</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {auditLogs.slice(0, 5).map(log => (
                <tr key={log.id} className="hover:bg-slate-900/40">
                  <td className="py-2 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300">
                      {log.eventType}
                    </span>
                  </td>
                  <td className="py-2 text-slate-300">{log.author}</td>
                  <td className="py-2 text-slate-200 max-w-sm truncate">{log.summary}</td>
                  <td className="py-2 text-slate-400 font-sans text-[10px] truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= SECTION 4: LIVE NOAA / NASA GOES PROTON FLUX (PRIMARY SWPC DATASET) ================= */}
      <LiveNoaaProtonFluxGraph
        activeSpikeFlux={cmeSeverityFlux || latestFlux}
        satelliteName="Sat - M1"
      />

    </div>
  );
};
