import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationService } from "./location-service";
import type { TripService, TripView } from "./trip-service";
import {
  SIMULATION_INTERVAL_MS,
  SIMULATION_SPEED_KMH,
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

const shortRoute = [
  { lat: 25, lng: 55 },
  { lat: 25.002, lng: 55 },
];

describe("SimulatorService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the trip and pings the mapped route every 5 seconds", async () => {
    vi.useFakeTimers();
    const trips = {
      get: vi.fn().mockResolvedValue(createdTrip),
      transition: vi.fn().mockResolvedValue(createdTrip),
    } as unknown as TripService;
    const locations = {
      ingest: vi.fn().mockResolvedValue({}),
    } as unknown as LocationService;
    const fetchRoute = vi.fn().mockResolvedValue(shortRoute);
    const simulator = new SimulatorService(
      trips,
      locations,
      () => new Date("2026-09-10T10:00:00Z"),
      () => "session",
      fetchRoute,
    );

    const result = await simulator.start("trip");

    expect(fetchRoute).toHaveBeenCalledWith(
      { lat: 25.1774, lng: 55.2407 },
      { lat: 25.3188, lng: 55.4581 },
    );
    expect(trips.transition).toHaveBeenCalledWith("trip", "in_transit");
    expect(locations.ingest).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        lat: shortRoute[0]?.lat,
        lng: shortRoute[0]?.lng,
        speed: SIMULATION_SPEED_KMH,
        eventId: "session-0",
      }),
      "simulator",
    );
    expect(result).toEqual({
      tripId: "trip",
      sessionId: "session",
      intervalMs: SIMULATION_INTERVAL_MS,
      status: "running",
    });

    await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);

    expect(locations.ingest).toHaveBeenCalledTimes(2);
    expect(locations.ingest).toHaveBeenLastCalledWith(
      "trip",
      expect.objectContaining({
        lat: shortRoute[1]?.lat,
        lng: shortRoute[1]?.lng,
      }),
      "simulator",
    );
    expect(trips.transition).not.toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
    expect(simulator.stop("trip")).toBe(false);
  });

  it("falls back to a geodesic line when Mapbox is unavailable", async () => {
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
      async () => {
        throw new Error("Mapbox unavailable");
      },
    );

    await simulator.start("trip");

    expect(locations.ingest).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        lat: createdTrip.trip.pickupLatitude,
        lng: createdTrip.trip.pickupLongitude,
      }),
      "simulator",
    );
    expect(simulator.stop("trip")).toBe(true);
  });

  it("uses a geodesic fallback when Mapbox returns no geometry", async () => {
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
      async () => null,
    );

    await simulator.start("trip");

    expect(locations.ingest).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        lat: createdTrip.trip.pickupLatitude,
        lng: createdTrip.trip.pickupLongitude,
      }),
      "simulator",
    );
    expect(simulator.stop("trip")).toBe(true);
  });
});
