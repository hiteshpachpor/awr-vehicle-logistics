export const SIMULATION_INTERVAL_MS = 5_000;
export const SIMULATION_STEP_METERS = 1_000;
export const SIMULATION_INTERVAL_SECONDS_MIN = 1;
export const SIMULATION_INTERVAL_SECONDS_MAX = 60;
export const SIMULATION_STEP_KM_MIN = 0.1;
export const SIMULATION_STEP_KM_MAX = 20;
export const SIMULATION_STEP_METERS_MIN = 100;
export const SIMULATION_STEP_METERS_MAX = 20_000;

export type SimulationPace = {
  intervalMs: number;
  stepMeters: number;
};

export function simulationSpeedKmh(stepMeters: number, intervalMs: number) {
  if (intervalMs <= 0) {
    return 0;
  }
  return (stepMeters / intervalMs) * 3_600;
}

export const SIMULATION_SPEED_KMH = simulationSpeedKmh(
  SIMULATION_STEP_METERS,
  SIMULATION_INTERVAL_MS,
);

export function parseSimulationForm(
  intervalSeconds: string,
  stepKm: string,
): SimulationPace | null {
  const seconds = Number(intervalSeconds);
  const km = Number(stepKm);
  if (
    !Number.isInteger(seconds) ||
    seconds < SIMULATION_INTERVAL_SECONDS_MIN ||
    seconds > SIMULATION_INTERVAL_SECONDS_MAX
  ) {
    return null;
  }
  if (
    !Number.isFinite(km) ||
    km < SIMULATION_STEP_KM_MIN ||
    km > SIMULATION_STEP_KM_MAX
  ) {
    return null;
  }
  const stepMeters = Math.round(km * 1_000);
  if (
    stepMeters < SIMULATION_STEP_METERS_MIN ||
    stepMeters > SIMULATION_STEP_METERS_MAX
  ) {
    return null;
  }
  return { intervalMs: seconds * 1_000, stepMeters };
}

export function formatSimulationPace(pace: SimulationPace) {
  const km = pace.stepMeters / 1_000;
  const seconds = pace.intervalMs / 1_000;
  const speed = simulationSpeedKmh(pace.stepMeters, pace.intervalMs);
  const secondLabel = seconds === 1 ? "second" : "seconds";
  return `${formatQuantity(km)} km every ${formatQuantity(seconds)} ${secondLabel} (${formatQuantity(speed)} km/h)`;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
