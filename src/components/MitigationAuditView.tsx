/**
 * Mitigation & Audit View (Page G)
 * Matches Reference Image 2 right side:
 * - Pre-Action vs Post-Action comparison (Origin vs Recovered RUL)
 * - RGB Status LED (RED -> GREEN)
 * - Command telemetry acknowledgement
 * - Immutable SQLite/Audit Log trail
 */

import React from 'react';
import {
  ShieldCheck,
  Zap,
  Thermometer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  Cpu,
  Layers,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  HardwareTelemetry,
  AuditLogEntry,
  OperatingProfileId,
  RulCalculationResult
} from '../types';
import { PREQUALIFIED_PROFILES } from '../services/aerospaceKnowledgeBase';

interface MitigationAuditViewProps {
  telemetry: HardwareTelemetry;
  auditLogs: AuditLogEntry[];
  rulResult: RulCalculationResult;
  onExecuteProfile: (profileId: OperatingProfileId) => void;
}

export const MitigationAuditView: React.FC<MitigationAuditViewProps> = ({
  telemetry,
  auditLogs,
  rulResult,
  onExecuteProfile
}) => {
  const isRecovered = telemetry.activeProfile !== 'NOMINAL';
  const currentProfile = PREQUALIFIED_PROFILES[telemetry.activeProfile] || PREQUALIFIED_PROFILES.NOMINAL;

  // Comparison curve data: Pre-Action decay vs Post-Action recovery
  const comparisonData = [
    { hour: 0, originalRul: 100, recoveredRul: 100 },
    { hour: 10, originalRul: 75, recoveredRul: 75 },
    { hour: 25, originalRul: 48, recoveredRul: 48 },
    { hour: 40, originalRul: 25, recoveredRul: 25 },
    { hour: 50, originalRul: 14, recoveredRul: isRecovered ? 38 : 14 },
    { hour: 75, originalRul: 0, recoveredRul: isRecovered ? 85 : 0 },
    { hour: 100, originalRul: 0, recoveredRul: isRecovered ? 135 : 0 },
    { hour: 150, originalRul: 0, recoveredRul: isRecovered ? 172 : 0 },
    { hour: 200, originalRul: 0, recoveredRul: isRecovered ? 185 : 0 },
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header Panel */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-bold font-display text-slate-100">
              Mitigation Actuation, Post-Action Health & Audit Log
            </h1>
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
              isRecovered ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-800 text-slate-300'
            }`}>
              {isRecovered ? 'MITIGATION ACTIVE' : 'NOMINAL PROFILE'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Reference Architecture 2: Pre-Action vs Post-Action Trajectory &middot; Hardware Acknowledgement &middot; Audit Trail
          </p>
        </div>

        {/* RGB Status LED (Matching Reference Image 2) */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-mono block">RGB STATUS LED</span>
            <span className="text-xs font-bold font-mono text-slate-200">
              {isRecovered ? 'GREEN (HEALTHY)' : 'RED / MONITOR'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full transition-all ${
              !isRecovered ? 'bg-red-500 shadow-md shadow-red-500/80 animate-pulse' : 'bg-red-950 border border-red-900'
            }`} title="Red LED" />
            <div className={`w-4 h-4 rounded-full transition-all ${
              isRecovered ? 'bg-emerald-400 shadow-md shadow-emerald-400/80 animate-pulse' : 'bg-emerald-950 border border-emerald-900'
            }`} title="Green LED" />
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison: Pre-Action vs Post-Action Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pre-Action Card */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-red-900/40 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-red-400 font-bold uppercase tracking-wider">
                Pre-Action State (Unmitigated)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono">
                CRITICAL THREAT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Supply Voltage (Vdd)</span>
                <span className="text-base font-bold text-slate-100">1.20 V</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Probe Temp (DS18B20)</span>
                <span className="text-base font-bold text-amber-300">45.0 °C</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Active Operating Profile</span>
                <span className="text-xs font-semibold text-slate-200">NOMINAL (100% Clock)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Unmitigated RUL</span>
                <span className="text-base font-bold text-red-400">14.0 Hours</span>
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-red-950/40 border border-red-900/50 text-[11px] text-red-300 font-mono">
            High gate electric field accelerates hole trapping in SiO<sub>2</sub> layer, crossing critical -1.50V margin within 14h.
          </div>
        </div>

        {/* Post-Action Card (Reference Image 2 Result) */}
        <div className={`p-4 rounded-xl glass-panel-subtle border flex flex-col justify-between gap-3 ${
          isRecovered ? 'border-emerald-700/60 glow-emerald' : 'border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                Post-Action System Health (Mitigated)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                {isRecovered ? 'PROFILE APPLIED' : 'READY TO ACTUATE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Reduced Vdd</span>
                <span className="text-base font-bold text-emerald-300">{telemetry.vdd.toFixed(2)} V</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Reduced Temp</span>
                <span className="text-base font-bold text-emerald-300">{telemetry.probeTempC.toFixed(1)} °C</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Active Profile</span>
                <span className="text-xs font-semibold text-slate-200">{currentProfile.name}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Recovered RUL</span>
                <span className="text-base font-bold text-emerald-400">
                  {isRecovered ? '180+ Hours' : 'Pending Actuation'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-900/50 text-[11px] text-emerald-300 font-mono">
            {isRecovered
              ? `Hardware ACK: ${telemetry.lastCommandAck}. Lowered thermal stress & clock duty extends operational life.`
              : 'Execute mitigation to down-regulate core voltage to 0.95V per NASA-HDBK-4002A.'}
          </div>
        </div>
      </div>

      {/* Trajectory Plot: Original RUL Decay vs Recovered RUL (Reference Image 2 graph) */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold tracking-wider text-slate-200 font-mono">
              PRE-ACTION VS POST-ACTION RUL EXTENSION TRAJECTORY
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-400">
            {isRecovered ? 'RECOVERED RUL: 180+ HOURS' : 'ORIGIN RUL DECAY: 14 HOURS'}
          </span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} unit="h" />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="h" domain={[0, 200]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#090e1d', borderColor: '#1e3a66', borderRadius: '8px' }}
                labelStyle={{ color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
              <Line
                type="monotone"
                dataKey="originalRul"
                stroke="#ef4444"
                strokeWidth={2.4}
                dot={false}
                name="Original Unmitigated RUL Decay"
              />
              <Line
                type="monotone"
                dataKey="recoveredRul"
                stroke="#22c55e"
                strokeWidth={2.4}
                dot={false}
                name="Post-Action Recovered RUL Trajectory"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Mission Operations Audit Trail ({auditLogs.length} Records)</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">SQLite / Persistent State</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Event Type</th>
                <th className="pb-2">Author</th>
                <th className="pb-2">Summary</th>
                <th className="pb-2">Command Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {auditLogs.slice(0, 8).map(log => (
                <tr key={log.id} className="hover:bg-slate-900/40">
                  <td className="py-2.5 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300">
                      {log.eventType}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-300">{log.author}</td>
                  <td className="py-2.5 text-slate-200 max-w-xs truncate">{log.summary}</td>
                  <td className="py-2.5 text-slate-400 font-sans text-[11px] truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
