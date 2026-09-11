import { describe, expect, it } from "vitest";
import {
  formatSimulationPace,
  parseSimulationForm,
  SIMULATION_SPEED_KMH,
  simulationSpeedKmh,
} from "./simulation";

describe("simulation pace", () => {
  it("derives kilometres per hour from distance and interval", () => {
    expect(simulationSpeedKmh(1_000, 5_000)).toBe(SIMULATION_SPEED_KMH);
    expect(simulationSpeedKmh(3_000, 10_000)).toBe(1_080);
  });

  it("parses a driver interval and distance into API units", () => {
    expect(parseSimulationForm("10", "3")).toEqual({
      intervalMs: 10_000,
      stepMeters: 3_000,
    });
    expect(parseSimulationForm("5", "1")).toEqual({
      intervalMs: 5_000,
      stepMeters: 1_000,
    });
    expect(parseSimulationForm("1", "0.1")).toEqual({
      intervalMs: 1_000,
      stepMeters: 100,
    });
  });

  it("rejects intervals and distances outside the allowed range", () => {
    expect(parseSimulationForm("0", "1")).toBeNull();
    expect(parseSimulationForm("61", "1")).toBeNull();
    expect(parseSimulationForm("5.5", "1")).toBeNull();
    expect(parseSimulationForm("5", "0")).toBeNull();
    expect(parseSimulationForm("5", "21")).toBeNull();
    expect(parseSimulationForm("", "1")).toBeNull();
  });

  it("describes the simulated pace for drivers", () => {
    expect(
      formatSimulationPace({ intervalMs: 10_000, stepMeters: 3_000 }),
    ).toBe("3 km every 10 seconds (1080 km/h)");
    expect(
      formatSimulationPace({ intervalMs: 5_000, stepMeters: 1_000 }),
    ).toBe("1 km every 5 seconds (720 km/h)");
    expect(
      formatSimulationPace({ intervalMs: 1_000, stepMeters: 100 }),
    ).toBe("0.1 km every 1 second (360 km/h)");
  });
});
