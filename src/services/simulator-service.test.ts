import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationService } from "./location-service";
import type { TripService, TripView } from "./trip-service";
import { demoRoute, SimulatorService } from "./simulator-service";

const createdTrip = {
  trip: { id: "trip", status: "created" },
} as TripView;

describe("SimulatorService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the trip and sends positions through location ingestion", async () => {
    vi.useFakeTimers();
    const trips = {
      get: vi.fn().mockResolvedValue(createdTrip),
      transition: vi.fn().mockResolvedValue(createdTrip),
    } as unknown as TripService;
    const locations = {
      ingest: vi.fn().mockResolvedValue({}),
    } as unknown as LocationService;
    const simulator = new SimulatorService(
      trips,
      locations,
      () => new Date("2026-09-10T10:00:00Z"),
      () => "session",
    );

    const result = await simulator.start("trip", 1_000);

    expect(trips.transition).toHaveBeenCalledWith("trip", "in_transit");
    expect(locations.ingest).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        lat: demoRoute[0].lat,
        eventId: "session-0",
      }),
      "simulator",
    );
    expect(result.status).toBe("running");
    expect(simulator.stop("trip")).toBe(true);
  });

  it("finishes a trip after the route is exhausted", async () => {
    vi.useFakeTimers();
    const trips = {
      get: vi.fn().mockResolvedValue(createdTrip),
      transition: vi.fn().mockResolvedValue(createdTrip),
    } as unknown as TripService;
    const locations = {
      ingest: vi.fn().mockResolvedValue({}),
    } as unknown as LocationService;
    const simulator = new SimulatorService(
      trips,
      locations,
      () => new Date("2026-09-10T10:00:00Z"),
      () => "session",
    );

    await simulator.start("trip", 1_000);
    await vi.advanceTimersByTimeAsync(demoRoute.length * 1_000);

    expect(locations.ingest).toHaveBeenCalledTimes(demoRoute.length);
    expect(trips.transition).toHaveBeenLastCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
  });
});
