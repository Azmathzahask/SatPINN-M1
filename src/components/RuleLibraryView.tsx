/**
 * Authoritative Rule Library & Documents View (Page H)
 * - Complete index of aerospace normative standards (NASA, ESA ECSS, ISRO, NOAA, MIL-STD)
 * - Extracted operational rules
 * - Human-review & verification toggles
 * - Section-aware citation provenance inspector
 */

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Filter,
  FileText,
  BadgeAlert,
  Search,
  Lock
} from 'lucide-react';
import { AerospaceDocument, ExtractedRule } from '../types';

interface RuleLibraryViewProps {
  documents: AerospaceDocument[];
  rules: ExtractedRule[];
  onToggleRuleVerification: (ruleId: string) => void;
}

export const RuleLibraryView: React.FC<RuleLibraryViewProps> = ({
  documents,
  rules,
  onToggleRuleVerification
}) => {
  const [selectedOrg, setSelectedOrg] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredDocs = documents.filter(doc => {
    const matchOrg = selectedOrg === 'ALL' || doc.issuingOrg === selectedOrg;
    const matchSearch = doc.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        doc.standardCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        doc.excerpt.toLowerCase().includes(searchFilter.toLowerCase());
    return matchOrg && matchSearch;
  });

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header Panel */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-bold font-display text-slate-100">
              Authoritative Aerospace Rule & Document Repository
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              {documents.length} STANDARDS INDEXED
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Normative Spacecraft Standards: NASA &middot; ESA ECSS &middot; ISRO &middot; NOAA SWPC &middot; MIL-STD
          </p>
        </div>

        {/* Agency Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
          {['ALL', 'NASA', 'ESA', 'ISRO', 'NOAA', 'DOD/MIL'].map(org => (
            <button
              key={org}
              onClick={() => setSelectedOrg(org)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                selectedOrg === org
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/80 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {org}
            </button>
          ))}
        </div>
      </div>

      {/* Extracted Rules Verification Table */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Extracted Flight Rules & Human Verification Status</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {rules.filter(r => r.verifiedByHuman).length} of {rules.length} Human-Verified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                rule.verifiedByHuman
                  ? 'bg-slate-900/80 border-slate-800'
                  : 'bg-amber-950/30 border-amber-800/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-cyan-300">{rule.ruleCode}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                    rule.verifiedByHuman
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {rule.verifiedByHuman ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    <span>{rule.verifiedByHuman ? 'VERIFIED NORMATIVE' : 'UNVERIFIED DRAFT'}</span>
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-slate-100 mt-2">{rule.summary}</h4>

                <div className="mt-2 p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-col gap-1">
                  <div>
                    <span className="text-slate-500">Condition:</span> <span className="text-slate-300">{rule.applicabilityCondition}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Recommended Action:</span> <span className="text-cyan-400 font-bold">{rule.recommendedAction}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Envelope:</span> {rule.voltageLimitMin}V - {rule.voltageLimitMax}V | Max T: {rule.maxAllowableTempC}°C
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                <span className="text-slate-500">{rule.verificationNotes}</span>
                <button
                  onClick={() => onToggleRuleVerification(rule.id)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]"
                >
                  {rule.verifiedByHuman ? 'REVOKE VERIFICATION' : 'VERIFY RULE'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indexed Aerospace Documents Catalog */}
      <div className="p-4 rounded-2xl glass-panel border border-cyan-900/40 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Full Standard Documentation Catalog ({filteredDocs.length})</span>
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter by keyword..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-cyan-300">{doc.standardCode}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {doc.issuingOrg} &middot; Rev {doc.revisionDate}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    doc.normativeStatus === 'NORMATIVE' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {doc.normativeStatus}
                  </span>
                </div>

                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>Portal Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <h3 className="text-sm font-semibold text-slate-100">{doc.title}</h3>
              <span className="text-xs text-cyan-400 font-mono">{doc.section}</span>

              <p className="text-xs text-slate-300 leading-relaxed font-sans italic bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                "{doc.excerpt}"
              </p>

              <div className="text-[11px] text-slate-400 font-mono mt-1">
                <span className="text-slate-500">Applicability:</span> {doc.applicability}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
