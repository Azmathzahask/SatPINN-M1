import React, { useCallback, useEffect, useState } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Send,
  Activity,
  Clock,
  ShieldAlert,
  Gauge
} from 'lucide-react';
import { TelemetrySnapshot, OnboardPublicState } from '../types/comms';

type CommsState = OnboardPublicState;

interface Props {
  snapshot: TelemetrySnapshot;
}

const emptyState = null as CommsState | null;

export const SatelliteCommunicationView: React.FC<Props> = ({ snapshot }) => {
  const [state, setState] = useState<CommsState | null>(emptyState);
  const [gsHost, setGsHost] = useState('127.0.0.1');
  const [gsPort, setGsPort] = useState(8000);
  const [lossPct, setLossPct] = useState(0);
  const [delayMs, setDelayMs] = useState(200);
  const [seed, setSeed] = useState(42);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const syncConfigFromState = useCallback((s: CommsState) => {
    setGsHost(s.gs.host);
    setGsPort(s.gs.port);
    setLossPct(Math.round(s.packetLossRate * 100));
    setDelayMs(s.delayMs);
    setSeed(s.randomSeed ?? 42);
  }, []);

  const refreshNetworkInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/comms/network');
      if (res.ok) {
        const net = await res.json();
        if (Array.isArray(net.localIps)) setLocalIps(net.localIps);
      }
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/comms/state');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CommsState;
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshNetworkInfo();
    const t = setInterval(() => void refresh(), 700);
    return () => clearInterval(t);
  }, [refresh, refreshNetworkInfo]);

  useEffect(() => {
    if (state) {
      setGsHost(state.gs.host);
      setGsPort(state.gs.port);
    }
  }, [state?.gs.host, state?.gs.port]);

  useEffect(() => {
    void fetch('/api/comms/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    });
  }, [snapshot]);

  const post = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      if (data.state) {
        setState(data.state);
        syncConfigFromState(data.state);
      } else if (data.satelliteId) {
        setState(data);
        syncConfigFromState(data);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const scanLocalNetwork = async () => {
    setScanning(true);
    setScanStatus('Scanning Wi-Fi / Hotspot subnet for Ground Station (Computer 2)...');
    try {
      const res = await fetch('/api/comms/scan-network', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'FOUND' && data.station) {
        setGsHost(data.station.host);
        setGsPort(data.station.port);
        setScanStatus(`Found Ground Station on network at http://${data.station.host}:${data.station.port}! Connected.`);
        if (data.state) setState(data.state);
      } else {
        setScanStatus(data.message || 'No Ground Station found. Make sure Computer 2 is running "npm run ground-station".');
      }
    } catch (err) {
      setScanStatus(`Network scan error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const applyLink = () =>
    post('/api/comms/config', {
      gsHost,
      gsPort: Number(gsPort),
      packetLossRate: lossPct / 100,
      delayMs: Number(delayMs),
      randomSeed: Number(seed)
    });

  const inContact = state?.contact === 'IN_CONTACT';
  const gsOk = state?.gsReachable === true;

  const queue = state?.queue ?? [];
  const events = state?.events ?? [];
  const stats = state?.stats;

  const statusDot = (ok: boolean, warn = false) => (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        ok ? 'bg-emerald-400 animate-pulse' : warn ? 'bg-amber-400' : 'bg-red-500'
      }`}
    />
  );

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300 font-display tracking-wide">
            <Radio className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Satellite Communication</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Store-and-forward downlink simulator. Contact windows, delay, and packet loss are{' '}
            <span className="text-amber-300">simulated</span>. Delivery uses the{' '}
            <span className="text-emerald-300">real hotspot/LAN HTTP POST</span> to the Ground Station.
            This path is independent of the ESP32 hardware subsystem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700">
            SAT {state?.satelliteId || 'SAT-M1'}
          </span>
          <span className={`px-2 py-1 rounded-lg border ${inContact ? 'border-emerald-500 text-emerald-300 bg-emerald-950/50' : 'border-amber-500 text-amber-300 bg-amber-950/40'}`}>
            {statusDot(!!inContact, !inContact)} {state?.contact || 'OUT_OF_CONTACT'}
          </span>
          <span className={`px-2 py-1 rounded-lg border ${gsOk ? 'border-cyan-500 text-cyan-300 bg-cyan-950/40' : 'border-slate-600 text-slate-400'}`}>
            {statusDot(gsOk)} GS {gsOk ? 'REACHABLE' : state?.gsReachable === false ? 'UNREACHABLE' : 'UNKNOWN'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-700 bg-red-950/50 text-red-200 text-xs px-3 py-2 font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Contact & generation</h3>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => post('/api/comms/contact', { open: true })}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5"
              >
                <Wifi className="w-3.5 h-3.5" /> Open contact
              </button>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/contact', { open: false })}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center gap-1.5"
              >
                <WifiOff className="w-3.5 h-3.5" /> Close contact
              </button>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/generate', { kind: 'routine', snapshot })}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-800 hover:bg-cyan-700 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Routine telemetry
              </button>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/generate', { kind: 'critical', snapshot })}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-800 hover:bg-red-700 flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Critical health alert
              </button>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/auto', { enabled: !state?.autoTelemetry })}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-800 hover:bg-indigo-700 flex items-center gap-1.5"
              >
                {state?.autoTelemetry ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {state?.autoTelemetry ? 'Pause auto telemetry' : 'Start auto telemetry'}
              </button>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/reset', {})}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-600 hover:bg-slate-800 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset simulation
              </button>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/probe', {})}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-cyan-800 text-cyan-300 hover:bg-cyan-950/50"
              >
                Probe GS health
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs uppercase tracking-widest text-slate-400">Same-Network Ground Station Link (Computer 2)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Connect both devices to the same Wi-Fi / Hotspot. Data streams directly to the Ground Station receiver.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={scanning || busy}
                  onClick={scanLocalNetwork}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-cyan-900/40"
                >
                  <Wifi className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                  {scanning ? 'Scanning Subnet...' : 'Scan Local Network'}
                </button>
              </div>
            </div>

            {/* Same-network Connection Banner */}
            <div className="mb-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">This Device (Satellite):</span>
                <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                  {localIps.length > 0 ? localIps.join(', ') : '127.0.0.1'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Link Status:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${gsOk ? 'bg-emerald-950 text-emerald-300 border border-emerald-500' : 'bg-amber-950 text-amber-300 border border-amber-600'}`}>
                  {gsOk ? 'CONNECTED ON SAME NETWORK' : 'AWAITING GROUND STATION'}
                </span>
              </div>
            </div>

            {scanStatus && (
              <div className="mb-3 rounded-xl border border-cyan-700 bg-cyan-950/40 text-cyan-200 text-xs px-3 py-2 font-mono flex items-center justify-between">
                <span>{scanStatus}</span>
                <button onClick={() => setScanStatus(null)} className="text-cyan-400 hover:text-cyan-200 ml-2">&times;</button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <label className="block">
                <span className="text-slate-500">Ground Station Host / IP</span>
                <input
                  value={gsHost}
                  onChange={e => setGsHost(e.target.value)}
                  placeholder="e.g. 192.168.1.42"
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono text-cyan-300"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Port</span>
                <input
                  type="number"
                  value={gsPort}
                  onChange={e => setGsPort(Number(e.target.value))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Simulated loss 0–50%</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={lossPct}
                  onChange={e => setLossPct(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <span className="font-mono text-amber-300">{lossPct}%</span>
              </label>
              <label className="block">
                <span className="text-slate-500">Simulated delay (ms)</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={delayMs}
                  onChange={e => setDelayMs(Number(e.target.value))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Loss RNG seed</span>
                <input
                  type="number"
                  value={seed}
                  onChange={e => setSeed(Number(e.target.value))}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono"
                />
              </label>
              <div className="flex items-end gap-2">
                <button
                  disabled={busy}
                  onClick={() => applyLink()}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-700 hover:bg-cyan-600"
                >
                  Apply link settings
                </button>
              </div>
              <label className="flex items-center gap-2 col-span-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={!!state?.autoWindows}
                  onChange={e => post('/api/comms/config', { autoWindows: e.target.checked })}
                />
                Automatic simulated contact schedule (20 s open / 20 s closed)
              </label>
              <button
                disabled={busy}
                onClick={() => post('/api/comms/config', { dropNextAck: true })}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-amber-700 text-amber-300"
              >
                Arm lost-ACK once
              </button>
            </div>
            <div className="mt-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">HTTP Target:</span>{' '}
              <span className="font-mono text-cyan-300">http://{gsHost}:{gsPort}/telemetry</span>
              <span className="ml-3 text-slate-500">&bull; Automatically sends data to Computer 2 whenever both are connected to the same network.</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Demonstration scenarios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                ['A', 'Normal operations'],
                ['B', 'Ground station unavailable'],
                ['C', 'Critical alert while disconnected'],
                ['D', 'Packet loss and retry'],
                ['E', 'Lost acknowledgment'],
                ['F', 'Reset and recovery']
              ].map(([id, label]) => (
                <button
                  key={id}
                  disabled={busy}
                  onClick={() => post(`/api/comms/scenarios/${id}`, { snapshot })}
                  className="text-left px-3 py-2 rounded-xl border border-slate-700 hover:border-cyan-600 bg-slate-950/60 text-xs"
                >
                  <span className="font-mono text-cyan-400">Scenario {id}</span>
                  <span className="text-slate-300"> — {label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 overflow-x-auto">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Onboard packet queue</h3>
            <table className="w-full text-[11px] font-mono">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-1">Packet ID</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Health / RUL</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">
                      Queue empty
                    </td>
                  </tr>
                )}
                {queue.map(item => (
                  <tr key={item.packet.packet_id} className="border-t border-slate-800">
                    <td className="py-1.5 text-cyan-200">{item.packet.packet_id}</td>
                    <td className={item.packet.alert_priority === 'CRITICAL' ? 'text-red-400' : item.packet.alert_priority === 'HIGH' ? 'text-amber-300' : 'text-slate-300'}>
                      {item.packet.alert_priority}
                    </td>
                    <td>{item.status}</td>
                    <td>{item.attempts}</td>
                    <td>
                      {item.packet.health_status} · RUL {item.packet.rul_hours.value ?? 'n/a'}
                      {item.packet.rul_hours.value !== null && (
                        <span className="text-slate-500"> ({item.packet.rul_hours.provenance})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Counters
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                ['Generated', stats?.generated ?? 0],
                ['Queued', stats?.queued ?? 0],
                ['Transmitting', stats?.transmitting ?? 0],
                ['Acknowledged', stats?.acknowledged ?? 0],
                ['Failed / retry', stats?.awaitingRetry ?? 0],
                ['Exhausted', stats?.exhausted ?? 0]
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg bg-slate-950/70 border border-slate-800 px-2 py-2">
                  <div className="text-slate-500">{k}</div>
                  <div className="text-lg text-cyan-200">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Last successful TX:{' '}
              <span className="font-mono text-slate-200">{state?.lastSuccessfulTxAt || '—'}</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5" /> Source snapshot
            </h3>
            <p className="text-[11px] text-slate-500 mb-2">Values come from the live PINN/RUL console. Unavailable fields stay null.</p>
            <ul className="text-[11px] font-mono space-y-1 text-slate-300">
              <li>T={snapshot.temperatureC}°C ({snapshot.temperatureProvenance})</li>
              <li>V={snapshot.voltageV} V ({snapshot.voltageProvenance})</li>
              <li>I={snapshot.currentA} A ({snapshot.currentProvenance})</li>
              <li>Flux={snapshot.radiationLevel ?? 'null'} ({snapshot.radiationProvenance})</li>
              <li>RUL={snapshot.rulHours} h ({snapshot.rulProvenance})</li>
            </ul>
          </div>

          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Downlink policy (deterministic)</h3>
            <p className="text-[11px] text-slate-500 mb-2">
              {state?.policy.engine}. Advisory only — does not drive the transport loop.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-200">
              {(state?.policy.recommendations || []).map(r => (
                <li key={r} className="flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel rounded-2xl p-4 max-h-80 overflow-y-auto">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Transmission event log</h3>
            <ul className="space-y-2">
              {events.map(ev => (
                <li key={ev.id} className="text-[11px] border-l-2 border-cyan-800 pl-2">
                  <div className="text-slate-500 font-mono">{ev.timestamp}</div>
                  <div className="text-slate-200">
                    [{ev.category}] {ev.message}
                    {ev.simulated ? <span className="text-amber-400"> · sim</span> : <span className="text-emerald-400"> · net</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
