/**
 * Autonomous Agent Workflow Controller
 * Implements the exact sequence requested:
 * 1. Red Alert for 5 seconds
 * 2. "Estimating RUL": Calculates and displays degraded RUL
 * 3. Thinks for 5 seconds evaluating RAG knowledge base for RUL bands (<100, 100-250, 250-500, 500-1000, >1000)
 * 4. Takes voltage reduction action (DVFS cut to 0.95V), causing a major RUL increase to 180+ hours
 * 5. Retrieves post-mitigation safety rules and executes Ground Station telemetry downlink
 */

import React from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  BrainCircuit,
  Bot,
  Zap,
  Radio,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  Play,
  RotateCcw,
  Flame,
  FileText,
  Send,
  Database
} from 'lucide-react';
import {
  WorkflowStatusState,
  RulRiskBand,
  OperatingProfileId,
  HardwareTelemetry
} from '../types';

interface AgentWorkflowControllerProps {
  workflow: WorkflowStatusState;
  telemetry: HardwareTelemetry;
  latestFlux: number;
  currentRul: number;
  riskBand: RulRiskBand;
  onTriggerFullSequence: () => void;
  onResetSequence: () => void;
  onOpenAlertModal?: () => void;
}

export const AgentWorkflowController: React.FC<AgentWorkflowControllerProps> = ({
  workflow,
  telemetry,
  latestFlux,
  currentRul,
  riskBand,
  onTriggerFullSequence,
  onResetSequence,
  onOpenAlertModal
}) => {
  const isRunning = workflow.phase !== 'IDLE_NOMINAL' && workflow.phase !== 'MISSION_STABILIZED';

  // Get Phase Step Index (1 to 6)
  const getPhaseStep = () => {
    switch (workflow.phase) {
      case 'RED_ALERT': return 1;
      case 'ESTIMATING_RUL': return 2;
      case 'AGENT_REASONING_RAG': return 3;
      case 'EXECUTING_MITIGATION': return 4;
      case 'RECALCULATING_RECOVERY': return 5;
      case 'POST_MITIGATION_RAG': return 5;
      case 'MISSION_STABILIZED': return 6;
      default: return 0;
    }
  };

  const currentStep = getPhaseStep();

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top Banner Control & Sequence Trigger */}
      <div className={`p-4 rounded-2xl glass-panel border transition-all ${
        workflow.phase === 'RED_ALERT'
          ? 'border-red-500/80 bg-red-950/40 glow-red animate-pulse'
          : workflow.phase === 'AGENT_REASONING_RAG'
          ? 'border-cyan-500/80 bg-cyan-950/40 glow-cyan'
          : workflow.phase === 'MISSION_STABILIZED'
          ? 'border-emerald-500/80 bg-emerald-950/30 glow-emerald'
          : 'border-cyan-900/40'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
              workflow.phase === 'RED_ALERT'
                ? 'bg-red-900/70 border-red-500 text-red-200 animate-bounce'
                : workflow.phase === 'AGENT_REASONING_RAG'
                ? 'bg-cyan-900/70 border-cyan-500 text-cyan-200 animate-spin'
                : workflow.phase === 'MISSION_STABILIZED'
                ? 'bg-emerald-900/70 border-emerald-500 text-emerald-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`} style={{ animationDuration: '3s' }}>
              {workflow.phase === 'RED_ALERT' ? (
                <ShieldAlert className="w-5 h-5 text-red-400" />
              ) : workflow.phase === 'AGENT_REASONING_RAG' ? (
                <Bot className="w-5 h-5 text-cyan-400" />
              ) : workflow.phase === 'MISSION_STABILIZED' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold font-display tracking-wider text-slate-100 uppercase">
                  {workflow.phaseTitle}
                </h2>
                {isRunning && (
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                    workflow.phase === 'RED_ALERT'
                      ? 'bg-red-900 text-red-100 border border-red-500 animate-pulse'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-500 animate-pulse'
                  }`}>
                    PHASE {currentStep}/6 IN PROGRESS
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5 max-w-2xl">
                {workflow.phaseDetails}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAlertModal && (
              <button
                onClick={onOpenAlertModal}
                className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-700/60 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
                title="Open Sat - M1 FDIR Flight Console"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">FDIR HUD</span>
              </button>
            )}

            <button
              onClick={onTriggerFullSequence}
              disabled={isRunning}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                isRunning
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-red-600 via-amber-600 to-cyan-600 hover:from-red-500 hover:to-cyan-500 text-white border border-red-400/50 glow-red'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-200" />
              <span>{isRunning ? 'AGENT WORKFLOW RUNNING...' : 'RUN AUTONOMOUS MITIGATION WORKFLOW'}</span>
            </button>

            <button
              onClick={onResetSequence}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
              title="Reset System to Nominal Baseline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6-Stage Visual Sequence Stepper */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          
          {/* Step 1 */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
            currentStep === 1
              ? 'bg-red-950/80 border-red-500 text-red-200 glow-red animate-pulse'
              : currentStep > 1
              ? 'bg-slate-900/80 border-slate-700 text-slate-400'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between text-[10px]">
              <span>PHASE 1</span>
              {currentStep > 1 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className="font-bold text-[11px] mt-1">RED ALERT HAZARD</span>
            <span className="text-[10px] opacity-80">{latestFlux > 10 ? `${latestFlux.toFixed(0)} pfu Flux Spike` : 'Solar Flare Detected'}</span>
          </div>

          {/* Step 2 */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
            currentStep === 2
              ? 'bg-amber-950/80 border-amber-500 text-amber-200 glow-amber animate-pulse'
              : currentStep > 2
              ? 'bg-slate-900/80 border-slate-700 text-slate-400'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between text-[10px]">
              <span>PHASE 2</span>
              {currentStep > 2 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className="font-bold text-[11px] mt-1">ESTIMATING RUL</span>
            <span className="text-[10px] opacity-80">{currentStep === 1 ? 'Solver Standby' : 'Newton-Raphson ODE'}</span>
          </div>

          {/* Step 3 */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
            currentStep === 3
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 glow-cyan animate-pulse'
              : currentStep > 3
              ? 'bg-slate-900/80 border-slate-700 text-slate-400'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between text-[10px]">
              <span>PHASE 3</span>
              {currentStep > 3 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className="font-bold text-[11px] mt-1">AGENT RAG REASONING</span>
            <span className="text-[10px] opacity-80">Rule & Envelope Matching</span>
          </div>

          {/* Step 4 */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
            currentStep === 4
              ? 'bg-purple-950/80 border-purple-500 text-purple-200 glow-cyan animate-pulse'
              : currentStep > 4
              ? 'bg-slate-900/80 border-slate-700 text-slate-400'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between text-[10px]">
              <span>PHASE 4</span>
              {currentStep > 4 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className="font-bold text-[11px] mt-1">VOLTAGE REDUCTION</span>
            <span className="text-[10px] opacity-80">DVFS Cut to 0.95V</span>
          </div>

          {/* Step 5 */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
            currentStep === 5
              ? 'bg-blue-950/80 border-blue-500 text-blue-200 glow-cyan animate-pulse'
              : currentStep > 5
              ? 'bg-slate-900/80 border-slate-700 text-slate-400'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between text-[10px]">
              <span>PHASE 5</span>
              {currentStep > 5 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className="font-bold text-[11px] mt-1">DOWNLINK TELEMETRY</span>
            <span className="text-[10px] opacity-80">Ground Station Sync</span>
          </div>

          {/* Step 6 */}
          <div className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
            currentStep === 6
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 glow-emerald'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between text-[10px]">
              <span>PHASE 6</span>
              {currentStep === 6 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className="font-bold text-[11px] mt-1">PROTECTED ({currentRul > 0 ? `${currentRul.toFixed(0)}h` : 'SECURED'})</span>
            <span className="text-[10px] opacity-80">Dual Green LED Active</span>
          </div>

        </div>
      </div>

      {/* Live Ground Station Downlink Progress Panel (Active during Phase 5) */}
      {workflow.transferState && workflow.transferState.inProgress && (
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/60 flex flex-col gap-2 shadow-lg glow-cyan-sm">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-cyan-300 font-bold">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>S-BAND TELEMETRY DOWNLINK TO GROUND STATION (2200 MHz)</span>
            </span>
            <span className="text-emerald-400 font-bold">
              {workflow.transferState.progressPercent}% [{workflow.transferState.bytesTransferred} / {workflow.transferState.totalBytes} BYTES]
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${workflow.transferState.progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>PACKETS: {workflow.transferState.packetsSent} FRAMES (PINN MODEL WEIGHTS + CHROMA AUDIT LOG)</span>
            <span>CHECKSUM: {workflow.transferState.logChecksum}</span>
          </div>
        </div>
      )}
    </div>
  );
};
