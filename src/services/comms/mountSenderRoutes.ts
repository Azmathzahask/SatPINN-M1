import { Express, Request, Response } from 'express';
import { AlertPriority, TelemetrySnapshot } from '../../types/comms';
import { OnboardCommsController } from './onboardController';
import { runDemoScenario } from './scenarios';
import { getLocalIpv4Addresses, scanSubnetForGroundStation } from './discovery';

function isPriority(value: unknown): value is AlertPriority {
  return value === 'CRITICAL' || value === 'HIGH' || value === 'ROUTINE';
}

export function mountSenderCommsRoutes(app: Express, controller: OnboardCommsController): void {
  app.get('/api/runtime-config', (_req: Request, res: Response) => {
    res.json({
      role: 'sender',
      satelliteId: controller.satelliteId,
      defaultGs: controller.gs
    });
  });

  app.get('/api/comms/network', (_req: Request, res: Response) => {
    const localIps = getLocalIpv4Addresses();
    res.json({
      localIps,
      gsHost: controller.gs.host,
      gsPort: controller.gs.port,
      gsReachable: controller.gsReachable,
      inContact: controller.contact === 'IN_CONTACT',
      autoTelemetry: controller.autoTelemetry
    });
  });

  app.post('/api/comms/scan-network', async (_req: Request, res: Response) => {
    try {
      const found = await scanSubnetForGroundStation(controller.gs.port || 8000, 450);
      if (found) {
        controller.configure({ gsHost: found.host, gsPort: found.port });
        controller.setContact(true, 'network-scan-discovered');
        controller.log('LINK', `Discovered Ground Station on same network at ${found.host}:${found.port}`, {
          simulated: false
        });
        return res.json({
          status: 'FOUND',
          station: found,
          state: controller.getState()
        });
      }
      return res.json({
        status: 'NOT_FOUND',
        message: 'No Ground Station found on the local subnet. Ensure Computer 2 is running "npm run ground-station" and connected to the same Wi-Fi/Hotspot.',
        state: controller.getState()
      });
    } catch (err) {
      res.status(500).json({ status: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/comms/state', (_req: Request, res: Response) => {
    res.json(controller.getState());
  });

  app.post('/api/comms/snapshot', (req: Request, res: Response) => {
    controller.updateSnapshot(req.body as TelemetrySnapshot);
    res.json({ status: 'OK', snapshot: controller.snapshot });
  });

  app.post('/api/comms/contact', (req: Request, res: Response) => {
    controller.setContact(Boolean(req.body?.open), req.body?.reason || 'operator');
    res.json(controller.getState());
  });

  app.post('/api/comms/config', (req: Request, res: Response) => {
    const body = req.body || {};
    controller.configure({
      gsHost: body.gsHost,
      gsPort: typeof body.gsPort === 'number' ? body.gsPort : body.gsPort ? Number(body.gsPort) : undefined,
      packetLossRate: typeof body.packetLossRate === 'number' ? body.packetLossRate : undefined,
      delayMs: typeof body.delayMs === 'number' ? body.delayMs : undefined,
      randomSeed: body.randomSeed === null || typeof body.randomSeed === 'number' ? body.randomSeed : undefined,
      dropNextAck: typeof body.dropNextAck === 'boolean' ? body.dropNextAck : undefined,
      autoWindows: typeof body.autoWindows === 'boolean' ? body.autoWindows : undefined
    });
    res.json(controller.getState());
  });

  app.post('/api/comms/generate', (req: Request, res: Response) => {
    if (req.body?.snapshot) controller.updateSnapshot(req.body.snapshot);
    const kind = req.body?.kind === 'critical' ? 'CRITICAL' : req.body?.kind === 'high' ? 'HIGH' : 'ROUTINE';
    const priority = isPriority(req.body?.priority) ? req.body.priority : kind;
    try {
      const packet = controller.generate(priority, req.body?.payloadSource);
      res.json({ status: 'QUEUED', packet, state: controller.getState() });
    } catch (err) {
      res.status(400).json({ status: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/comms/auto', (req: Request, res: Response) => {
    controller.setAutoTelemetry(Boolean(req.body?.enabled));
    res.json(controller.getState());
  });

  app.post('/api/comms/reset', (req: Request, res: Response) => {
    controller.resetOnboard();
    res.json({
      status: 'RESET',
      clearedGroundHistory: false,
      note: 'Onboard queue reset. Ground-station history is retained unless you clear it on Computer 2.',
      state: controller.getState(),
      requestClearHistory: Boolean(req.body?.clearHistory)
    });
  });

  app.post('/api/comms/probe', async (_req: Request, res: Response) => {
    const ok = await controller.probeGroundStation();
    res.json({ reachable: ok, healthUrl: controller.healthUrl(), state: controller.getState() });
  });

  app.post('/api/comms/scenarios/:id', async (req: Request, res: Response) => {
    try {
      if (req.body?.snapshot) controller.updateSnapshot(req.body.snapshot);
      const result = await runDemoScenario(controller, String(req.params.id).toUpperCase());
      res.json({ status: 'OK', ...result, state: controller.getState() });
    } catch (err) {
      res.status(400).json({ status: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
  });
}
