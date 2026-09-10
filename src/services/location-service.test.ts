import { describe, expect, it, vi } from "vitest";
import type { PositionRepository } from "@/repositories/position-repository";
import type { TripService } from "./trip-service";
import type { PositionPublisher } from "./position-events";
import { LocationService } from "./location-service";

describe("LocationService", () => {
  it("persists before publishing a position event", async () => {
    const calls: string[] = [];
    const trips = {
      requireInTransit: vi.fn(async () => {
        calls.push("validate");
      }),
    } as unknown as TripService;
    const position = {
      id: 42,
      tripId: "trip",
      latitude: 25.2,
      longitude: 55.3,
      recordedAt: new Date("2026-09-10T10:00:00Z"),
      receivedAt: new Date("2026-09-10T10:00:01Z"),
      speed: 10,
      source: "vendor" as const,
      sourceEventId: "event-1",
    };
    const positions = {
      create: vi.fn(async () => {
        calls.push("persist");
        return { position, created: true };
      }),
    } as unknown as PositionRepository;
    const publisher: PositionPublisher = {
      publish: vi.fn(async () => {
        calls.push("publish");
      }),
    };
    const service = new LocationService(trips, positions, publisher);

    const result = await service.ingest("trip", {
      lat: 25.2,
      lng: 55.3,
      timestamp: "2026-09-10T10:00:00Z",
      speed: 10,
      eventId: "event-1",
    });

    expect(result.created).toBe(true);
    expect(calls).toEqual(["validate", "persist", "publish"]);
    expect(publisher.publish).toHaveBeenCalledWith({
      tripId: "trip",
      positionId: 42,
    });
  });
});
