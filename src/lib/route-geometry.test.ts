import { describe, expect, it } from "vitest";
import { haversineMeters, interpolate, sampleRoute } from "./route-geometry";

const start = { lat: 25, lng: 55 };

describe("route geometry", () => {
  it("samples a long straight route every kilometre and keeps the destination", () => {
    const end = interpolate(start, { lat: 25.1, lng: 55 }, 1);
    const samples = sampleRoute([start, end], 1_000);

    expect(samples[0]).toEqual(start);
    expect(samples.at(-1)).toEqual(end);
    expect(samples.length).toBeGreaterThan(2);

    const lastIndex = samples.length - 1;
    for (let index = 0; index < lastIndex - 1; index += 1) {
      const from = samples[index];
      const to = samples[index + 1];
      if (!from || !to) continue;
      expect(haversineMeters(from, to)).toBeCloseTo(1_000, 0);
    }

    const lastFull = samples[lastIndex - 1];
    const destination = samples[lastIndex];
    if (lastFull && destination) {
      expect(haversineMeters(lastFull, destination)).toBeGreaterThan(0);
      expect(haversineMeters(lastFull, destination)).toBeLessThan(1_000);
    }
  });

  it("keeps a short remainder as start and destination", () => {
    const end = interpolate(start, { lat: 25.1, lng: 55 }, 0.03);
    expect(haversineMeters(start, end)).toBeLessThan(1_000);

    const samples = sampleRoute([start, end], 1_000);

    expect(samples).toEqual([start, end]);
  });

  it("collapses an identical start and destination to one point", () => {
    expect(sampleRoute([start, { ...start }], 1_000)).toEqual([start]);
  });

  it("returns an empty route when no coordinates are provided", () => {
    expect(sampleRoute([], 1_000)).toEqual([]);
  });
});
