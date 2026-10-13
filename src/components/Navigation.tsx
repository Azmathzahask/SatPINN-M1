/**
 * Consolidated Aerospace Mission Control Navigation Header
 * Matches Reference Image 1 with streamlined views, Autonomous Mode switch,
 * and omnipresent Agent status.
 */

import React from 'react';
import {
  Satellite,
  Bot,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  LayoutDashboard,
  Radio
} from 'lucide-react';
import { RulRiskBand } from '../types';

export type MainView = 'cockpit' | 'standards' | 'comms';

interface NavigationProps {
  currentView: MainView;
  onViewChange: (view: MainView) => void;
  riskBand: RulRiskBand;
  estimatedRulHours: number;
  isThreatActive: boolean;
  isAutonomousMode: boolean;
  workflowPhase?: string;
  onToggleAutonomous: () => void;
  onOpenAgent: () => void;
  onSimulateCme: () => void;
  onOpenAlertModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onViewChange,
  riskBand,
  estimatedRulHours,
  isThreatActive,
  isAutonomousMode,
  workflowPhase,
  onToggleAutonomous,
  onOpenAgent,
  onSimulateCme,
  onOpenAlertModal
}) => {
  const getRiskColor = (band: RulRiskBand) => {
    switch (band) {
      case 'CRITICAL': return 'bg-red-500 text-white shadow-red-500/50';
      case 'HIGH_RISK':
      case 'HIGH': return 'bg-amber-500 text-slate-950 shadow-amber-500/50';
      case 'WARNING': return 'bg-yellow-400 text-slate-950 shadow-yellow-400/50';
      case 'HEALTHY':
      case 'NOMINAL': return 'bg-emerald-500 text-slate-950 shadow-emerald-500/50';
      default: return 'bg-slate-600 text-slate-100';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full px-4 lg:px-6 py-2.5 bg-[#030712]/90 backdrop-blur-xl border-b border-cyan-900/30">
      <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
        
        {/* Brand & Satellite Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-600/30 to-indigo-900/40 border border-cyan-400/40 flex items-center justify-center glow-cyan-sm">
            <Satellite className="w-5 h-5 text-cyan-300 animate-pulse" />
            {isThreatActive && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-slate-950 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wide text-slate-100">Sat - M1</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
                LEO-SSO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              SciML PINN &middot; Autonomous Mitigation
            </p>
          </div>
        </div>

        {/* Center Mode Controls & Clean View Switcher */}
        <div className="flex items-center gap-2">
          {/* Main View Buttons */}
          <div className="flex items-center p-1 rounded-full bg-slate-950/80 border border-slate-800/80 shadow-inner">
            <button
              onClick={() => onViewChange('cockpit')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentView === 'cockpit'
                  ? 'bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 border border-cyan-400/50 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Mission Console</span>
            </button>
            <button
              onClick={() => onViewChange('standards')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentView === 'standards'
                  ? 'bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 border border-cyan-400/50 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Aerospace RAG Standards</span>
            </button>
            <button
              onClick={() => onViewChange('comms')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                currentView === 'comms'
                  ? 'bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 border border-cyan-400/50 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Satellite Communication</span>
            </button>
          </div>
        </div>

        {/* Right Status Indicators & Autonomous Agent Controls */}
        <div className="flex items-center gap-2.5">
          {/* Autonomous Flight Mode Toggle */}
          <button
            onClick={onToggleAutonomous}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-all ${
              isAutonomousMode
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500 glow-emerald'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
            title="Toggle autonomous closed-loop agent mitigation"
          >
            <span className={`w-2 h-2 rounded-full ${isAutonomousMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isAutonomousMode ? 'AUTONOMOUS AGENT: ACTIVE' : 'MANUAL OVERRIDE'}</span>
          </button>

          {/* RUL Status Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">RUL:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              workflowPhase === 'RED_ALERT'
                ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                : workflowPhase === 'ESTIMATING_RUL'
                ? 'bg-amber-950 text-amber-300 border border-amber-500 animate-pulse'
                : getRiskColor(riskBand)
            }`}>
              {workflowPhase === 'RED_ALERT'
                ? 'PENDING (STAGE 2)'
                : workflowPhase === 'ESTIMATING_RUL'
                ? 'SOLVING ODE...'
                : `${estimatedRulHours.toFixed(1)}h`}
            </span>
          </div>

          {/* Flight Operations FDIR Console Trigger */}
          <button
            onClick={onOpenAlertModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all border ${
              isThreatActive
                ? 'bg-red-950/90 text-red-200 border-red-500 glow-red animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-800/60'
            }`}
            title="Open Sat - M1 Autonomous FDIR Flight Console"
          >
            {isThreatActive ? (
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-bounce" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="hidden sm:inline">FDIR CONSOLE</span>
          </button>

          {/* Omnipresent Agent Drawer Trigger */}
          <button
            onClick={onOpenAgent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-semibold text-xs tracking-wider transition-all shadow-md glow-cyan-sm"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AGENT CO-PILOT</span>
          </button>
        </div>

      </div>
    </header>
  );
};
