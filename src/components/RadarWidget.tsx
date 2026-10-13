/**
 * Radar Sweep Widget
 * Matches the bottom-right radar component in Reference Image 1.
 */

import React from 'react';
import { Radio } from 'lucide-react';

interface RadarWidgetProps {
  isAlert?: boolean;
}

export const RadarWidget: React.FC<RadarWidgetProps> = ({ isAlert = false }) => {
  return (
    <div className="relative w-full h-36 rounded-xl glass-panel-subtle border border-slate-700/50 p-3 overflow-hidden flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>RADAR TRACKING</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${isAlert ? 'bg-red-950 text-red-400 border border-red-800/60' : 'bg-cyan-950 text-cyan-400 border border-cyan-800/50'}`}>
          {isAlert ? 'ANOMALY DETECTED' : 'RANGE 500KM'}
        </span>
      </div>

      {/* Circular Radar Sweep */}
      <div className="relative flex-1 flex items-center justify-center my-1">
        <div className="relative w-24 h-24 rounded-full border border-cyan-500/20 bg-slate-950/60 flex items-center justify-center overflow-hidden">
          {/* Inner distance concentric rings */}
          <div className="w-16 h-16 rounded-full border border-cyan-500/15" />
          <div className="w-8 h-8 rounded-full border border-cyan-500/20" />
          
          {/* Crosshairs */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-px bg-cyan-500/20" />
            <div className="absolute w-px h-full bg-cyan-500/20" />
          </div>

          {/* Radar Sweep Arm */}
          <div className="absolute inset-0 animate-radar origin-center">
            <div 
              className="w-1/2 h-1/2 origin-bottom-right"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6, 182, 212, 0.45) 45deg, transparent 60deg)',
              }}
            />
          </div>

          {/* Central craft node */}
          <div className="w-2 h-2 rounded-full bg-cyan-400 z-10 shadow-sm shadow-cyan-300" />

          {/* Detected Blips */}
          <div className="absolute top-4 right-6 w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
          <div className="absolute top-4 right-6 w-1.5 h-1.5 rounded-full bg-red-400" />

          <div className="absolute bottom-5 left-6 w-1.5 h-1.5 rounded-full bg-cyan-300" />
        </div>
      </div>

      {/* Bottom status */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 z-10">
        <span>FREQ: 1420.4 MHz</span>
        <span>AZ: 184° / EL: 42°</span>
      </div>
    </div>
  );
};
