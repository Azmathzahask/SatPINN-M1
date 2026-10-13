/**
 * Interactive 3D Glowing Earth Globe Component
 * Matches Reference Image 1 visual style with atmospheric cyan glow,
 * orbital track, and Sat - M1 beacon.
 */

import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, Compass, ShieldCheck, Zap } from 'lucide-react';

interface EarthGlobeProps {
  satelliteName?: string;
  altitudeKm?: number;
  velocityKmS?: number;
  isThreatDetected?: boolean;
}

export const EarthGlobe: React.FC<EarthGlobeProps> = ({
  satelliteName = 'Sat - M1',
  altitudeKm = 450,
  velocityKmS = 7.3,
  isThreatDetected = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const [rotationAngle, setRotationAngle] = useState(0);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = rotationAngle;
    let satOrbitAngle = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.36;

      ctx.clearRect(0, 0, width, height);

      // 1. Deep Space Atmosphere Outer Glow
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.45);
      glowGrad.addColorStop(0, 'rgba(14, 165, 233, 0.42)');
      glowGrad.addColorStop(0.35, 'rgba(6, 182, 212, 0.22)');
      glowGrad.addColorStop(0.7, 'rgba(30, 58, 138, 0.12)');
      glowGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // 2. Earth Sphere Base
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // Ocean gradient (Deep Blue to Midnight Navy)
      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      oceanGrad.addColorStop(0, '#0c4a6e');
      oceanGrad.addColorStop(0.4, '#072b4a');
      oceanGrad.addColorStop(0.85, '#04182b');
      oceanGrad.addColorStop(1, '#020b14');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, width, height);

      // 3. Coordinate Graticules / Meridians
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';

      // Latitudes
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = cy + (lat / 90) * radius;
        const rLat = Math.sqrt(Math.max(0, radius * radius - Math.pow(y - cy, 2)));
        ctx.beginPath();
        ctx.ellipse(cx, y, rLat, rLat * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating Longitudes
      for (let lon = 0; lon < 360; lon += 45) {
        const rad = ((lon + angle) * Math.PI) / 180;
        const xOffset = Math.sin(rad) * radius;
        const xRadius = Math.abs(Math.sin(rad)) * radius;

        if (Math.cos(rad) > 0) { // Front side of globe
          ctx.beginPath();
          ctx.ellipse(cx + xOffset * 0.3, cy, xRadius * 0.85, radius, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 4. Stylized Continents / Landmass Silhouettes (Africa, Eurasia, Americas representation)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
      ctx.lineWidth = 1.2;

      // Draw vector-stylized continent patches that rotate with the angle
      const continentPatches = [
        { lat: 15, lon: 20, size: radius * 0.42, shape: 'africa' },
        { lat: 45, lon: 35, size: radius * 0.48, shape: 'europe' },
        { lat: 30, lon: 80, size: radius * 0.55, shape: 'asia' },
        { lat: -25, lon: 135, size: radius * 0.32, shape: 'australia' },
        { lat: 40, lon: -100, size: radius * 0.52, shape: 'na' },
        { lat: -15, lon: -60, size: radius * 0.44, shape: 'sa' },
      ];

      for (const patch of continentPatches) {
        const currentLon = (patch.lon + angle) % 360;
        const lonRad = (currentLon * Math.PI) / 180;
        const isVisible = Math.cos(lonRad) > -0.2; // Visible on hemisphere

        if (isVisible) {
          const px = cx + Math.sin(lonRad) * (radius * 0.85);
          const py = cy - (patch.lat / 90) * (radius * 0.8);
          const depthScale = Math.max(0.2, (Math.cos(lonRad) + 0.3) / 1.3);

          ctx.save();
          ctx.translate(px, py);
          ctx.scale(depthScale, depthScale);

          ctx.beginPath();
          // Organic curved continent blob
          ctx.ellipse(0, 0, patch.size * 0.5, patch.size * 0.4, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // High-tech city dots / Ground stations
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-8, -5, 2, 2);
          ctx.fillRect(10, 8, 2, 2);
          ctx.fillRect(4, -12, 2, 2);

          ctx.restore();
        }
      }

      // Atmosphere Horizon Rim Glow (Inner)
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius);
      rimGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      rimGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.45)');
      rimGrad.addColorStop(1, 'rgba(186, 230, 253, 0.85)');
      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // Exit earth sphere clipping

      // 5. Satellite Orbit Ring (Inclined LEO Plane)
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isThreatDetected ? 'rgba(239, 68, 68, 0.65)' : 'rgba(6, 182, 212, 0.6)';
      ctx.setLineDash([6, 5]);

      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.32, radius * 0.58, -Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 6. Active Satellite (Sat - M1) Positioning along orbit
      satOrbitAngle = (satOrbitAngle + 0.015) % (Math.PI * 2);
      const orbitA = radius * 1.32;
      const orbitB = radius * 0.58;
      const tilt = -Math.PI / 6;

      // Coordinate on tilted ellipse
      const rawX = orbitA * Math.cos(satOrbitAngle);
      const rawY = orbitB * Math.sin(satOrbitAngle);
      const satX = cx + rawX * Math.cos(tilt) - rawY * Math.sin(tilt);
      const satY = cy + rawX * Math.sin(tilt) + rawY * Math.cos(tilt);

      // Pulsing Satellite Beacon
      const pulseSize = 8 + Math.sin(Date.now() * 0.006) * 3;
      ctx.fillStyle = isThreatDetected ? 'rgba(239, 68, 68, 0.35)' : 'rgba(6, 182, 212, 0.35)';
      ctx.beginPath();
      ctx.arc(satX, satY, pulseSize * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Satellite Core Dot
      ctx.fillStyle = isThreatDetected ? '#ef4444' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(satX, satY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Satellite Label Tag
      ctx.fillStyle = 'rgba(10, 17, 34, 0.85)';
      ctx.strokeStyle = isThreatDetected ? 'rgba(239, 68, 68, 0.6)' : 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1;
      const tagW = 82;
      const tagH = 22;
      ctx.strokeRect(satX + 8, satY - 26, tagW, tagH);
      ctx.fillRect(satX + 8, satY - 26, tagW, tagH);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = isThreatDetected ? '#fca5a5' : '#a5f3fc';
      ctx.fillText(satelliteName, satX + 12, satY - 12);

      // Loop update
      if (isRotating) {
        angle = (angle + 0.35) % 360;
        setRotationAngle(angle);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isRotating, isThreatDetected, satelliteName]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden">
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        width={560}
        height={480}
        className="w-full max-w-[540px] h-auto aspect-square object-contain cursor-grab active:cursor-grabbing transition-transform"
      />

      {/* Orbit & Telemetry HUD Overlay */}
      <div className="absolute top-4 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-xs font-mono text-cyan-300">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>ORBIT: LEO 550KM SUN-SYNCHRONOUS</span>
      </div>

      <div className="absolute top-4 right-6 flex items-center gap-2">
        <button
          onClick={() => setIsRotating(prev => !prev)}
          className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors text-xs flex items-center gap-1"
          title={isRotating ? 'Pause rotation' : 'Resume rotation'}
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
          <span>{isRotating ? 'TRACKING' : 'HOLD'}</span>
        </button>
      </div>

      {/* Central Quick Explore Pill (Reference Image 1) */}
      <div className="absolute bottom-6 flex items-center gap-3">
        <div className="px-5 py-2 rounded-full bg-cyan-950/60 border border-cyan-400/40 text-cyan-200 text-xs font-semibold tracking-wider hover:bg-cyan-900/70 hover:border-cyan-400 transition-all flex items-center gap-2 shadow-lg glow-cyan-sm">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>ORBITAL SECTOR: 450KM / 7.3 KM/S</span>
        </div>
      </div>
    </div>
  );
};
