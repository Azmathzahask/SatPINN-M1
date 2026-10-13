import { HardwareTelemetry, RulCalculationResult, SpaceWeatherRecord } from '../../types';
import { FieldProvenance, TelemetrySnapshot } from '../../types/comms';

function telemetryProvenance(origin: HardwareTelemetry['origin']): FieldProvenance {
  return origin === 'MEASURED' ? 'MEASURED' : 'SIMULATED';
}

export function snapshotFromMissionState(input: {
  telemetry: HardwareTelemetry;
  rul: RulCalculationResult;
  latestWeather?: SpaceWeatherRecord;
}): TelemetrySnapshot {
  const { telemetry, rul, latestWeather } = input;
  const tProv = telemetryProvenance(telemetry.origin);
  return {
    satelliteId: 'SAT-M1',
    temperatureC: telemetry.probeTempC,
    temperatureProvenance: tProv,
    voltageV: telemetry.vdd,
    voltageProvenance: tProv,
    currentA: Number((telemetry.currentMa / 1000).toFixed(6)),
    currentProvenance: tProv,
    radiationLevel: latestWeather ? latestWeather.flux : null,
    radiationProvenance: latestWeather
      ? latestWeather.origin === 'MEASURED'
        ? 'EXTERNAL_OBSERVATION'
        : 'SIMULATED'
      : 'UNAVAILABLE',
    rulHours: rul.estimatedRulHours,
    rulProvenance: 'MODEL_PREDICTION',
    healthStatus: `${rul.riskBand} | profile=${telemetry.activeProfile} | origin=${telemetry.origin}`
  };
}
