import { describe, expect, it, vi } from "vitest";
import type { Trip } from "@/db/schema";
import type {
  TripDetails,
  TripRepository,
} from "@/repositories/trip-repository";
import type { PositionRepository } from "@/repositories/position-repository";
import { InvalidStateTransitionError } from "@/domain/errors";
import { canTransition, TripService } from "./trip-service";

function tripDetails(status: Trip["status"] = "created"): TripDetails {
  return {
    trip: {
      id: "00000000-0000-4000-8000-000000000001",
      referenceNumber: "TRIP-1",
      vehicleId: "00000000-0000-4000-8000-000000000002",
      driverId: "00000000-0000-4000-8000-000000000003",
      status,
      pickupAddress: "Dubai",
      pickupLatitude: 25.2,
      pickupLongitude: 55.3,
      dropoffAddress: "Sharjah",
      dropoffLatitude: 25.35,
      dropoffLongitude: 55.42,
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      version: 1,
      createdAt: new Date("2026-09-10T10:00:00Z"),
      updatedAt: new Date("2026-09-10T10:00:00Z"),
    },
    vehicle: {
      id: "vehicle",
      registrationNumber: "A-1",
      make: "Nissan",
      model: "Patrol",
      color: null,
    },
    customer: { id: "customer", name: "Customer" },
    driver: { id: "driver", name: "Driver", phone: null },
    vendor: { id: "vendor", name: "Vendor" },
  };
}

describe("TripService", () => {
  it("defines guarded lifecycle transitions", () => {
    expect(canTransition("created", "in_transit")).toBe(true);
    expect(canTransition("in_transit", "completed")).toBe(true);
    expect(canTransition("completed", "in_transit")).toBe(false);
  });

  it("rejects invalid transitions", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(tripDetails("completed")),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn(),
    } as unknown as PositionRepository;
    const service = new TripService(repository, positions);

    await expect(service.transition("trip", "in_transit")).rejects.toBeInstanceOf(
      InvalidStateTransitionError,
    );
  });

  it("updates a valid transition using optimistic concurrency", async () => {
    const before = tripDetails("created");
    const after = tripDetails("in_transit");
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after),
      updateStatus: vi.fn().mockResolvedValue(after.trip),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn().mockResolvedValue(new Map()),
    } as unknown as PositionRepository;
    const now = new Date("2026-09-10T11:00:00Z");
    const service = new TripService(repository, positions, () => now);

    const result = await service.transition(before.trip.id, "in_transit");

    expect(repository.updateStatus).toHaveBeenCalledWith(
      before.trip.id,
      1,
      "in_transit",
      now,
    );
    expect(result.trip.status).toBe("in_transit");
  });
});
