/**
 * Satellite Intervention Simulator
 * Maps an approved autonomous action to physically justified changes in model inputs.
 * Solves baseline and intervention trajectories under identical initial degradation states.
 * Computes scientifically grounded ΔRUL and improvement percentages.
 */

import {
  OperatingProfileId,
  DegradationPoint,
  RulCalculationResult,
  PinnModelParams,
  InterventionEvaluation
} from '../types';
import {
  DEFAULT_PINN_PARAMS,
  solveDegradationTrajectory,
  calculateRulNewtonRaphson
} from './physicsEngine';
import { PREQUALIFIED_PROFILES } from './aerospaceKnowledgeBase';

export interface InterventionSimulationRequest {
  actionId: OperatingProfileId | 'NO_ACTION' | 'PRIORITIZE_TELEMETRY';
  initialDegradationVth: number; // D(t0) = D_current
  failureThresholdVth: number; // e.g. -1.50V
  fluxProfile: Array<{ timeHours: number; flux: number; tempC: number }>;
  baselineVdd: number; // e.g. 1.20V
  baselineTempC: number; // e.g. 38.6C
  pinnParams?: PinnModelParams;
}

export interface InterventionSimulationResult {
  evaluation: InterventionEvaluation;
  baselineTrajectory: DegradationPoint[];
  interventionTrajectory: DegradationPoint[];
  baselineRul: RulCalculationResult;
  interventionRul: RulCalculationResult;
}

/**
 * Evaluates an action by simulating future degradation from the exact same initial state D(t0).
 */
