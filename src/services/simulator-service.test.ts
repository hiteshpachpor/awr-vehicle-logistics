import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationService } from "./location-service";
import type { TripService, TripView } from "./trip-service";
import {
  buildSimulationRoute,
  SimulatorService,
} from "./simulator-service";

const createdTrip = {
  trip: {
    id: "trip",
    status: "created",
    pickupLatitude: 25.1774,
    pickupLongitude: 55.2407,
    dropoffLatitude: 25.3188,
    dropoffLongitude: 55.4581,
  },
  latestPosition: null,
} as TripView;

describe("SimulatorService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a route from the latest position to the trip destination", () => {
    const inTransitTrip = {
      ...createdTrip,
      trip: { ...createdTrip.trip, status: "in_transit" },
      latestPosition: { latitude: 25.25, longitude: 55.35 },
    } as TripView;

    const route = buildSimulationRoute(inTransitTrip, 3);

    expect(route[0]).toEqual({ lat: 25.25, lng: 55.35 });
    expect(route[1]?.lat).toBeCloseTo(
      (25.25 + createdTrip.trip.dropoffLatitude) / 2,
    );
    expect(route[1]?.lng).toBeCloseTo(
      (55.35 + createdTrip.trip.dropoffLongitude) / 2,
    );
    expect(route[2]).toEqual({
      lat: createdTrip.trip.dropoffLatitude,
      lng: createdTrip.trip.dropoffLongitude,
    });
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

    const route = buildSimulationRoute(createdTrip);
    expect(trips.transition).toHaveBeenCalledWith("trip", "in_transit");
    expect(locations.ingest).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        lat: route[0]?.lat,
        lng: route[0]?.lng,
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
    const route = buildSimulationRoute(createdTrip);
    await vi.advanceTimersByTimeAsync(route.length * 1_000);

    expect(locations.ingest).toHaveBeenCalledTimes(route.length);
    expect(locations.ingest).toHaveBeenLastCalledWith(
      "trip",
      expect.objectContaining({
        lat: createdTrip.trip.dropoffLatitude,
        lng: createdTrip.trip.dropoffLongitude,
      }),
      "simulator",
    );
    expect(trips.transition).toHaveBeenLastCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
  });
});
