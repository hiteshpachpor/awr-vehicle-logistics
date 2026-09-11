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
      vendorId: "00000000-0000-4000-8000-000000000004",
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

  it("requires a driver before starting a trip", async () => {
    const unassigned = tripDetails("created");
    unassigned.trip.driverId = null;
    unassigned.driver = null;
    const repository = {
      findById: vi.fn().mockResolvedValue(unassigned),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn(),
    } as unknown as PositionRepository;
    const service = new TripService(repository, positions);

    await expect(
      service.transition(unassigned.trip.id, "in_transit"),
    ).rejects.toMatchObject({
      code: "DRIVER_NOT_ASSIGNED",
    });
  });

  it("assigns an active driver from the trip vendor", async () => {
    const before = tripDetails("created");
    before.trip.driverId = null;
    before.driver = null;
    const after = tripDetails("created");
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after),
      findAssignableDriver: vi.fn().mockResolvedValue({ id: after.driver!.id }),
      listDriverOccupancy: vi.fn().mockResolvedValue([]),
      updateDriver: vi.fn().mockResolvedValue(after.trip),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn().mockResolvedValue(new Map()),
    } as unknown as PositionRepository;
    const service = new TripService(repository, positions);

    const result = await service.assignDriver(before.trip.id, after.driver!.id);

    expect(repository.findAssignableDriver).toHaveBeenCalledWith(
      after.driver!.id,
      before.trip.vendorId,
    );
    expect(repository.listDriverOccupancy).toHaveBeenCalledWith(after.driver!.id);
    expect(result.driver?.id).toBe(after.driver!.id);
  });

  it("rejects a driver whose other trip is scheduled within 3 hours", async () => {
    const trip = tripDetails("created");
    trip.trip.driverId = null;
    trip.driver = null;
    trip.trip.scheduledAt = new Date("2026-09-11T12:00:00Z");
    const repository = {
      findById: vi.fn().mockResolvedValue(trip),
      findAssignableDriver: vi.fn().mockResolvedValue({ id: "driver-2" }),
      listDriverOccupancy: vi.fn().mockResolvedValue([
        {
          id: "other-trip",
          status: "created",
          scheduledAt: new Date("2026-09-11T14:00:00Z"),
        },
      ]),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn(),
    } as unknown as PositionRepository;
    const service = new TripService(repository, positions);

    await expect(
      service.assignDriver(trip.trip.id, "driver-2"),
    ).rejects.toMatchObject({
      code: "DRIVER_SCHEDULE_CONFLICT",
    });
  });

  it("rejects starting a trip when the driver is already in transit", async () => {
    const before = tripDetails("created");
    const repository = {
      findById: vi.fn().mockResolvedValue(before),
      listDriverOccupancy: vi.fn().mockResolvedValue([
        { id: "other-trip", status: "in_transit", scheduledAt: null },
      ]),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn(),
    } as unknown as PositionRepository;
    const service = new TripService(repository, positions);

    await expect(
      service.transition(before.trip.id, "in_transit"),
    ).rejects.toMatchObject({
      code: "DRIVER_IN_TRANSIT_TRIP_EXISTS",
    });
  });

  it("rejects a driver outside the trip vendor", async () => {
    const trip = tripDetails("created");
    const repository = {
      findById: vi.fn().mockResolvedValue(trip),
      findAssignableDriver: vi.fn().mockResolvedValue(null),
    } as unknown as TripRepository;
    const positions = {
      latestForTrips: vi.fn(),
    } as unknown as PositionRepository;
    const service = new TripService(repository, positions);

    await expect(
      service.assignDriver(trip.trip.id, "another-driver"),
    ).rejects.toMatchObject({
      code: "DRIVER_NOT_AVAILABLE",
    });
  });

  it("updates a valid transition using optimistic concurrency", async () => {
    const before = tripDetails("created");
    const after = tripDetails("in_transit");
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after),
      listDriverOccupancy: vi.fn().mockResolvedValue([]),
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