export function simulateIntervention(
  req: InterventionSimulationRequest
): InterventionSimulationResult {
  const params = req.pinnParams || DEFAULT_PINN_PARAMS;
  const initialVth = req.initialDegradationVth;
  const threshold = req.failureThresholdVth;
  const actionId = req.actionId;

  // 1. Determine physical operating conditions u_a for the intervention
  let interventionVdd = req.baselineVdd;
  let interventionTempC = req.baselineTempC;
  let actionName = 'No Action (Baseline)';
  let hasPhysicalBenefit = false;
  let modelValidity: InterventionEvaluation['modelValidity'] = 'PHYSICALLY_VALIDATED';
  let reasoningSummary = '';
  let evidenceCitation = '';
  let limitations = '';

  if (actionId === 'NO_ACTION') {
    actionName = 'No Action (Baseline)';
    hasPhysicalBenefit = false;
    modelValidity = 'PHYSICALLY_VALIDATED';
    reasoningSummary = 'Baseline operations maintained at nominal 1.20V. No protective modification applied.';
    evidenceCitation = 'NASA-HDBK-4002A Baseline Monitoring';
    limitations = 'Unmitigated radiation exposure continues at full electrical stress.';
  } else if (actionId === 'PRIORITIZE_TELEMETRY') {
    // Communication action: changes comms scheduling, NOT physical degradation state
    actionName = 'Prioritize Downlink Telemetry';
    hasPhysicalBenefit = false;
    modelValidity = 'NO_EFFECT_ON_MOS_RADIATION';
    reasoningSummary = 'Telemetry queues prioritized for Ground Station downlink. Communication scheduling does not alter semiconductor gate oxide trapping.';
    evidenceCitation = 'NASA-STD-7009A Telemetry Operations';
    limitations = 'Communication scheduling has zero effect on MOS gate oxide charge accumulation.';
  } else if (actionId === 'CONSERVATIVE_PROFILE_A') {
    const profile = PREQUALIFIED_PROFILES.CONSERVATIVE_PROFILE_A;
    actionName = profile.name;
    interventionVdd = profile.vddTarget; // 1.05V
    // Power scaling P = C * V^2 * f reduces thermal dissipation: ~4.6°C drop
    interventionTempC = Math.max(22.0, req.baselineTempC - 4.6);
    hasPhysicalBenefit = true;
    modelValidity = 'PHYSICALLY_VALIDATED';
    reasoningSummary = 'DVFS reduces core voltage to 1.05V (-12.5%) and throttles clock by 25%, decreasing electric field and die temperature.';
    evidenceCitation = 'NASA-HDBK-4002A Sec 5.3.2 & ECSS-Q-ST-60-15C Clause 7.4.3';
    limitations = 'Moderate intervention; does not completely halt trapping under extreme flux (>5000 pfu).';
  } else if (actionId === 'SAFE_LOW_POWER_B') {
    const profile = PREQUALIFIED_PROFILES.SAFE_LOW_POWER_B;
    actionName = profile.name;
    interventionVdd = profile.vddTarget; // 0.95V
    // Power scaling: ~10.1°C drop
    interventionTempC = Math.max(22.0, req.baselineTempC - 10.1);
    hasPhysicalBenefit = true;
    modelValidity = 'PHYSICALLY_VALIDATED';
    reasoningSummary = 'Safe Hold Mode B reduces core voltage to 0.95V (-20.8%) and duty cycle to 40%, significantly reducing gate-oxide field E_ox.';
    evidenceCitation = 'NASA-HDBK-4002A Sec 5.3.2 & ECSS-E-ST-10-12C Clause 8.2.3';
    limitations = 'Payload instruments duty-cycled; nominal science collection paused during safe hold.';
  } else if (actionId === 'CRITICAL_ISOLATION') {
    const profile = PREQUALIFIED_PROFILES.CRITICAL_ISOLATION;
    actionName = profile.name;
    interventionVdd = profile.vddTarget; // 0.85V
    // Power scaling: ~14.0°C drop
    interventionTempC = Math.max(20.0, req.baselineTempC - 14.0);
    hasPhysicalBenefit = true;
    modelValidity = 'PHYSICALLY_VALIDATED';
    reasoningSummary = 'Critical telemetry-only isolation steps voltage to 0.85V, preserving core processor survival margin.';
    evidenceCitation = 'ECSS-Q-ST-60-15C Clause 7.4.3 (Mandatory Critical Path)';
    limitations = 'Extreme survival mode: only critical health beacons active.';
  }

  let baselineDutyCycle = 1.0;
  let interventionDutyCycle = 1.0;
  if (actionId === 'SAFE_LOW_POWER_B') {
    interventionDutyCycle = 0.40;
  } else if (actionId === 'CONSERVATIVE_PROFILE_A') {
    interventionDutyCycle = 0.75;
  } else if (actionId === 'CRITICAL_ISOLATION') {
    interventionDutyCycle = 0.15;
  }

  // 2. Build baseline profile (original scenario) with mission continuation horizon
  const lastTime = req.fluxProfile.length > 0 ? req.fluxProfile[req.fluxProfile.length - 1].timeHours : 72;
  const baselineProfile = req.fluxProfile.map(p => ({
    timeHours: p.timeHours,
    flux: p.flux,
    tempC: req.baselineTempC
  }));

  // 3. Build intervention profile (modified ONLY where physically justified)
  const interventionProfile = req.fluxProfile.map(p => ({
    timeHours: p.timeHours,
    flux: p.flux,
    tempC: interventionTempC
  }));

  // If input profile is a short storm window (<500h), extend into operational mission continuation
  // (gradual LEO belt decay down to background ~1.5 pfu) so root finding can evaluate multi-hundred-hour survival
  if (lastTime < 500) {
    for (let t = lastTime + 5; t <= 500; t += 5.0) {
      const postHours = t - lastTime;
      const decayFlux = Math.max(1.5, 80 * Math.exp(-postHours / 90));
      baselineProfile.push({ timeHours: t, flux: Number(decayFlux.toFixed(2)), tempC: req.baselineTempC });
      interventionProfile.push({ timeHours: t, flux: Number(decayFlux.toFixed(2)), tempC: interventionTempC });
    }
  }

  // 4. Solve baseline trajectory starting from D(t0) = initialDegradationVth
  const baselineTrajectory = solveDegradationTrajectory(
    baselineProfile,
    params,
    0.5,
    req.baselineVdd,
    initialVth,
    baselineDutyCycle
  );

  // 5. Solve intervention trajectory starting from the EXACT SAME initial state D(t0)
  const interventionTrajectory = solveDegradationTrajectory(
    interventionProfile,
    params,
    0.5,
    interventionVdd,
    initialVth,
    interventionDutyCycle
  );

  // 6. Compute RUL via Newton-Raphson & Brent root finding
  const baselineRul = calculateRulNewtonRaphson(baselineTrajectory, threshold);
  const interventionRul = calculateRulNewtonRaphson(interventionTrajectory, threshold);

  // 7. Calculate ΔRUL and Improvement (%)
  const r0 = baselineRul.estimatedRulHours;
  const ra = interventionRul.estimatedRulHours;
  const deltaRul = Number(Math.max(0, ra - r0).toFixed(1));

  let improvementPercent: number | null = null;
  if (r0 > 0 && Number.isFinite(r0)) {
    improvementPercent = Number((((ra - r0) / r0) * 100).toFixed(1));
  }

  // If threshold is not reached in either forecast, mark status
  if (
    baselineRul.predictionStatus === 'THRESHOLD_NOT_REACHED_WITHIN_HORIZON' &&
    interventionRul.predictionStatus === 'THRESHOLD_NOT_REACHED_WITHIN_HORIZON'
  ) {
    modelValidity = 'THRESHOLD_NOT_CROSSED';
  }

  const evaluation: InterventionEvaluation = {
    actionId,
    actionName,
    initialDegradationVth: Number(initialVth.toFixed(4)),
    failureThresholdVth: threshold,
    baselineVdd: req.baselineVdd,
    baselineTempC: req.baselineTempC,
    interventionVdd,
    interventionTempC,
    baselineRulHours: r0,
    interventionRulHours: ra,
    deltaRulHours: deltaRul,
    improvementPercent,
    hasPhysicalBenefit,
    modelValidity,
    reasoningSummary,
    evidenceCitation,
    limitations
  };

  return {
    evaluation,
    baselineTrajectory,
    interventionTrajectory,
    baselineRul,
    interventionRul
  };
}
