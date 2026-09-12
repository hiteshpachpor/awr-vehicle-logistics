import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/domain/errors";
import { haversineMeters, interpolate } from "@/lib/route-geometry";
import type { LocationService } from "./location-service";
import type { TripService, TripView } from "./trip-service";
import {
  SIMULATION_INTERVAL_MS,
  SIMULATION_SPEED_KMH,
  SIMULATION_STEP_METERS,
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
      stepMeters: SIMULATION_STEP_METERS,
      speedKmh: SIMULATION_SPEED_KMH,
      status: "running",
    });
    expect(simulator.getStatus("trip")).toEqual({
      status: "running",
      intervalMs: SIMULATION_INTERVAL_MS,
      stepMeters: SIMULATION_STEP_METERS,
      speedKmh: SIMULATION_SPEED_KMH,
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
    expect(simulator.isRunning("trip")).toBe(true);

    await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);

    expect(locations.ingest).toHaveBeenCalledTimes(2);
    expect(trips.transition).toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
    expect(simulator.stop("trip")).toBe(false);
  });

  it("advances the configured distance on the configured interval", async () => {
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

    const result = await simulator.start("trip", {
      intervalMs: 10_000,
      stepMeters: 3_000,
    });

    expect(result).toEqual({
      tripId: "trip",
      sessionId: "session",
      intervalMs: 10_000,
      stepMeters: 3_000,
      speedKmh: 1_080,
      status: "running",
    });
    expect(locations.ingest).toHaveBeenCalledWith(
      "trip",
      expect.objectContaining({
        speed: 1_080,
        eventId: "session-0",
      }),
      "simulator",
    );
    expect(simulator.getStatus("trip")).toEqual({
      status: "running",
      intervalMs: 10_000,
      stepMeters: 3_000,
      speedKmh: 1_080,
    });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(locations.ingest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(locations.ingest).toHaveBeenCalledTimes(2);
    expect(locations.ingest).toHaveBeenLastCalledWith(
      "trip",
      expect.objectContaining({
        lat: shortRoute[1]?.lat,
        lng: shortRoute[1]?.lng,
        speed: 1_080,
      }),
      "simulator",
    );
    expect(trips.transition).not.toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(locations.ingest).toHaveBeenCalledTimes(2);
    expect(trips.transition).toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
    expect(simulator.getStatus("trip")).toEqual({ status: "idle" });
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

  it("completes one interval after a ping reaches drop-off even if the route continues", async () => {
    vi.useFakeTimers();
    const pickup = { lat: 25, lng: 55 };
    const north = { lat: 26, lng: 55 };
    const along = (meters: number) =>
      interpolate(pickup, north, meters / haversineMeters(pickup, north));
    const via = along(100);
    const dropoff = along(200);
    const overshoot = along(300);
    const trip = {
      trip: {
        ...createdTrip.trip,
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        dropoffLatitude: dropoff.lat,
        dropoffLongitude: dropoff.lng,
      },
      latestPosition: null,
    } as TripView;
    const trips = {
      get: vi.fn().mockResolvedValue(trip),
      transition: vi.fn().mockResolvedValue(trip),
    } as unknown as TripService;
    const locations = {
      ingest: vi.fn().mockResolvedValue({}),
    } as unknown as LocationService;
    const simulator = new SimulatorService(
      trips,
      locations,
      () => new Date("2026-09-10T10:00:00Z"),
      () => "session",
      async () => [pickup, via, dropoff, overshoot],
    );

    await simulator.start("trip", { intervalMs: 5_000, stepMeters: 100 });

    expect(locations.ingest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(locations.ingest).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(locations.ingest).toHaveBeenCalledTimes(3);
    expect(locations.ingest).toHaveBeenLastCalledWith(
      "trip",
      expect.objectContaining({
        lat: dropoff.lat,
        lng: dropoff.lng,
      }),
      "simulator",
    );
    expect(trips.transition).not.toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(true);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(locations.ingest).toHaveBeenCalledTimes(3);
    expect(trips.transition).toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
  });

  it("retries completion after a failed drop-off transition", async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const trips = {
      get: vi.fn().mockResolvedValue(createdTrip),
      transition: vi
        .fn()
        .mockResolvedValueOnce(createdTrip)
        .mockRejectedValueOnce(new ConflictError("Trip was modified by another request"))
        .mockResolvedValueOnce(createdTrip),
    } as unknown as TripService;
    const locations = {
      ingest: vi.fn().mockResolvedValue({}),
    } as unknown as LocationService;
    const simulator = new SimulatorService(
      trips,
      locations,
      () => new Date("2026-09-10T10:00:00Z"),
      () => "session",
      vi.fn().mockResolvedValue(shortRoute),
    );

    await simulator.start("trip");
    await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    expect(trips.transition).not.toHaveBeenCalledWith("trip", "completed");

    await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    expect(trips.transition).toHaveBeenCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(true);
    expect(consoleError).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    expect(trips.transition).toHaveBeenCalledTimes(3);
    expect(trips.transition).toHaveBeenLastCalledWith("trip", "completed");
    expect(simulator.isRunning("trip")).toBe(false);
    consoleError.mockRestore();
  });
});
