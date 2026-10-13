/**
 * Omnipresent Autonomous Agent Co-Pilot Drawer / Modal
 * Accessible from anywhere in the application.
 * Executes autonomous ReAct loops, tool calls, and natural language mission commands.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Send,
  X,
  Minimize2,
  Maximize2,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  RotateCcw,
  BookOpen,
  Key
} from 'lucide-react';
import {
  AgentRecommendation,
  HardwareTelemetry,
  RulCalculationResult,
  OperatingProfileId,
  SpaceWeatherRecord
} from '../types';
import { PREQUALIFIED_PROFILES, queryAerospaceStandards } from '../services/aerospaceKnowledgeBase';

interface AgentCopilotProps {
  telemetry: HardwareTelemetry;
  rulResult: RulCalculationResult;
  spaceWeather: SpaceWeatherRecord[];
  agentRec?: AgentRecommendation;
  isAutonomousMode: boolean;
  onToggleAutonomousMode: () => void;
  onExecuteMitigation: (profileId: OperatingProfileId) => void;
  onSimulateCmeSpike: (peakFlux: number) => void;
  onResetNominal: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'AGENT' | 'USER' | 'SYSTEM';
  text: string;
  timestamp: string;
  citations?: Array<{ standardCode: string; section: string }>;
  actionExecuted?: string;
  isOffline?: boolean;
  modelUsed?: string;
  errorNotice?: string;
}

export const AgentCopilot: React.FC<AgentCopilotProps> = ({
  telemetry,
  rulResult,
  spaceWeather,
  agentRec,
  isAutonomousMode,
  onToggleAutonomousMode,
  onExecuteMitigation,
  onSimulateCmeSpike,
  onResetNominal,
  isOpen,
  onClose,
  onOpen
}) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'AGENT',
      text: 'Autonomous Flight Reliability Agent initialized. Continuously ingesting NOAA GOES-16 proton telemetry, computing PINN gate-oxide degradation, and enforcing NASA-HDBK-4002A & ECSS-Q-ST-60-15C mitigation rules.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [hasEnvKey, setHasEnvKey] = useState<boolean>(false);
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<string>('');

  // Check backend .env key status on mount
  useEffect(() => {
    fetch('/api/agent/config')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'SUCCESS' && data.hasEnvKey) {
          setHasEnvKey(true);
        }
      })
      .catch(() => {});
  }, []);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const stored = localStorage.getItem('GEMINI_MODEL');
    if (stored && (stored.includes('1.5') || stored.includes('2.0') || stored.includes('3.1'))) {
      return 'gemini-2.5-flash';
    }
    return stored || 'gemini-2.5-flash';
  });
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // Save key to .env file on server
  const handleSaveToEnv = async () => {
    if (!apiKey.trim()) return;
    setIsSavingKey(true);
    setSaveStatusMsg('');
    try {
      const res = await fetch('/api/agent/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setHasEnvKey(true);
        setSaveStatusMsg('Saved to .env & activated!');
        setTimeout(() => setSaveStatusMsg(''), 4000);
      } else {
        setSaveStatusMsg(data.message || 'Error saving to .env');
      }
    } catch (e: any) {
      setSaveStatusMsg('Failed to connect to backend');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Helper to sanitize error strings (never leak API keys)
  const sanitizeError = (err: any): string => {
    if (!err) return '';
    const str = typeof err === 'string' ? err : err?.message || String(err);
    try {
      const jsonMatch = str.match(/\{[\s\S]*"error"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed?.error?.message) {
          return parsed.error.message.replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
        }
      }
    } catch {}
    return str
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
      .replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
  };

  // Handle user natural language query to the agent
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userQuery = inputText.trim();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'USER',
      text: userQuery,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      let replyText = '';
      let citations: Array<{ standardCode: string; section: string }> = [];
      let actionExec: string | undefined = undefined;
      let lastApiError: string | undefined = undefined;
      let modelUsed: string | undefined = undefined;
      let isOfflineResponse = false;

      // 1. Try local Express backend route /api/agent/chat with 15s timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userQuery,
            telemetry,
            rulResult,
            apiKey: apiKey.trim(),
            model: selectedModel.trim()
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          replyText = data.reply || '';
          citations = data.citations || [];
          if (data.llmSuccess) {
            modelUsed = data.llmModel || selectedModel;
            isOfflineResponse = false;
          } else if (data.llmError) {
            lastApiError = sanitizeError(data.llmError);
            isOfflineResponse = true;
          } else {
            isOfflineResponse = true;
          }

          if (data.actionDirective === 'SIMULATE_CME') {
            onSimulateCmeSpike(4200);
            actionExec = 'SIMULATE_CME_4200_PFU';
          } else if (data.actionDirective === 'EXECUTE_SAFE_MODE_B') {
            onExecuteMitigation('SAFE_LOW_POWER_B');
            actionExec = 'SAFE_LOW_POWER_B (0.95V)';
          } else if (data.actionDirective === 'RESET_NOMINAL') {
            onResetNominal();
            actionExec = 'RESET_NOMINAL_1.20V';
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastApiError = sanitizeError(errData?.message || `HTTP ${res.status}: ${res.statusText}`);
          isOfflineResponse = true;
        }
      } catch (backendErr: any) {
        lastApiError = sanitizeError(backendErr?.name === 'AbortError' ? 'Backend request timed out (15s)' : backendErr);
        isOfflineResponse = true;
        console.warn('Backend /api/agent/chat unreachable, checking direct Gemini connection...', backendErr);
      }

      // 2. Direct Google Gemini REST call from browser if API key is provided and live LLM reply was not yet received
      if (!replyText && apiKey.trim()) {
        const flightPrompt = `You are the Autonomous Flight Reliability AI Agent for spacecraft "Sat - M1" (550km Sun-Synchronous LEO Orbit).
Live Telemetry:
- Core Voltage (Vdd): ${telemetry.vdd.toFixed(2)}V
- Probe Temp: ${telemetry.probeTempC.toFixed(1)}°C
- Current: ${telemetry.currentMa.toFixed(1)}mA
- Active Operating Profile: ${telemetry.activeProfile}
- Remaining Useful Life (RUL): ${rulResult.estimatedRulHours.toFixed(1)} Hours [${rulResult.riskBand}]

Flight Directive / Inquiry from Operator:
${userQuery}

Provide a concise, authoritative answer as the satellite's autonomous flight reliability agent. Cite NASA-HDBK-4002A or ECSS standards if applicable.`;

        const modelsToTry = Array.from(new Set([
          selectedModel.trim(),
          'gemini-2.5-flash',
          'gemini-flash-latest',
          'gemini-3-flash-preview',
          'gemini-2.5-flash-preview-tts'
        ].filter(Boolean)));

        for (const model of modelsToTry) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: flightPrompt }] }]
                }),
                signal: controller.signal
              }
            );
            clearTimeout(timeoutId);

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidateText) {
                replyText = candidateText.trim();
                modelUsed = model;
                isOfflineResponse = false;
                lastApiError = undefined;
                break;
              }
            } else {
              const errBody = await geminiRes.json().catch(() => ({}));
              lastApiError = sanitizeError(errBody?.error?.message || `HTTP ${geminiRes.status}: ${geminiRes.statusText}`);
              isOfflineResponse = true;
            }
          } catch (gErr: any) {
            lastApiError = sanitizeError(gErr?.name === 'AbortError' ? `Timeout contacting ${model}` : gErr);
            isOfflineResponse = true;
          }
        }
      }

      // Detect operator action commands in prompt
      const lower = userQuery.toLowerCase();
      if (!actionExec) {
        if (lower.includes('simulate cme') || lower.includes('spike cme') || lower.includes('flare')) {
          onSimulateCmeSpike(4200);
          actionExec = 'SIMULATE_CME_4200_PFU';
        } else if (lower.includes('safe mode') || lower.includes('safe hold') || lower.includes('0.95v')) {
          onExecuteMitigation('SAFE_LOW_POWER_B');
          actionExec = 'SAFE_LOW_POWER_B (0.95V)';
        } else if (lower.includes('reset') || lower.includes('nominal')) {
          onResetNominal();
          actionExec = 'RESET_NOMINAL_1.20V';
        }
      }

      // 3. Fallback: Guaranteed deterministic response if live LLM did not respond
      if (!replyText) {
        isOfflineResponse = true;
        const rag = queryAerospaceStandards(userQuery, 2);
        const topDoc = rag.documents[0];
        replyText = topDoc
          ? `[Deterministic Aerospace Mode] Sat - M1 Telemetry: Vdd = ${telemetry.vdd.toFixed(2)}V, Temp = ${telemetry.probeTempC.toFixed(1)}°C, RUL = ${rulResult.estimatedRulHours.toFixed(1)}h [${rulResult.riskBand}]. Guidance from ${topDoc.standardCode} (${topDoc.section}): "${topDoc.excerpt.slice(0, 220)}...".`
          : `[Deterministic Aerospace Mode] Sat - M1 Telemetry: Vdd = ${telemetry.vdd.toFixed(2)}V, Temp = ${telemetry.probeTempC.toFixed(1)}°C, RUL = ${rulResult.estimatedRulHours.toFixed(1)}h [${rulResult.riskBand}]. Operating in ${isAutonomousMode ? 'AUTONOMOUS' : 'MANUAL'} flight envelope.`;
        citations = rag.documents.map(d => ({ standardCode: d.standardCode, section: d.section }));
      }

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'AGENT',
          text: replyText,
          timestamp: new Date().toLocaleTimeString(),
          citations,
          actionExecuted: actionExec,
          isOffline: isOfflineResponse,
          modelUsed,
          errorNotice: lastApiError
        }
      ]);
    } catch (err: any) {
      console.error('Agent message error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'AGENT',
          text: `[Aerospace System Alert] Error communicating with reasoning engine: ${sanitizeError(err)}. Telemetry monitoring active.`,
          timestamp: new Date().toLocaleTimeString(),
          isOffline: true,
          errorNotice: sanitizeError(err)
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button (Always visible on screen bottom-right) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          <button
            onClick={onOpen}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl glow-cyan text-xs font-semibold tracking-wide transition-all border border-cyan-400/40 select-none cursor-pointer"
          >
            <div className="relative">
              <Bot className="w-4 h-4 text-cyan-200" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
            </div>
            <span>AGENT CO-PILOT</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              isAutonomousMode ? 'bg-cyan-950 text-cyan-300 border border-cyan-400/60' : 'bg-slate-900 text-slate-300'
            }`}>
              {isAutonomousMode ? 'AUTO: ON' : 'MANUAL'}
            </span>
          </button>
        </div>
      )}

      {/* Slide-out Omnipresent Copilot Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md h-[560px] rounded-2xl glass-panel border border-cyan-500/50 flex flex-col shadow-2xl glow-cyan overflow-hidden bg-[#070d1e]/95 backdrop-blur-2xl">
          
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-950/80 border-b border-cyan-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-950/90 border border-cyan-600/50">
                <Bot className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold font-display text-slate-100 tracking-wider">
                    AUTONOMOUS RELIABILITY AGENT
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] font-mono text-cyan-400/90">
                  ReAct Loop &middot; RAG Vector Store &middot; Closed-Loop Control
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Gemini API Key Config Toggle */}
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className={`p-1.5 rounded-lg text-xs font-mono transition-all border flex items-center gap-1 ${
                  apiKey
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Configure Gemini LLM API Key"
              >
                <Key className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px]">{apiKey ? 'API KEY' : 'SET KEY'}</span>
              </button>

              {/* Autonomous Mode Toggle */}
              <button
                onClick={onToggleAutonomousMode}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all border ${
                  isAutonomousMode
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500 glow-emerald'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
                title="Toggle continuous autonomous mitigation"
              >
                {isAutonomousMode ? 'AUTO: ON' : 'AUTO: OFF'}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                title="Minimize Agent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Optional Gemini API Key Drawer */}
          {showKeyInput && (
            <div className="px-3.5 py-2.5 bg-slate-950/95 border-b border-cyan-900/60 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-cyan-400" />
                  <span>Google Gemini API Key:</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {apiKey ? '✓ Real LLM Active' : 'Offline Aerospace Mode Active'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => {
                    const val = e.target.value;
                    setApiKey(val);
                    localStorage.setItem('GEMINI_API_KEY', val);
                  }}
                  placeholder="Paste your Gemini API Key (e.g. AIzaSy...)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none"
                />
                {apiKey && (
                  <>
                    <button
                      onClick={handleSaveToEnv}
                      disabled={isSavingKey}
                      className="px-2.5 py-1.5 text-[10px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/80 border border-cyan-700/80 rounded font-mono disabled:opacity-50 cursor-pointer"
                      title="Save this key to the root .env file"
                    >
                      {isSavingKey ? 'Saving...' : 'Save to .env'}
                    </button>
                    <button
                      onClick={() => {
                        setApiKey('');
                        localStorage.removeItem('GEMINI_API_KEY');
                      }}
                      className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 bg-red-950/60 border border-red-800/60 rounded font-mono"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
              {saveStatusMsg && (
                <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span>✓ {saveStatusMsg}</span>
                </div>
              )}
              {hasEnvKey && !saveStatusMsg && (
                <div className="text-[10px] font-mono text-cyan-400/90 flex items-center gap-1">
                  <span>✓ Backend .env file is detected and active</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-cyan-400">Target Model:</span>
                <select
                  value={selectedModel}
                  onChange={e => {
                    setSelectedModel(e.target.value);
                    localStorage.setItem('GEMINI_MODEL', e.target.value);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none flex-1"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Active GA &middot; Recommended)</option>
                  <option value="gemini-flash-latest">gemini-flash-latest (Auto-Updating Flash)</option>
                  <option value="gemini-3-flash-preview">gemini-3-flash-preview (Next-Gen Preview)</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500 font-sans">
                Supplying a key connects the agent directly to Google Gemini for autonomous reasoning. Without a key or on API failure, the agent gracefully defaults to deterministic aerospace flight guidance.
              </p>
            </div>
          )}

          {/* Quick Action Pills */}
          <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => onSimulateCmeSpike(3800)}
              className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-900/80 text-red-300 text-[10px] font-mono border border-red-800/60 whitespace-nowrap flex items-center gap-1 transition-colors"
            >
              <Flame className="w-3 h-3 text-red-400" />
              <span>Simulate CME Spike</span>
            </button>
            <button
              onClick={() => onExecuteMitigation('SAFE_LOW_POWER_B')}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 text-[10px] font-mono border border-cyan-800/60 whitespace-nowrap flex items-center gap-1 transition-colors"
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Apply Safe Hold (0.95V)</span>
            </button>
            <button
              onClick={onResetNominal}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700 whitespace-nowrap flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Nominal</span>
            </button>
          </div>

          {/* Chat / Thought Stream Body */}
          <div className="flex-1 p-3.5 overflow-y-auto flex flex-col gap-3 font-mono text-xs">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 max-w-[90%] ${
                  msg.sender === 'USER' ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>{msg.sender === 'USER' ? 'Flight Director' : 'Agent Co-Pilot'}</span>
                  <span>&middot;</span>
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'AGENT' && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      msg.isOffline
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                    }`}>
                      {msg.isOffline ? 'OFFLINE GUIDANCE' : `LIVE LLM (${msg.modelUsed || selectedModel})`}
                    </span>
                  )}
                </div>
                <div
                  className={`p-3 rounded-xl leading-relaxed text-xs ${
                    msg.sender === 'USER'
                      ? 'bg-cyan-900/80 text-cyan-100 border border-cyan-600/50 rounded-br-none'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none shadow-inner'
                  }`}
                >
                  <p className="font-sans text-xs whitespace-pre-line">{msg.text}</p>

                  {/* Diagnostic Notice if API failed and fell back */}
                  {msg.errorNotice && (
                    <div className="mt-2 p-1.5 rounded bg-amber-950/40 border border-amber-800/60 text-[10px] text-amber-300 font-mono flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                      <span>Notice: {msg.errorNotice}</span>
                    </div>
                  )}

                  {/* If action executed */}
                  {msg.actionExecuted && (
                    <div className="mt-2 p-1.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-[11px] text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Executed: {msg.actionExecuted}</span>
                    </div>
                  )}

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col gap-1 text-[10px] text-cyan-400">
                      <span className="text-slate-400 font-semibold">Authoritative Standards Cited:</span>
                      {msg.citations.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-cyan-500" />
                          <span>{c.standardCode} ({c.section})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-cyan-800/60 text-cyan-300 text-xs self-start animate-pulse">
                <Bot className="w-3.5 h-3.5 animate-spin" />
                <span>Agent reasoning & querying aerospace neural model...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={isTyping}
              placeholder={isTyping ? "Agent is reasoning..." : "Give directive or ask standards (e.g. 'hello', 'Simulate CME', '0.95V rule')..."}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isTyping || !inputText.trim()}
              className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Send directive"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}
    </>
  );
};
