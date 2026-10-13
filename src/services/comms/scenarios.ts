import { OnboardCommsController } from './onboardController';

async function drain(controller: OnboardCommsController, maxTicks = 40): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    const before = controller.queue.getAll().filter(
      q => q.status !== 'EXHAUSTED' && q.status !== 'ACKNOWLEDGED'
    ).length;
    await controller.tick();
    const after = controller.queue.getAll().filter(
      q => q.status !== 'EXHAUSTED' && q.status !== 'ACKNOWLEDGED'
    ).length;
    if (controller.contact === 'OUT_OF_CONTACT') return;
    if (after === 0) return;
    if (after === before) {
      await controller.clock.sleep(controller.queue.retry.baseBackoffMs);
    }
  }
}

export async function runDemoScenario(
  controller: OnboardCommsController,
  id: string
): Promise<{ id: string; description: string }> {
  switch (id) {
    case 'A': {
      controller.setContact(true, 'scenario-A');
      controller.link.configure({ packetLossRate: 0, dropNextAck: false });
      controller.generate('ROUTINE', 'SCENARIO_A_NORMAL_OPS');
      controller.generate('ROUTINE', 'SCENARIO_A_NORMAL_OPS');
      controller.log('SCENARIO', 'Scenario A: Normal operations — routine telemetry during open contact', {
        simulated: false
      });
      await drain(controller);
      return { id: 'A', description: 'Routine telemetry transmitted during an open contact window.' };
    }
    case 'B': {
      controller.setContact(false, 'scenario-B');
      controller.generate('ROUTINE', 'SCENARIO_B_STORE_AND_FORWARD');
      controller.generate('ROUTINE', 'SCENARIO_B_STORE_AND_FORWARD');
      controller.generate('ROUTINE', 'SCENARIO_B_STORE_AND_FORWARD');
      controller.log('SCENARIO', 'Scenario B: Ground station unavailable — packets remain onboard', {
        simulated: true
      });
      await controller.tick();
      return { id: 'B', description: 'Contact closed; packets accumulated in the onboard queue.' };
    }
    case 'C': {
      controller.setContact(false, 'scenario-C');
      controller.generate('ROUTINE', 'SCENARIO_C_ROUTINE');
      controller.generate('ROUTINE', 'SCENARIO_C_ROUTINE');
      controller.generate('CRITICAL', 'SCENARIO_C_CRITICAL_RUL_ALERT');
      controller.log('SCENARIO', 'Scenario C: Critical alert queued while disconnected; opening contact', {
        simulated: false
      });
      controller.setContact(true, 'scenario-C');
      await drain(controller);
      return {
        id: 'C',
        description: 'Critical health alert transmitted before routine packets after contact resumed.'
      };
    }
    case 'D': {
      controller.setContact(true, 'scenario-D');
      controller.link.configure({ packetLossRate: 0.5, randomSeed: 7, dropNextAck: false });
      controller.generate('HIGH', 'SCENARIO_D_PACKET_LOSS');
      controller.log('SCENARIO', 'Scenario D: 50% simulated packet loss with seed=7', { simulated: true });
      await drain(controller, 80);
      return { id: 'D', description: 'Packet loss, retry, and acknowledgment demonstrated with a fixed seed.' };
    }
    case 'E': {
      controller.setContact(true, 'scenario-E');
      controller.link.configure({ packetLossRate: 0, dropNextAck: true });
      controller.generate('HIGH', 'SCENARIO_E_LOST_ACK');
      controller.log('SCENARIO', 'Scenario E: First ACK will be dropped (simulated); retransmission should dedupe', {
        simulated: true
      });
      await drain(controller, 40);
      return {
        id: 'E',
        description: 'Lost-ACK recovery: receiver deduplicates and returns the original acknowledgment.'
      };
    }
    case 'F': {
      controller.resetOnboard();
      controller.log('SCENARIO', 'Scenario F: Onboard reset complete. GS history retained unless cleared separately.', {
        simulated: false
      });
      return { id: 'F', description: 'Onboard simulation reset; received telemetry history retained on the ground station.' };
    }
    default:
      throw new Error(`Unknown scenario ${id}`);
  }
}
