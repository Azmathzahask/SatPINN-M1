import { LinkSimConfig } from '../../types/comms';
import { createRng } from './seededRng';

/**
 * Simulated RF-like conditions. This does not model real propagation,
 * orbital geometry, or link-budget physics.
 */
export class LinkSimulator {
  private rng: { next(): number };
  private config: LinkSimConfig;

  constructor(config?: Partial<LinkSimConfig>) {
    this.config = {
      packetLossRate: 0,
      delayMs: 200,
      randomSeed: 42,
      dropNextAck: false,
      forceDrop: false,
      ...config
    };
    this.rng = createRng(this.config.randomSeed);
  }

  getState(): LinkSimConfig {
    return { ...this.config };
  }

  configure(patch: Partial<LinkSimConfig>): void {
    if (patch.packetLossRate !== undefined) {
      this.config.packetLossRate = Math.min(0.5, Math.max(0, patch.packetLossRate));
    }
    if (patch.delayMs !== undefined) {
      this.config.delayMs = Math.min(10_000, Math.max(0, Math.round(patch.delayMs)));
    }
    if (patch.randomSeed !== undefined) {
      this.config.randomSeed = patch.randomSeed;
      this.rng = createRng(this.config.randomSeed);
    }
    if (patch.dropNextAck !== undefined) {
      this.config.dropNextAck = patch.dropNextAck;
    }
    if (patch.forceDrop !== undefined) {
      this.config.forceDrop = patch.forceDrop;
    }
  }

  /** Simulated loss: the packet must not be sent on the real network for this attempt. */
  shouldDropAttempt(): boolean {
    if (this.config.forceDrop) return true;
    if (this.config.packetLossRate <= 0) return false;
    return this.rng.next() < this.config.packetLossRate;
  }

  consumeDropNextAck(): boolean {
    if (!this.config.dropNextAck) return false;
    this.config.dropNextAck = false;
    return true;
  }

  delayMs(): number {
    return this.config.delayMs;
  }
}
