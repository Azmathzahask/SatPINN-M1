import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveDegradationTrajectory,
  calculateRulNewtonRaphson,
  DEFAULT_PINN_PARAMS,
  selectRiskLevel
} from '../src/services/physicsEngine';
import { simulateIntervention } from '../src/services/interventionSimulator';
import {
  runAutonomousAgentDeliberation,
  computeDynamicDegradedRul,
  computeDynamicRecoveredRul
} from '../src/services/autonomousAgent';
import { validateSafetyConstraint } from '../src/services/aerospaceKnowledgeBase';

const SAMPLE_STORM_72H = [
  { timeHours: 0.0, flux: 1200, tempC: 38.6 },
  { timeHours: 1.0, flux: 2800, tempC: 38.6 },
  { timeHours: 2.0, flux: 4200, tempC: 40.5 },
  { timeHours: 6.0, flux: 3800, tempC: 40.0 },
  { timeHours: 12.0, flux: 2500, tempC: 39.0 },
  { timeHours: 24.0, flux: 1200, tempC: 38.6 },
  { timeHours: 48.0, flux: 500, tempC: 38.6 },
  { timeHours: 72.0, flux: 10, tempC: 38.6 }
];

describe('Genuine Physics-Based RUL Recovery & FDIR Agent Evaluation', () => {

  it('1. Never assigns hardcoded recovery (1000, 999, 1200) after intervention', () => {
    const sim = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: 0.0,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    const baselineRul = sim.baselineRul.estimatedRulHours;
    const interventionRul = sim.interventionRul.estimatedRulHours;

    assert.notEqual(interventionRul, 1000, 'Intervention RUL must not be hardcoded to 1000');
    assert.notEqual(interventionRul, 999, 'Intervention RUL must not be hardcoded fallback 999');
    assert.notEqual(interventionRul, 1200, 'Intervention RUL must not be hardcoded 1200');
    assert.ok(interventionRul > baselineRul, 'Intervention RUL should physically exceed baseline');
    assert.ok(interventionRul <= 500.0, `Intervention RUL (${interventionRul}h) should be physically bounded within mission profile horizon`);
  });

  it('2. Telemetry Prioritization yields exactly zero delta RUL', () => {
    const sim = simulateIntervention({
      actionId: 'PRIORITIZE_TELEMETRY',
      initialDegradationVth: -0.20,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    assert.equal(sim.evaluation.deltaRulHours, 0, 'Delta RUL must be exactly 0 for telemetry prioritization');
    assert.equal(sim.evaluation.improvementPercent, 0, 'Improvement percent must be 0%');
    assert.equal(sim.evaluation.hasPhysicalBenefit, false, 'Action must be flagged as having no physical degradation benefit');
    assert.equal(sim.interventionRul.estimatedRulHours, sim.baselineRul.estimatedRulHours);
  });

  it('3. Safe Low Power Mode B produces genuine positive delta RUL via electric field and thermal scaling', () => {
    const sim = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: -0.15,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    assert.ok(sim.evaluation.deltaRulHours > 0, 'Safe Low Power B must produce positive delta RUL');
    assert.ok(sim.evaluation.improvementPercent !== null && sim.evaluation.improvementPercent > 0);
    assert.equal(sim.evaluation.hasPhysicalBenefit, true);
    assert.equal(sim.evaluation.modelValidity, 'PHYSICALLY_VALIDATED');
    assert.match(sim.evaluation.reasoningSummary, /reducing gate-oxide field/);
  });

  it('4. Preserves accumulated degradation state D(t0) without resetting to zero', () => {
    const accumulatedDamage = -0.65;
    const sim = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: accumulatedDamage,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    assert.equal(sim.baselineTrajectory[0].deltaVthPinn, accumulatedDamage, 'Baseline trajectory must start at D(t0)');
    assert.equal(sim.interventionTrajectory[0].deltaVthPinn, accumulatedDamage, 'Intervention trajectory must start at D(t0)');

    // Starting with pre-accumulated damage must produce lower RUL than starting at 0 damage
    const simFresh = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: 0.0,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });
    assert.ok(sim.interventionRul.estimatedRulHours < simFresh.interventionRul.estimatedRulHours);
  });

  it('5. Returns RUL = 0 with THRESHOLD_EXCEEDED_AT_INIT when threshold is already violated', () => {
    const sim = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: -1.55,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    assert.equal(sim.baselineRul.estimatedRulHours, 0.0);
    assert.equal(sim.baselineRul.predictionStatus, 'THRESHOLD_EXCEEDED_AT_INIT');
    assert.equal(sim.interventionRul.estimatedRulHours, 0.0);
    assert.equal(sim.interventionRul.predictionStatus, 'THRESHOLD_EXCEEDED_AT_INIT');
    assert.equal(sim.evaluation.deltaRulHours, 0.0);
  });

  it('6. Reports THRESHOLD_NOT_REACHED_WITHIN_HORIZON when degradation does not cross threshold', () => {
    const quietProfile = [
      { timeHours: 0.0, flux: 1.0, tempC: 25.0 },
      { timeHours: 50.0, flux: 1.2, tempC: 25.0 },
      { timeHours: 100.0, flux: 1.1, tempC: 25.0 }
    ];

    const traj = solveDegradationTrajectory(quietProfile, DEFAULT_PINN_PARAMS, 1.0, 1.20, 0.0);
    const result = calculateRulNewtonRaphson(traj, -2.50);

    assert.equal(result.predictionStatus, 'THRESHOLD_NOT_REACHED_WITHIN_HORIZON');
    assert.equal(result.estimatedRulHours, 100.0);
    assert.notEqual(result.estimatedRulHours, 1200, 'Should not return legacy 1200 default');
  });

  it('7. Deterministic Safety Validator blocks invalid profiles and thermal violations', () => {
    const badProfile = validateSafetyConstraint('INVALID_PROFILE' as any, 'CRITICAL', 35.0, 1.20);
    assert.equal(badProfile.passed, false);
    assert.match(badProfile.rejectionReason || '', /not in the pre-qualified/);

    const thermalViolation = validateSafetyConstraint('SAFE_LOW_POWER_B', 'CRITICAL', 68.0, 1.20);
    assert.equal(thermalViolation.passed, false);
    assert.equal(thermalViolation.thermalSafe, false);
    assert.match(thermalViolation.rejectionReason || '', /exceeds safety ceiling 55.0°C/);

    const validNominal = validateSafetyConstraint('SAFE_LOW_POWER_B', 'CRITICAL', 38.0, 1.20);
    assert.equal(validNominal.passed, true);
    assert.equal(validNominal.voltageSafe, true);
    assert.equal(validNominal.thermalSafe, true);
  });

  it('8. Deterministic consistency: identical inputs produce identical predictions', () => {
    const run1 = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: -0.10,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    const run2 = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: -0.10,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    assert.equal(run1.baselineRul.estimatedRulHours, run2.baselineRul.estimatedRulHours);
    assert.equal(run1.interventionRul.estimatedRulHours, run2.interventionRul.estimatedRulHours);
    assert.equal(run1.evaluation.deltaRulHours, run2.evaluation.deltaRulHours);
  });

  it('9. Cognitive Agent returns structured Comparison Table with all required columns', () => {
    const decision = runAutonomousAgentDeliberation({
      protonFlux: 4200,
      fluencePfuHours: 4200 * 24,
      coreVdd: 1.20,
      currentMa: 82.4,
      powerMw: 98.88,
      dieTempC: 38.6,
      currentDegradationVth: -0.05,
      failureThresholdVth: -1.50,
      riskBand: 'CRITICAL',
      timestamp: new Date().toISOString()
    });

    assert.ok(decision.comparisonTable.length >= 4, 'Must evaluate at least 4 candidate policies');

    for (const row of decision.comparisonTable) {
      assert.ok(row.action, 'Action name required');
      assert.ok(row.initialDegradation, 'Initial degradation required');
      assert.ok(row.threshold, 'Failure threshold required');
      assert.ok(row.operatingVdd, 'Operating Vdd required');
      assert.ok(row.predictedRul, 'Predicted Rul required');
      assert.ok(row.deltaRul, 'Delta Rul required');
      assert.ok(row.improvement, 'Improvement percent required');
      assert.ok(row.validity, 'Validity explanation required');
    }

    assert.ok(decision.selectedPolicy, 'Agent must select an optimal policy');
    assert.ok(decision.projectedRecoveredRul > decision.degradedRulHours, 'Recovered RUL must exceed degraded RUL');
  });

  it('10. Safely handles percentage calculation when baseline RUL is 0 (returns null)', () => {
    const sim = simulateIntervention({
      actionId: 'SAFE_LOW_POWER_B',
      initialDegradationVth: -1.50,
      failureThresholdVth: -1.50,
      fluxProfile: SAMPLE_STORM_72H,
      baselineVdd: 1.20,
      baselineTempC: 38.6
    });

    assert.equal(sim.evaluation.improvementPercent, null, 'Improvement % must be null when baseline RUL is 0');
    assert.equal(isNaN(sim.evaluation.improvementPercent as any), false);
  });

  it('11. Dynamic degraded RUL decreases with increased CME solar proton flux', () => {
    const mildRul = computeDynamicDegradedRul(200);
    const moderateRul = computeDynamicDegradedRul(1500);
    const severeRul = computeDynamicDegradedRul(10000);

    assert.ok(mildRul > moderateRul, `Mild flux RUL (${mildRul}h) must be higher than moderate (${moderateRul}h)`);
    assert.ok(moderateRul > severeRul, `Moderate flux RUL (${moderateRul}h) must be higher than severe (${severeRul}h)`);
  });

  it('12. Agent multi-objective utility ranking balances RUL gain, mission impact, and safety', () => {
    const decision = runAutonomousAgentDeliberation({
      protonFlux: 4200,
      fluencePfuHours: 4200 * 24,
      coreVdd: 1.20,
      currentMa: 82.4,
      powerMw: 98.88,
      dieTempC: 38.6,
      currentDegradationVth: -0.10,
      failureThresholdVth: -1.50,
      riskBand: 'CRITICAL',
      timestamp: new Date().toISOString()
    });

    // Highest utility policy must be ranked #1
    const topRanked = decision.candidatePolicies.find(p => p.id === decision.utilityRanking[0].id);
    assert.equal(topRanked?.id, decision.selectedPolicy.id);

    // Telemetry-only policy has deltaRul = 0 and must not be selected over Safe Mode in CRITICAL band
    const telemPolicy = decision.candidatePolicies.find(p => p.actionId === 'PRIORITIZE_TELEMETRY');
    assert.notEqual(decision.selectedPolicy.id, telemPolicy?.id);
  });

  it('13. Nominal quiet space environment: RUL is > 1000h (Case 4: Healthy)', () => {
    const nominalRul = computeDynamicDegradedRul(1.2, 38.6);
    assert.ok(nominalRul > 1000, `Nominal RUL (${nominalRul}h) must be strictly greater than 1000 hours`);
    const risk = selectRiskLevel(nominalRul);
    assert.equal(risk, 'HEALTHY', 'Nominal quiet environment must classify as Case 4: HEALTHY');
  });

  it('14. CME solar proton spike: RUL falls below 100h (Case 1: Critical)', () => {
    const cmeRul = computeDynamicDegradedRul(4200, 38.6);
    assert.ok(cmeRul < 100, `CME spike RUL (${cmeRul}h) must fall strictly below 100 hours`);
    const risk = selectRiskLevel(cmeRul);
    assert.equal(risk, 'CRITICAL', 'CME spike condition must classify as Case 1: CRITICAL');
  });

  it('15. Mitigation recovery under Safe Mode B: RUL rises to above 200h (Case 2: High Risk / Case 3: Warning)', () => {
    const recoveredRul = computeDynamicRecoveredRul(4200, 38.6, 'SAFE_LOW_POWER_B');
    assert.ok(recoveredRul > 200, `Recovered RUL (${recoveredRul}h) must be strictly greater than 200 hours`);
    const risk = selectRiskLevel(recoveredRul);
    assert.ok(risk === 'HIGH_RISK' || risk === 'WARNING', `Recovered risk level (${risk}) must be HIGH_RISK or WARNING`);
  });

  it('16. selectRiskLevel enforces exact deterministic 4-case classification boundaries', () => {
    // Invalid / unavailable cases
    assert.equal(selectRiskLevel(null as any), 'INVALID_OR_UNAVAILABLE');
    assert.equal(selectRiskLevel(undefined as any), 'INVALID_OR_UNAVAILABLE');
    assert.equal(selectRiskLevel(-10), 'INVALID_OR_UNAVAILABLE');
    assert.equal(selectRiskLevel(NaN), 'INVALID_OR_UNAVAILABLE');

    // Case 1 — Critical (<= 100h)
    assert.equal(selectRiskLevel(0), 'CRITICAL');
    assert.equal(selectRiskLevel(50), 'CRITICAL');
    assert.equal(selectRiskLevel(100), 'CRITICAL');

    // Case 2 — High Risk (100–250h)
    assert.equal(selectRiskLevel(100.1), 'HIGH_RISK');
    assert.equal(selectRiskLevel(200), 'HIGH_RISK');
    assert.equal(selectRiskLevel(250), 'HIGH_RISK');

    // Case 3 — Warning (250–500h)
    assert.equal(selectRiskLevel(250.1), 'WARNING');
    assert.equal(selectRiskLevel(350), 'WARNING');
    assert.equal(selectRiskLevel(500), 'WARNING');

    // Case 4 — Healthy (> 500h)
    assert.equal(selectRiskLevel(500.1), 'HEALTHY');
    assert.equal(selectRiskLevel(1000), 'HEALTHY');
    assert.equal(selectRiskLevel(1500), 'HEALTHY');
  });

});
