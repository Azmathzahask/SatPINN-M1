/**
 * Ground Station receiver — run on Computer 2.
 * Stores telemetry independently of the ESP32 hardware subsystem.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GroundStationStore } from './src/services/comms/groundStationHandler';
import { mountGroundStationRoutes } from './src/services/comms/mountGroundStation';
import { startGroundStationBeacon, getLocalIpv4Addresses } from './src/services/comms/discovery';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.GS_PORT || 8000);
const HOST = process.env.GS_BIND || '0.0.0.0';
const extraOrigins = (process.env.GS_CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const persistDir = process.env.GS_DATA_DIR || path.resolve(__dirname, 'data', 'ground-station');
const store = new GroundStationStore(persistDir);

const app = express();
app.use(express.json({ limit: '64kb' }));
mountGroundStationRoutes(app, store, extraOrigins);

// Start UDP discovery beacon so Satellite device automatically detects this Ground Station on the same Wi-Fi / Hotspot
startGroundStationBeacon(PORT);

async function start() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    const localIps = getLocalIpv4Addresses();
    console.log(`\n=================================================================`);
    console.log(`[Ground-Station] Receiver ONLINE on Device 2 at port ${PORT}`);
    console.log(`[Ground-Station] Local URL: http://localhost:${PORT}`);
    for (const ip of localIps) {
      console.log(`[Ground-Station] Network URL: http://${ip}:${PORT}`);
    }
    console.log(`[Ground-Station] Telemetry Endpoint: POST /telemetry`);
    console.log(`[Ground-Station] Broadcaster beacon active for same-network auto-pairing.`);
    console.log(`=================================================================\n`);
  });
}

start();
