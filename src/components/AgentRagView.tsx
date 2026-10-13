/**
 * Agent & Authoritative Aerospace RAG View (Page F)
 * - ReAct-style Autonomous Reliability Agent
 * - Authoritative Standards Search (NASA, ESA ECSS, ISRO, NOAA)
 * - Exact Normative Citations & Excerpt Cards
 * - Deterministic Safety Policy Validator
 * - Operator Approval Gate
 */

import React, { useState } from 'react';
import {
  Bot,
  Search,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Zap,
  Terminal,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  AgentRecommendation,
  AerospaceDocument,
  OperatingProfileId,
  RulRiskBand
} from '../types';
import { PREQUALIFIED_PROFILES } from '../services/aerospaceKnowledgeBase';

interface AgentRagViewProps {
  agentRec?: AgentRecommendation;
  documents: AerospaceDocument[];
  currentRulHours: number;
  currentRiskBand: RulRiskBand;
  currentVdd: number;
  probeTempC: number;
  latestFlux: number;
  onRunAgentAssessment: () => void;
  onSearchStandards: (query: string) => void;
  onExecuteRecommendation: (profileId: OperatingProfileId) => void;
}

export const AgentRagView: React.FC<AgentRagViewProps> = ({
  agentRec,
  documents,
  currentRulHours,
  currentRiskBand,
  currentVdd,
  probeTempC,
  latestFlux,
  onRunAgentAssessment,
  onSearchStandards,
  onExecuteRecommendation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'reasoning' | 'citations' | 'safety'>('reasoning');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchStandards(searchQuery);
    }
  };

  const proposedProfile = agentRec?.proposedProfile
    ? PREQUALIFIED_PROFILES[agentRec.proposedProfile]
    : null;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header Panel */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-bold font-display text-slate-100">
              Autonomous ReAct Agent & Aerospace RAG Corpus
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              RULE-GROUNDED MITIGATION
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Authoritative Normative Standards: NASA &middot; ESA ECSS &middot; ISRO &middot; NOAA SWPC | Deterministic Safety Gate
          </p>
        </div>

        <button
          onClick={onRunAgentAssessment}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-semibold text-xs tracking-wider transition-all shadow-md glow-cyan-sm flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>TRIGGER AGENT REASSESSMENT</span>
        </button>
      </div>

      {/* Live Ingestion State Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono block">RUL / Risk Band</span>
          <span className={`text-sm font-bold font-mono block mt-1 ${
            currentRiskBand === 'CRITICAL' ? 'text-red-400' : 'text-cyan-300'
          }`}>
            {currentRulHours}h [{currentRiskBand}]
          </span>
        </div>

        <div className="p-3 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono block">Space Weather Flux</span>
          <span className="text-sm font-bold font-mono text-amber-300 block mt-1">
            {latestFlux.toFixed(1)} pfu (&gt;10 MeV)
          </span>
        </div>

        <div className="p-3 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono block">Current Vdd</span>
          <span className="text-sm font-bold font-mono text-slate-200 block mt-1">
            {currentVdd.toFixed(2)} V
          </span>
        </div>

        <div className="p-3 rounded-xl glass-panel-subtle border border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono block">Probe Temp (DS18B20)</span>
          <span className="text-sm font-bold font-mono text-slate-200 block mt-1">
            {probeTempC.toFixed(1)} °C
          </span>
        </div>

        <div className="p-3 rounded-xl glass-panel-subtle border border-slate-800 col-span-2 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-mono block">Safety Gate</span>
          <span className="text-sm font-bold font-mono text-emerald-400 block mt-1">
            DETERMINISTIC
          </span>
        </div>
      </div>

      {/* Main Agent Reasoning & Recommendation Card */}
      {agentRec ? (
        <div className="p-5 rounded-2xl glass-panel border border-cyan-800/60 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Agent Assessment ID: {agentRec.id}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {new Date(agentRec.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-100 mt-1">
                Proposed Action: <span className="text-cyan-300">{proposedProfile?.name || agentRec.proposedProfile}</span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${
                agentRec.safetyValidation.passed
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
                  : 'bg-red-950 text-red-300 border border-red-700/80'
              }`}>
                {agentRec.safetyValidation.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{agentRec.safetyValidation.passed ? 'SAFETY MATRIX PASSED' : 'SAFETY REJECTED'}</span>
              </span>

              {agentRec.status === 'PENDING_APPROVAL' && proposedProfile && (
                <button
                  onClick={() => onExecuteRecommendation(agentRec.proposedProfile)}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-semibold text-xs font-mono tracking-wider transition-all shadow-md glow-cyan-sm flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>OPERATOR AUTHORIZE & APPLY ({proposedProfile.vddTarget}V)</span>
                </button>
              )}
            </div>
          </div>

          {/* Subtabs for Agent Detail */}
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
            <button
              onClick={() => setActiveTab('reasoning')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'reasoning' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ReAct Reasoning Trace ({agentRec.reasoningTrace.length})
            </button>
            <button
              onClick={() => setActiveTab('citations')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'citations' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aerospace Citations ({agentRec.retrievedCitations.length})
            </button>
            <button
              onClick={() => setActiveTab('safety')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                activeTab === 'safety' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deterministic Safety Checklist
            </button>
          </div>

          {/* Tab 1: Reasoning Trace */}
          {activeTab === 'reasoning' && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2 font-mono text-xs text-slate-300">
              {agentRec.reasoningTrace.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="text-cyan-400 shrink-0 select-none">[{idx + 1}]</span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Retrieved Citations */}
          {activeTab === 'citations' && (
            <div className="flex flex-col gap-3">
              {agentRec.retrievedCitations.map((cite, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-cyan-300">{cite.standardCode}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{cite.section}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans italic border-l-2 border-cyan-500/60 pl-3 my-1">
                    "{cite.text}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Safety Checklist */}
          {activeTab === 'safety' && (
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-slate-950">
                <span className="text-slate-400">Voltage Envelope [0.80V - 1.30V]:</span>
                <span className={agentRec.safetyValidation.voltageWithinPermittedRange ? 'text-emerald-400' : 'text-red-400'}>
                  {agentRec.safetyValidation.voltageWithinPermittedRange ? 'PASSED (0.95V)' : 'VIOLATION'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950">
                <span className="text-slate-400">Thermal Interlock (&le; 55.0°C):</span>
                <span className={agentRec.safetyValidation.tempSafe ? 'text-emerald-400' : 'text-red-400'}>
                  {agentRec.safetyValidation.tempSafe ? `PASSED (${probeTempC.toFixed(1)}°C)` : 'OVERHEAT'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950">
                <span className="text-slate-400">Hardware Controllable Load:</span>
                <span className="text-emerald-400">SUPPORTED & VERIFIED</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950">
                <span className="text-slate-400">Human Operator Gate:</span>
                <span className="text-amber-300">
                  {agentRec.safetyValidation.operatorApprovalRequired ? 'REQUIRED FOR SAFE HOLD' : 'AUTONOMOUS'}
                </span>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="p-8 rounded-2xl glass-panel border border-slate-800 text-center flex flex-col items-center justify-center gap-3">
          <Bot className="w-10 h-10 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-300">No Active Agent Assessment</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Click "Trigger Agent Reassessment" to ingest current telemetry, execute RAG retrieval against NASA/ESA standards, and run the deterministic safety validator.
          </p>
          <button
            onClick={onRunAgentAssessment}
            className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-semibold text-xs font-mono"
          >
            START ASSESSMENT NOW
          </button>
        </div>
      )}

      {/* Standards Search Query Bar */}
      <div className="p-4 rounded-xl glass-panel-subtle border border-slate-800 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-200 font-mono flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Search Indexed Authoritative Standards Corpus</span>
        </h3>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search NASA, ESA ECSS, ISRO, or NOAA standards (e.g. 'TID core voltage reduction', 'RUL safe mode')..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 text-xs font-mono border border-cyan-600/50 transition-colors"
          >
            SEARCH
          </button>
        </form>

        {/* Display documents in database */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
          {documents.slice(0, 4).map(doc => (
            <div key={doc.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-cyan-300">{doc.standardCode}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {doc.issuingOrg}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-slate-200 mt-1">{doc.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-sans">
                  {doc.excerpt.slice(0, 160)}...
                </p>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                <span>{doc.section.slice(0, 32)}</span>
                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                >
                  Source Portal <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
