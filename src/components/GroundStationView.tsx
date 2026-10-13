import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Antenna, Bell, Filter, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';

interface GsPacketRow {
  packet: {
    packet_id: string;
    satellite_id: string;
    generated_at: string;
    alert_priority: string;
    health_status: string;
    temperature_c: { value: number | null };
    voltage_v: { value: number | null };
    current_a: { value: number | null };
    radiation_level: { value: number | null };
    rul_hours: { value: number | null };
  };
  received_at: string;
  duplicate_count: number;
}

interface GsEvent {
  id: string;
  timestamp: string;
  category: string;
  message: string;
  packetId?: string;
}

interface Props {
  defaultHost?: string;
  defaultPort?: number;
  sameOrigin?: boolean;
}

export const GroundStationView: React.FC<Props> = ({
  defaultHost = '127.0.0.1',
  defaultPort = 8000,
  sameOrigin = false
}) => {
  const [host, setHost] = useState(defaultHost);
  const [port, setPort] = useState(defaultPort);
  const [online, setOnline] = useState(false);
  const [packets, setPackets] = useState<GsPacketRow[]>([]);
  const [events, setEvents] = useState<GsEvent[]>([]);
  const [stats, setStats] = useState({ received: 0, duplicates: 0, invalid: 0, criticalAlerts: 0 });
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const base = useMemo(() => (sameOrigin ? '' : `http://${host}:${port}`), [sameOrigin, host, port]);

  const load = useCallback(async () => {
    try {
      const healthRes = await fetch(`${base}/health`);
      setOnline(healthRes.ok);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (priority) params.set('priority', priority);
      const tel = await fetch(`${base}/telemetry?${params.toString()}`);
      const telJson = await tel.json();
      setPackets(telJson.packets || []);
      setStats(telJson.stats || { received: 0, duplicates: 0, invalid: 0, criticalAlerts: 0 });
      const ev = await fetch(`${base}/events`);
      const evJson = await ev.json();
      setEvents(evJson.events || []);
      setError(null);
    } catch (err) {
      setOnline(false);
      setError(
        `Cannot reach Ground Station at ${base || window.location.origin}. ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [base, q, priority]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 1000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const latestCritical = packets.find(p => p.packet.alert_priority === 'CRITICAL');
    if (latestCritical) {
      setFlash(`CRITICAL ${latestCritical.packet.packet_id} · ${latestCritical.packet.health_status}`);
    }
  }, [packets[0]?.packet.packet_id]);

  const clearHistory = async () => {
    if (!window.confirm('Clear received telemetry history on this Ground Station?')) return;
    await fetch(`${base}/admin/clear-history`, { method: 'POST' });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-300 font-display">
            <Antenna className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Ground Station Receiver (Device 2)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dedicated telemetry receiver running independently on this device. Receives and logs live downlink packets from Sat - M1 over the local network.
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl font-mono text-xs border ${online ? 'border-emerald-500 text-emerald-300 bg-emerald-950/50' : 'border-red-600 text-red-300 bg-red-950/40'}`}>
          {online ? 'RECEIVER ONLINE (PORT 8000)' : 'RECEIVER OFFLINE'}
        </div>
      </div>

      {flash && (
        <div className="rounded-xl border border-red-600 bg-red-950/70 px-3 py-2 text-sm text-red-100 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {flash}
        </div>
      )}

      {!sameOrigin && (
        <div className="glass-panel rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <label>
            GS host
            <input
              value={host}
              onChange={e => setHost(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono"
            />
          </label>
          <label>
            GS port
            <input
              type="number"
              value={port}
              onChange={e => setPort(Number(e.target.value))}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 font-mono"
            />
          </label>
          <button
            onClick={() => void load()}
            className="self-end px-3 py-2 rounded-xl bg-cyan-800 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-amber-200 border border-amber-800 rounded-xl px-3 py-2 bg-amber-950/40 font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Received', stats.received],
          ['Duplicates', stats.duplicates],
          ['Invalid', stats.invalid],
          ['Critical alerts', stats.criticalAlerts]
        ].map(([k, v]) => (
          <div key={String(k)} className="glass-panel rounded-xl p-3">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">{k}</div>
            <div className="text-2xl font-mono text-cyan-200">{v}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <Filter className="w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search packet ID, satellite, health"
            className="flex-1 min-w-[12rem] bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono"
          />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">All priorities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="ROUTINE">ROUTINE</option>
          </select>
          <button
            onClick={() => void clearHistory()}
            className="px-3 py-1.5 rounded-lg border border-red-800 text-red-300 text-xs flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear history
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-1">Packet ID</th>
                <th>SAT</th>
                <th>Received (UTC)</th>
                <th>Pri</th>
                <th>RUL h</th>
                <th>Health</th>
                <th>V / I / T / Flux</th>
                <th>ACK</th>
                <th>Dup</th>
              </tr>
            </thead>
            <tbody>
              {packets.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-slate-500">
                    No packets received yet
                  </td>
                </tr>
              )}
              {packets.map(row => (
                <tr key={row.packet.packet_id} className="border-t border-slate-800">
                  <td className="py-1.5 text-cyan-200">{row.packet.packet_id}</td>
                  <td>{row.packet.satellite_id}</td>
                  <td>{row.received_at}</td>
                  <td className={row.packet.alert_priority === 'CRITICAL' ? 'text-red-400' : ''}>
                    {row.packet.alert_priority === 'CRITICAL' && <ShieldAlert className="inline w-3 h-3 mr-1" />}
                    {row.packet.alert_priority}
                  </td>
                  <td>{row.packet.rul_hours.value ?? '—'}</td>
                  <td className="max-w-[14rem] truncate">{row.packet.health_status}</td>
                  <td>
                    {row.packet.voltage_v.value ?? '—'}V / {row.packet.current_a.value ?? '—'}A /{' '}
                    {row.packet.temperature_c.value ?? '—'}°C / {row.packet.radiation_level.value ?? '—'}
                  </td>
                  <td className="text-emerald-400">ACK</td>
                  <td>{row.duplicate_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 max-h-72 overflow-y-auto">
        <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Reception event log</h3>
        <ul className="space-y-2">
          {events.map(ev => (
            <li key={ev.id} className="text-[11px] border-l-2 border-emerald-800 pl-2">
              <div className="text-slate-500 font-mono">{ev.timestamp}</div>
              <div className="text-slate-200">
                [{ev.category}] {ev.message}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
