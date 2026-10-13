/**
 * Space Weather View (Page B)
 * Real NOAA GOES-16 SWPC proton flux ingestion, historical solar storm selector,
 * event tagging, and energy channel analysis.
 */

import React, { useState } from 'react';
import {
  Sun,
  Radio,
  RefreshCw,
  AlertOctagon,
  Clock,
  Database,
  Sliders,
  CheckCircle2,
  TrendingUp,
  Layers,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { SpaceWeatherRecord } from '../types';

interface SpaceWeatherViewProps {
  records: SpaceWeatherRecord[];
  isStale: boolean;
  lastUpdated: string;
  sourceType: string;
  onRefresh: () => void;
  onSelectScenario: (scenarioKey: string) => void;
  onGenerateSyntheticCme: (peakFlux: number) => void;
}

export const SpaceWeatherView: React.FC<SpaceWeatherViewProps> = ({
  records,
  isStale,
  lastUpdated,
  sourceType,
  onRefresh,
  onSelectScenario,
  onGenerateSyntheticCme
}) => {
  const [useLogScale, setUseLogScale] = useState(false);
  const [customPeak, setCustomPeak] = useState(5000);

  const latestRecord = records[records.length - 1];
  const maxFlux = Math.max(...records.map(r => r.flux), 1);
  const sScale = maxFlux >= 100000 ? 'S5 (Extreme)'
    : maxFlux >= 10000 ? 'S4 (Severe)'
    : maxFlux >= 1000 ? 'S3 (Strong)'
    : maxFlux >= 100 ? 'S2 (Moderate)'
    : maxFlux >= 10 ? 'S1 (Minor)'
    : 'S0 (Below Threshold)';

  // Chart dataset
  const chartData = records.map((r, i) => ({
    index: i,
    time: r.timeTag.includes('T') ? r.timeTag.split('T')[1].slice(0, 5) : `${i}h`,
    flux: r.flux,
    logFlux: Math.log10(Math.max(0.1, r.flux)),
    eventTag: r.eventTag
  }));

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header bar */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '24s' }} />
            <h1 className="text-lg font-bold font-display text-slate-100">
              NOAA Space Weather Prediction Center (GOES-16)
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              {sourceType}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Energy Channel: &ge;10 MeV | Units: pfu (protons &middot; cm<sup>-2</sup> &middot; s<sup>-1</sup> &middot; sr<sup>-1</sup>)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isStale && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/80 border border-amber-700 text-amber-300 text-xs font-mono">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>STALE / CACHED</span>
            </div>
          )}
          <div className="px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300">
            Updated: {new Date(lastUpdated).toLocaleTimeString()}
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-600/50 text-cyan-300 transition-colors"
            title="Refresh NOAA SWPC Feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-xs text-slate-400 font-mono block">Latest Flux (&ge;10 MeV)</span>
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {latestRecord?.flux.toFixed(1) || '0.0'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">pfu at detector</span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-xs text-slate-400 font-mono block">Peak Interval Flux</span>
          <span className="text-2xl font-bold font-mono text-amber-300">
            {maxFlux.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Maximum observed</span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-xs text-slate-400 font-mono block">NOAA S-Scale Level</span>
          <span className="text-2xl font-bold font-mono text-red-400">
            {sScale}
          </span>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Solar radiation storm index</span>
        </div>

        <div className="p-3.5 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-xs text-slate-400 font-mono block">Detector Satellite</span>
          <span className="text-2xl font-bold font-mono text-slate-200">
            {latestRecord?.satellite || 'GOES-16'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Geostationary Primary</span>
        </div>
      </div>

      {/* Time-Series Chart */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold tracking-wider text-slate-200 font-mono">
              INTEGRAL PROTON FLUX TIME-SERIES
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseLogScale(!useLogScale)}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 hover:text-cyan-300 transition-colors"
            >
              {useLogScale ? 'LOG10 SCALE' : 'LINEAR SCALE'}
            </button>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
                unit={useLogScale ? '' : ' pfu'}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#090e1d', borderColor: '#1e3a66', borderRadius: '8px' }}
                labelStyle={{ color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#e2e8f0', fontSize: '12px', fontFamily: 'monospace' }}
              />
              {/* S-Scale Thresholds */}
              <ReferenceLine y={useLogScale ? 2 : 100} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'S2 (100 pfu)', fill: '#f59e0b', fontSize: 10 }} />
              <ReferenceLine y={useLogScale ? 3 : 1000} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'S3 (1000 pfu)', fill: '#ef4444', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey={useLogScale ? 'logFlux' : 'flux'}
                stroke="#38bdf8"
                strokeWidth={2.2}
                dot={false}
                name={useLogScale ? 'log10(Flux)' : 'Flux (pfu)'}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scenario & Ingestion Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Historical Space Weather Scenarios */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Authoritative Historical Space Weather Events</span>
          </h3>
          <p className="text-xs text-slate-400">
            Select verified NASA/NOAA solar storm datasets to evaluate SciML PINN resilience against out-of-distribution CME spikes:
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onSelectScenario('CME_OCT2003_HALLOWEEN')}
              className="p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-red-500/50 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-red-300 block">Halloween Solar Storm (Oct 2003 CME)</span>
                <span className="text-[11px] text-slate-400">Peak flux 29,500 pfu (S4 Severe) | Extreme gate oxide degradation</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono">LOAD</span>
            </button>

            <button
              onClick={() => onSelectScenario('MAY_2024_G5_SUPERSTORM')}
              className="p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-amber-300 block">May 2024 G5 Solar Storm (AR3664)</span>
                <span className="text-[11px] text-slate-400">Sustained peak 3,800 pfu (S3 Strong) | Multi-day coronal mass ejection</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono">LOAD</span>
            </button>

            <button
              onClick={() => onSelectScenario('NOMINAL_SOLAR_QUIET')}
              className="p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 text-left transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-emerald-300 block">Nominal Solar Minimum (Quiet Background)</span>
                <span className="text-[11px] text-slate-400">Background GCR flux &lt; 1.5 pfu | Quiescent LEO space environment</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">LOAD</span>
            </button>
          </div>
        </div>

        {/* Custom Synthetic CME Generator */}
        <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Synthetic Event Generator (Stress Testing)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Generate synthetic high-energy proton injection profiles to test PINN generalization and Newton-Raphson RUL boundary conditions:
          </p>

          <div className="flex flex-col gap-2.5">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-400">Peak Proton Flux:</span>
                <span className="text-cyan-300 font-bold">{customPeak} pfu</span>
              </div>
              <input
                type="range"
                min="50"
                max="30000"
                step="250"
                value={customPeak}
                onChange={e => setCustomPeak(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <button
              onClick={() => onGenerateSyntheticCme(customPeak)}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-semibold text-xs tracking-wider transition-all shadow-md glow-cyan-sm mt-1"
            >
              INJECT SYNTHETIC CME EVENT ({customPeak} PFU)
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              Synthetic data is explicitly tagged with <code className="text-cyan-300">origin: 'SIMULATED'</code> to maintain distinction from physical space observations per aerospace audit standards.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
