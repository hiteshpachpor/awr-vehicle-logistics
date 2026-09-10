import { randomUUID } from "node:crypto";
import type { CreateTripInput } from "@/domain/contracts";
import {
  ConflictError,
  InvalidStateTransitionError,
  NotFoundError,
} from "@/domain/errors";
import type { TripStatus } from "@/db/schema";
import {
  TripRepository,
  type TripFilters,
  type TripDetails,
} from "@/repositories/trip-repository";
import { PositionRepository } from "@/repositories/position-repository";

const allowedTransitions: Record<TripStatus, readonly TripStatus[]> = {
  created: ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: TripStatus, to: TripStatus) {
  return allowedTransitions[from].includes(to);
}

export type TripView = TripDetails & {
  latestPosition: Awaited<
    ReturnType<PositionRepository["findById"]>
  >;
};

export class TripService {
  constructor(
    private readonly trips: TripRepository,
    private readonly positions: PositionRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly makeId: () => string = randomUUID,
  ) {}

  async create(input: CreateTripInput): Promise<TripView> {
    const now = this.now();
    const trip = await this.trips.create({
      referenceNumber:
        input.referenceNumber ??
        `TRIP-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${this.makeId().slice(0, 8).toUpperCase()}`,
      vehicleId: input.vehicleId,
      vendorId: input.vendorId,
      pickupAddress: input.pickup.address,
      pickupLatitude: input.pickup.lat,
      pickupLongitude: input.pickup.lng,
      dropoffAddress: input.dropoff.address,
      dropoffLatitude: input.dropoff.lat,
      dropoffLongitude: input.dropoff.lng,
      scheduledAt: input.scheduledAt
        ? new Date(input.scheduledAt)
        : undefined,
    });

    return this.get(trip.id);
  }

  async get(id: string): Promise<TripView> {
    const trip = await this.trips.findById(id);
    if (!trip) {
      throw new NotFoundError("Trip");
    }
    const positions = await this.positions.latestForTrips([id]);
    return { ...trip, latestPosition: positions.get(id) ?? null };
  }

  async list(filters: TripFilters = {}): Promise<TripView[]> {
    const trips = await this.trips.list(filters);
    const positions = await this.positions.latestForTrips(
      trips.map(({ trip }) => trip.id),
    );

    return trips.map((trip) => ({
      ...trip,
      latestPosition: positions.get(trip.trip.id) ?? null,
    }));
  }

  async assignDriver(id: string, driverId: string): Promise<TripView> {
    const existing = await this.trips.findById(id);
    if (!existing) {
      throw new NotFoundError("Trip");
    }
    if (existing.trip.status !== "created") {
      throw new ConflictError(
        "Drivers can only be assigned before a trip starts",
        "TRIP_ALREADY_STARTED",
      );
    }
    const driver = await this.trips.findAssignableDriver(
      driverId,
      existing.trip.vendorId,
    );
    if (!driver) {
      throw new ConflictError(
        "Choose an active driver from the trip's logistics vendor",
        "DRIVER_NOT_AVAILABLE",
      );
    }
    const updated = await this.trips.updateDriver(
      id,
      existing.trip.version,
      driverId,
      this.now(),
    );
    if (!updated) {
      throw new ConflictError(
        "Trip was modified by another request",
        "CONCURRENT_MODIFICATION",
      );
    }
    return this.get(id);
  }

  async transition(id: string, status: TripStatus): Promise<TripView> {
    const existing = await this.trips.findById(id);
    if (!existing) {
      throw new NotFoundError("Trip");
    }

    if (!canTransition(existing.trip.status, status)) {
      throw new InvalidStateTransitionError(existing.trip.status, status);
    }
    if (status === "in_transit" && !existing.trip.driverId) {
      throw new ConflictError(
        "A driver must be assigned before the trip can start",
        "DRIVER_NOT_ASSIGNED",
      );
    }

    const updated = await this.trips.updateStatus(
      id,
      existing.trip.version,
      status,
      this.now(),
    );
    if (!updated) {
      throw new ConflictError(
        "Trip was modified by another request",
        "CONCURRENT_MODIFICATION",
      );
    }

    return this.get(id);
  }

  async requireInTransit(id: string) {
    const existing = await this.trips.findById(id);
    if (!existing) {
      throw new NotFoundError("Trip");
    }
    if (existing.trip.status !== "in_transit") {
      throw new ConflictError(
        "Locations can only be recorded for trips in transit",
        "TRIP_NOT_IN_TRANSIT",
      );
    }
  }
}
