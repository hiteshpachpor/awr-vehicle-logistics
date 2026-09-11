import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { InvalidStateTransitionError } from "@/domain/errors";
import type { AppContainer } from "@/lib/container";
import {
  createTripHandler,
  getSimulationHandler,
  ingestLocationHandler,
  listTripsHandler,
  listTripPositionsHandler,
  startSimulationHandler,
  stopSimulationHandler,
  updateTripHandler,
} from "./trip-handlers";

const tripId = "00000000-0000-4000-8000-000000000001";

function container(overrides: Partial<AppContainer> = {}) {
  return {
    tripService: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      transition: vi.fn(),
      assignDriver: vi.fn(),
    },
    positionRepository: { listRecent: vi.fn() },
    locationService: { ingest: vi.fn() },
    simulatorService: {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn(),
      getStatus: vi.fn(),
    },
    ...overrides,
  } as unknown as AppContainer;
}

describe("trip HTTP handlers", () => {
  it("creates a trip and returns its resource location", async () => {
    const app = container();
    vi.mocked(app.tripService.create).mockResolvedValue({
      trip: { id: tripId },
    } as never);
    const request = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({
        vehicleId: "00000000-0000-4000-8000-000000000002",
        vendorId: "00000000-0000-4000-8000-000000000003",
        pickup: { address: "Dubai", lat: 25.2, lng: 55.3 },
        dropoff: { address: "Sharjah", lat: 25.3, lng: 55.4 },
      }),
    });

    const response = await createTripHandler(request, app);

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(`/api/trips/${tripId}`);
    expect(app.tripService.create).toHaveBeenCalledOnce();
  });

  it("returns a specific conflict when a vehicle has an active trip", async () => {
    const app = container();
    vi.mocked(app.tripService.create).mockRejectedValue(
      Object.assign(new Error("failed query"), {
        cause: Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint: "trips_vehicle_active_unique",
        }),
      }),
    );
    const request = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({
        vehicleId: "00000000-0000-4000-8000-000000000002",
        vendorId: "00000000-0000-4000-8000-000000000003",
        pickup: { address: "Dubai", lat: 25.2, lng: 55.3 },
        dropoff: { address: "Sharjah", lat: 25.3, lng: 55.4 },
      }),
    });

    const response = await createTripHandler(request, app);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "VEHICLE_ACTIVE_TRIP_EXISTS",
        message: "This vehicle already has an active trip",
      },
    });
  });

  it("returns a specific conflict when a driver already has an in-transit trip", async () => {
    const app = container();
    vi.mocked(app.tripService.create).mockRejectedValue(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "trips_driver_active_unique",
      }),
    );
    const request = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({
        vehicleId: "00000000-0000-4000-8000-000000000002",
        vendorId: "00000000-0000-4000-8000-000000000003",
        pickup: { address: "Dubai", lat: 25.2, lng: 55.3 },
        dropoff: { address: "Sharjah", lat: 25.3, lng: 55.4 },
      }),
    });

    const response = await createTripHandler(request, app);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "DRIVER_IN_TRANSIT_TRIP_EXISTS",
        message: "This driver already has an in-transit trip",
      },
    });
  });

  it("rejects malformed trip payloads", async () => {
    const app = container();
    const request = new Request("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await createTripHandler(request, app);

    expect(response.status).toBe(400);
    expect(app.tripService.create).not.toHaveBeenCalled();
  });

  it("lists trips using a validated status filter", async () => {
    const app = container();
    vi.mocked(app.tripService.list).mockResolvedValue([]);
    const request = new NextRequest(
      "http://localhost/api/trips?status=in_transit&vendorId=00000000-0000-4000-8000-000000000002&driverId=00000000-0000-4000-8000-000000000003",
    );

    const response = await listTripsHandler(request, app);

    expect(response.status).toBe(200);
    expect(app.tripService.list).toHaveBeenCalledWith({
      status: "in_transit",
      vendorId: "00000000-0000-4000-8000-000000000002",
      driverId: "00000000-0000-4000-8000-000000000003",
    });
  });

  it("assigns a driver through the trip update endpoint", async () => {
    const app = container();
    vi.mocked(app.tripService.assignDriver).mockResolvedValue({
      trip: { id: tripId },
      driver: { id: "00000000-0000-4000-8000-000000000002" },
    } as never);
    const request = new Request(`http://localhost/api/trips/${tripId}`, {
      method: "PATCH",
      body: JSON.stringify({
        driverId: "00000000-0000-4000-8000-000000000002",
      }),
    });

    const response = await updateTripHandler(tripId, request, app);

    expect(response.status).toBe(200);
    expect(app.tripService.assignDriver).toHaveBeenCalledWith(
      tripId,
      "00000000-0000-4000-8000-000000000002",
    );
  });

  it("lists recent positions for an existing trip", async () => {
    const app = container();
    vi.mocked(app.tripService.get).mockResolvedValue({
      trip: { id: tripId },
    } as never);
    vi.mocked(app.positionRepository.listRecent).mockResolvedValue([
      { id: 12, tripId },
    ] as never);

    const response = await listTripPositionsHandler(tripId, app);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: 12, tripId }],
    });
    expect(app.positionRepository.listRecent).toHaveBeenCalledWith(tripId);
  });

  it("returns a conflict for an invalid lifecycle transition", async () => {
    const app = container();
    vi.mocked(app.tripService.transition).mockRejectedValue(
      new InvalidStateTransitionError("completed", "in_transit"),
    );
    const request = new Request(`http://localhost/api/trips/${tripId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_transit" }),
    });

    const response = await updateTripHandler(tripId, request, app);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_STATE_TRANSITION" },
    });
  });

  it("ingests the brief's location payload", async () => {
    const app = container();
    vi.mocked(app.locationService.ingest).mockResolvedValue({
      position: { id: 12 },
      created: true,
    } as never);
    const request = new Request(
      `http://localhost/api/trips/${tripId}/location`,
      {
        method: "POST",
        body: JSON.stringify({
          lat: 25.2,
          lng: 55.3,
          timestamp: "2026-09-10T10:00:00Z",
          speed: 12,
        }),
      },
    );

    const response = await ingestLocationHandler(tripId, request, app);

    expect(response.status).toBe(201);
    expect(app.locationService.ingest).toHaveBeenCalledWith(
      tripId,
      expect.objectContaining({ lat: 25.2, speed: 12 }),
    );
  });

  it("starts and stops simulations", async () => {
    const app = container();
    vi.mocked(app.simulatorService.start).mockResolvedValue({
      tripId,
      sessionId: "session",
      intervalMs: 5_000,
      stepMeters: 1_000,
      speedKmh: 720,
      status: "running",
    });
    vi.mocked(app.tripService.get).mockResolvedValue({
      trip: { id: tripId },
    } as never);
    vi.mocked(app.simulatorService.stop).mockReturnValue(true);
    const request = new Request(
      `http://localhost/api/trips/${tripId}/simulation`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );

    const started = await startSimulationHandler(tripId, request, app);
    const stopped = await stopSimulationHandler(tripId, app);

    expect(started.status).toBe(201);
    expect(stopped.status).toBe(204);
    expect(app.simulatorService.start).toHaveBeenCalledWith(tripId, {});
    expect(app.tripService.get).toHaveBeenCalledWith(tripId);
  });

  it("forwards simulation pace to the simulator", async () => {
    const app = container();
    vi.mocked(app.simulatorService.start).mockResolvedValue({
      tripId,
      sessionId: "session",
      intervalMs: 10_000,
      stepMeters: 3_000,
      speedKmh: 1_080,
      status: "running",
    });
    vi.mocked(app.tripService.get).mockResolvedValue({
      trip: { id: tripId },
    } as never);
    const request = new Request(
      `http://localhost/api/trips/${tripId}/simulation`,
      {
        method: "POST",
        body: JSON.stringify({ intervalMs: 10_000, stepMeters: 3_000 }),
      },
    );

    const response = await startSimulationHandler(tripId, request, app);

    expect(response.status).toBe(201);
    expect(app.simulatorService.start).toHaveBeenCalledWith(tripId, {
      intervalMs: 10_000,
      stepMeters: 3_000,
    });
  });

  it("reports whether a simulation is running", async () => {
    const app = container();
    vi.mocked(app.tripService.get).mockResolvedValue({
      trip: { id: tripId },
    } as never);
    vi.mocked(app.simulatorService.getStatus).mockReturnValue({
      status: "running",
      intervalMs: 10_000,
      stepMeters: 3_000,
      speedKmh: 1_080,
    });

    const response = await getSimulationHandler(tripId, app);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        status: "running",
        intervalMs: 10_000,
        stepMeters: 3_000,
        speedKmh: 1_080,
      },
    });
  });
});
