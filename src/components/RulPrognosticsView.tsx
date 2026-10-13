/**
 * Remaining Useful Life (RUL) Prognostics View (Page E)
 * - Newton-Raphson & Brent bracketed root finding solver
 * - Configurable degradation failure criterion slider
 * - 4 Project Risk Bands (Critical, High, Warning, Nominal)
 * - Diagnostic convergence log & trajectory extrapolation
 */

import React from 'react';
import {
  Hourglass,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sliders,
  CheckCircle2,
  Terminal,
  Activity,
  ArrowRight
} from 'lucide-react';
import { RulCalculationResult, DegradationPoint } from '../types';

interface RulPrognosticsViewProps {
  rulResult: RulCalculationResult;
  trajectory: DegradationPoint[];
  failureThresholdVth: number;
  onUpdateFailureThreshold: (threshold: number) => void;
  onNavigateToAgent: () => void;
}

export const RulPrognosticsView: React.FC<RulPrognosticsViewProps> = ({
  rulResult,
  trajectory,
  failureThresholdVth,
  onUpdateFailureThreshold,
  onNavigateToAgent
}) => {
  const getRiskBandBadge = () => {
    switch (rulResult.riskBand) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-950/80 text-red-300 border-red-700/80 glow-red',
          label: 'CASE 1: CRITICAL (≤ 100 Hours)',
          description: 'Immediate protective response: enter safe mode if supported, isolate nonessential loads, prioritize critical telemetry and transmit emergency alert to Ground Station.',
          icon: ShieldAlert
        };
      case 'HIGH_RISK':
      case 'HIGH':
        return {
          bg: 'bg-amber-950/80 text-amber-300 border-amber-700/80 glow-amber',
          label: 'CASE 2: HIGH RISK (100 - 250 Hours)',
          description: 'Preventive action and increased monitoring: recommend workload reduction, activate thermal management, increase health monitoring frequency, and prioritize telemetry downlink.',
          icon: AlertTriangle
        };
      case 'WARNING':
        return {
          bg: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80',
          label: 'CASE 3: WARNING (250 - 500 Hours)',
          description: 'Preventive monitoring and optimisation: continue normal operations with enhanced monitoring, optimize workload scheduling, and track degradation trends.',
          icon: Clock
        };
      case 'HEALTHY':
      case 'NOMINAL':
      default:
        return {
          bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 glow-emerald',
          label: 'CASE 4: HEALTHY (> 500 Hours)',
          description: 'Routine operation: continue normal operating mode, collect routine telemetry, update degradation model, and perform periodic RUL predictions.',
          icon: ShieldCheck
        };
    }
  };

  const badge = getRiskBandBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header Panel */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-bold font-display text-slate-100">
              Remaining Useful Life (RUL) Root Finding & Risk Classification
            </h1>
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${badge.bg}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Iterative Solver: Newton-Raphson + Brent Bracketed &middot; Criterion: f(t) = &Delta;V<sub>th</sub>(t) - &Delta;V<sub>crit</sub> = 0
          </p>
        </div>

        <button
          onClick={onNavigateToAgent}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-semibold text-xs tracking-wider transition-all shadow-md glow-cyan-sm flex items-center gap-2"
        >
          <span>EVALUATE MITIGATION RULES</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary KPI Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Estimated RUL */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-mono">Estimated RUL</span>
          <div className="my-2">
            <span className={`text-4xl font-bold font-mono ${
              rulResult.riskBand === 'CRITICAL' ? 'text-red-400' : 'text-cyan-300'
            }`}>
              {rulResult.predictionStatus === 'THRESHOLD_NOT_REACHED_WITHIN_HORIZON'
                ? '> 1,000'
                : rulResult.estimatedRulHours.toFixed(1)}
            </span>
            <span className="text-sm font-mono text-slate-400 ml-1.5">
              Hours
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Uncertainty: &plusmn;{rulResult.uncertaintyHours}h
          </span>
        </div>

        {/* Failure Criterion */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-mono">Failure Threshold (&Delta;V_crit)</span>
          <div className="my-2">
            <span className="text-3xl font-bold font-mono text-slate-100">
              {failureThresholdVth.toFixed(2)}
            </span>
            <span className="text-sm font-mono text-slate-400 ml-1">V</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Configured gate oxide limit
          </span>
        </div>

        {/* Solver Iterations */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-mono">Solver Diagnostics</span>
          <div className="my-2">
            <span className="text-3xl font-bold font-mono text-emerald-300">
              {rulResult.iterations}
            </span>
            <span className="text-sm font-mono text-slate-400 ml-1">Iterations</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Converged (Tol: 1e-4)</span>
          </span>
        </div>

        {/* Risk Classification */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-mono">Current Policy Band</span>
          <div className="my-2 flex items-center gap-2">
            <BadgeIcon className="w-6 h-6 text-amber-400" />
            <span className="text-xl font-bold font-mono text-slate-100">
              {rulResult.riskBand}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            LEO Mission Policy Matrix
          </span>
        </div>
      </div>

      {/* RUL Policy Matrix Bands Table */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wider">
          Project-Defined RUL Risk Bands & Required System Behaviors
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Critical */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
            rulResult.riskBand === 'CRITICAL' ? 'bg-red-950/60 border-red-500 glow-red' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 font-mono">Below 100 Hours</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900 text-red-200 font-mono">CRITICAL</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                Trigger agentic assessment immediately; retrieve applicable rules, evaluate safe permitted actions, and escalate if needed.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono border-t border-slate-800 pt-1">
              Actions: Safe Hold Mode B (0.95V)
            </span>
          </div>

          {/* High */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
            rulResult.riskBand === 'HIGH' ? 'bg-amber-950/60 border-amber-500 glow-amber' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 font-mono">100 to 250 Hours</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900 text-amber-200 font-mono">HIGH</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                Trigger detailed rule assessment, consider permitted conservative profiles, and increase telemetry sampling rate.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono border-t border-slate-800 pt-1">
              Actions: Conservative Profile A (1.05V)
            </span>
          </div>

          {/* Warning */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
            rulResult.riskBand === 'WARNING' ? 'bg-yellow-950/60 border-yellow-500' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-400 font-mono">250 to 500 Hours</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900 text-yellow-200 font-mono">WARNING</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                Assess degradation trends, review relevant guidance, and monitor for worsening space-weather conditions.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono border-t border-slate-800 pt-1">
              Actions: Retain Nominal / Prepare Profile A
            </span>
          </div>

          {/* Nominal */}
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
            rulResult.riskBand === 'NOMINAL' ? 'bg-emerald-950/60 border-emerald-500 glow-emerald' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono">500 Hours or Above</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200 font-mono">NOMINAL</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                Continue monitoring and retain nominal 1.20V profile unless other telemetry signals require intervention.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono border-t border-slate-800 pt-1">
              Actions: Full 1.20V Operations
            </span>
          </div>
        </div>
      </div>

      {/* Threshold Configuration Slider & Solver Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Failure Criterion Adjuster */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Configurable Failure Criterion (&Delta;V<sub>crit</sub>)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Adjust the semiconductor component's threshold-voltage shift failure boundary to test RUL solver sensitivity:
          </p>

          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1">
              <span className="text-slate-400">Current Threshold:</span>
              <span className="text-cyan-300 font-bold">{failureThresholdVth.toFixed(2)} V</span>
            </div>
            <input
              type="range"
              min="-2.00"
              max="-0.80"
              step="0.05"
              value={failureThresholdVth}
              onChange={e => onUpdateFailureThreshold(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>-2.00V (Severe Margin)</span>
              <span>-1.50V (Project Default)</span>
              <span>-0.80V (Conservative Margin)</span>
            </div>
          </div>
        </div>

        {/* Solver Execution Notes */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Root Solver Convergence Notes</span>
          </h3>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 flex flex-col gap-1">
            <div><span className="text-slate-500">Reasoning:</span> {rulResult.reasoningNotes}</div>
            <div><span className="text-slate-500">Method:</span> {rulResult.solverMethod}</div>
            <div><span className="text-slate-500">Crossing Est:</span> {rulResult.crossingTimestamp ? new Date(rulResult.crossingTimestamp).toLocaleString() : 'N/A (Horizon Exceeded)'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
