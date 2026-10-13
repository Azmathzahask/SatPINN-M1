import { Express, Request, Response } from 'express';
import { GroundStationStore, originAllowed } from './groundStationHandler';

export function applyGroundStationCors(req: Request, res: Response, extraOrigins: string[]): boolean {
  const origin = req.headers.origin;
  if (originAllowed(origin, extraOrigins)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return true;
  }
  return false;
}

export function mountGroundStationRoutes(app: Express, store: GroundStationStore, extraOrigins: string[]): void {
  app.use((req, res, next) => {
    const allowed = applyGroundStationCors(req, res, extraOrigins);
    if (req.method === 'OPTIONS') {
      if (!allowed && req.headers.origin) {
        return res.status(403).json({ status: 'CORS_REJECTED' });
      }
      return res.status(204).end();
    }
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ONLINE',
      role: 'ground-station',
      ready: true,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      stats: store.stats(),
      note: 'Receiver is independent of ESP32 hardware. Contact windows on the sender are simulated.'
    });
  });

  app.get('/api/runtime-config', (_req: Request, res: Response) => {
    res.json({ role: 'ground-station' });
  });

  app.post('/telemetry', (req: Request, res: Response) => {
    const result = store.receive(req.body);
    res.status(result.status).json(result.body);
  });

  app.get('/telemetry', (req: Request, res: Response) => {
    const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({
      status: 'OK',
      stats: store.stats(),
      packets: store.list({ priority, q })
    });
  });

  app.get('/events', (_req: Request, res: Response) => {
    res.json({ status: 'OK', events: store.memory.events.slice(0, 200) });
  });

  app.post('/admin/clear-history', (_req: Request, res: Response) => {
    store.clearHistory();
    res.json({ status: 'CLEARED', stats: store.stats() });
  });
}
