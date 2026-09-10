import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { InvalidStateTransitionError } from "@/domain/errors";
import type { AppContainer } from "@/lib/container";
import {
  createTripHandler,
  ingestLocationHandler,
  listTripsHandler,
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
      transition: vi.fn(),
    },
    locationService: { ingest: vi.fn() },
    simulatorService: { start: vi.fn(), stop: vi.fn() },
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
        driverId: "00000000-0000-4000-8000-000000000003",
        pickup: { address: "Dubai", lat: 25.2, lng: 55.3 },
        dropoff: { address: "Sharjah", lat: 25.3, lng: 55.4 },
      }),
    });

    const response = await createTripHandler(request, app);

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(`/api/trips/${tripId}`);
    expect(app.tripService.create).toHaveBeenCalledOnce();
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
      "http://localhost/api/trips?status=in_transit",
    );

    const response = await listTripsHandler(request, app);

    expect(response.status).toBe(200);
    expect(app.tripService.list).toHaveBeenCalledWith("in_transit");
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
      intervalMs: 500,
      status: "running",
    });
    vi.mocked(app.simulatorService.stop).mockReturnValue(true);
    const request = new Request(
      `http://localhost/api/trips/${tripId}/simulation`,
      {
        method: "POST",
        body: JSON.stringify({ intervalMs: 500 }),
      },
    );

    const started = await startSimulationHandler(tripId, request, app);
    const stopped = await stopSimulationHandler(tripId, app);

    expect(started.status).toBe(201);
    expect(stopped.status).toBe(204);
    expect(app.simulatorService.start).toHaveBeenCalledWith(tripId, 500);
  });
});
