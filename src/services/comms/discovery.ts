/**
 * Same-Network Auto-Discovery Service for Satellite and Ground Station
 * Supports UDP Broadcast Beacons + Fast Subnet HTTP Scanning
 */

import os from 'os';
import dgram from 'dgram';

export const DEFAULT_DISCOVERY_PORT = 8002;

export interface DiscoveredGroundStation {
  host: string;
  port: number;
  hostname?: string;
  source: 'UDP_BEACON' | 'SUBNET_SCAN' | 'MANUAL';
  lastSeen: number;
}

export function getLocalIpv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const info of ifaceList) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address);
      }
    }
  }

  return addresses;
}

export function getLocalSubnetPrefixes(): string[] {
  const ips = getLocalIpv4Addresses();
  const prefixes = new Set<string>();

  for (const ip of ips) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      prefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
    }
  }

  return Array.from(prefixes);
}

/**
 * Starts a UDP beacon on the Ground Station device.
 * Periodically broadcasts its presence to the local network and responds to discovery requests.
 */
export function startGroundStationBeacon(
  httpPort = 8000,
  discoveryPort = DEFAULT_DISCOVERY_PORT
): { close: () => void } {
  let socket: dgram.Socket | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;

  try {
    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.warn(`[GS-Discovery] Socket error: ${err.message}`);
    });

    socket.on('message', (msg, rinfo) => {
      try {
        const text = msg.toString('utf8');
        const data = JSON.parse(text);
        if (data.type === 'GS_DISCOVER' && socket) {
          const localIps = getLocalIpv4Addresses();
          const response = Buffer.from(
            JSON.stringify({
              type: 'GS_BEACON',
              role: 'ground-station',
              port: httpPort,
              ips: localIps,
              hostname: os.hostname(),
              time: Date.now()
            })
          );
          socket.send(response, 0, response.length, rinfo.port, rinfo.address, () => {});
        }
      } catch {
        // Ignore unparseable frames
      }
    });

    socket.bind(discoveryPort, () => {
      try {
        socket?.setBroadcast(true);
      } catch {
        // Broadcast set failure fallback
      }
      console.log(`[Ground-Station] Discovery beacon broadcaster active on UDP ${discoveryPort}`);

      const sendBeacon = () => {
        if (!socket) return;
        const localIps = getLocalIpv4Addresses();
        const payload = Buffer.from(
          JSON.stringify({
            type: 'GS_BEACON',
            role: 'ground-station',
            port: httpPort,
            ips: localIps,
            hostname: os.hostname(),
            time: Date.now()
          })
        );
        socket.send(payload, 0, payload.length, discoveryPort, '255.255.255.255', () => {});
      };

      sendBeacon();
      intervalTimer = setInterval(sendBeacon, 2500);
    });
  } catch (err) {
    console.warn(`[GS-Discovery] Could not initialize UDP beacon: ${err}`);
  }

  return {
    close: () => {
      if (intervalTimer) clearInterval(intervalTimer);
      if (socket) {
        try {
          socket.close();
        } catch {}
      }
    }
  };
}

/**
 * Starts a Satellite discovery listener that listens for Ground Station UDP beacons
 * and sends periodic discovery pings.
 */
export function startSatelliteDiscovery(
  onDiscovered: (station: DiscoveredGroundStation) => void,
  discoveryPort = DEFAULT_DISCOVERY_PORT
): { close: () => void; pingNow: () => void } {
  let socket: dgram.Socket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const pingNow = () => {
    if (!socket) return;
    try {
      const pingMsg = Buffer.from(JSON.stringify({ type: 'GS_DISCOVER', time: Date.now() }));
      socket.send(pingMsg, 0, pingMsg.length, discoveryPort, '255.255.255.255', () => {});
    } catch {}
  };

  try {
    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.warn(`[Sat-Discovery] UDP error: ${err.message}`);
    });

    socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString('utf8'));
        if (data.type === 'GS_BEACON' && data.role === 'ground-station') {
          const stationHost = rinfo.address || (Array.isArray(data.ips) && data.ips[0]) || '127.0.0.1';
          const stationPort = Number(data.port) || 8000;
          onDiscovered({
            host: stationHost,
            port: stationPort,
            hostname: data.hostname,
            source: 'UDP_BEACON',
            lastSeen: Date.now()
          });
        }
      } catch {}
    });

    socket.bind(0, () => {
      try {
        socket?.setBroadcast(true);
      } catch {}
      pingNow();
      pingTimer = setInterval(pingNow, 4000);
    });
  } catch (err) {
    console.warn(`[Sat-Discovery] Could not initialize UDP discovery listener: ${err}`);
  }

  return {
    close: () => {
      if (pingTimer) clearInterval(pingTimer);
      if (socket) {
        try {
          socket.close();
        } catch {}
      }
    },
    pingNow
  };
}

/**
 * Fast asynchronous scan of the local subnet(s) for a Ground Station receiver.
 * Checks http://<ip>:<port>/health for role === 'ground-station'.
 */
export async function scanSubnetForGroundStation(
  httpPort = 8000,
  timeoutMs = 450
): Promise<DiscoveredGroundStation | null> {
  const prefixes = getLocalSubnetPrefixes();
  const ownIps = new Set(getLocalIpv4Addresses());

  const checkCandidate = async (ip: string): Promise<DiscoveredGroundStation | null> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`http://${ip}:${httpPort}/health`, {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.role === 'ground-station') {
        return {
          host: ip,
          port: httpPort,
          source: 'SUBNET_SCAN',
          lastSeen: Date.now()
        };
      }
    } catch {
      // Offline / no response
    }
    return null;
  };

  // Check localhost first as quick test
  const localCheck = await checkCandidate('127.0.0.1');
  if (localCheck) return localCheck;

  // Build target IP list across all subnets
  const candidateIps: string[] = [];
  for (const prefix of prefixes) {
    for (let hostNum = 1; hostNum <= 254; hostNum++) {
      const candidate = `${prefix}.${hostNum}`;
      if (!ownIps.has(candidate)) {
        candidateIps.push(candidate);
      }
    }
  }

  // Scan in batches of 25
  const batchSize = 25;
  for (let i = 0; i < candidateIps.length; i += batchSize) {
    const batch = candidateIps.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(ip => checkCandidate(ip)));
    const found = results.find((r): r is DiscoveredGroundStation => r !== null);
    if (found) {
      return found;
    }
  }

  return null;
}
