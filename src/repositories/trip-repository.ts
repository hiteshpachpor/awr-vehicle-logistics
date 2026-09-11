import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  customers,
  drivers,
  logisticsVendors,
  trips,
  vehicles,
  type Trip,
  type TripStatus,
} from "@/db/schema";

export type NewTrip = typeof trips.$inferInsert;

export type TripFilters = {
  status?: TripStatus;
  vendorId?: string;
  driverId?: string;
};

export type TripDetails = {
  trip: Trip;
  vehicle: {
    id: string;
    registrationNumber: string;
    make: string;
    model: string;
    color: string | null;
  };
  customer: {
    id: string;
    name: string;
  };
  driver: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  vendor: {
    id: string;
    name: string;
  };
};

const detailSelection = {
  trip: trips,
  vehicle: {
    id: vehicles.id,
    registrationNumber: vehicles.registrationNumber,
    make: vehicles.make,
    model: vehicles.model,
    color: vehicles.color,
  },
  customer: {
    id: customers.id,
    name: customers.name,
  },
  driver: {
    id: drivers.id,
    name: drivers.name,
    phone: drivers.phone,
  },
  vendor: {
    id: logisticsVendors.id,
    name: logisticsVendors.name,
  },
};

export class TripRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewTrip): Promise<Trip> {
    const [trip] = await this.db.insert(trips).values(input).returning();
    if (!trip) {
      throw new Error("Trip insert did not return a row");
    }
    return trip;
  }

  async findById(id: string): Promise<TripDetails | null> {
    const [result] = await this.db
      .select(detailSelection)
      .from(trips)
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .innerJoin(customers, eq(vehicles.customerId, customers.id))
      .leftJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(
        logisticsVendors,
        eq(trips.vendorId, logisticsVendors.id),
      )
      .where(eq(trips.id, id))
      .limit(1);

    return result ?? null;
  }

  async list(filters: TripFilters = {}): Promise<TripDetails[]> {
    const conditions = [
      filters.status ? eq(trips.status, filters.status) : undefined,
      filters.vendorId ? eq(trips.vendorId, filters.vendorId) : undefined,
      filters.driverId ? eq(trips.driverId, filters.driverId) : undefined,
    ].filter((condition) => condition !== undefined);
    const query = this.db
      .select(detailSelection)
      .from(trips)
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .innerJoin(customers, eq(vehicles.customerId, customers.id))
      .leftJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(
        logisticsVendors,
        eq(trips.vendorId, logisticsVendors.id),
      )
      .$dynamic();

    return query
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(trips.updatedAt));
  }

  async listDriverOccupancy(driverId: string) {
    return this.db
      .select({
        id: trips.id,
        status: trips.status,
        scheduledAt: trips.scheduledAt,
      })
      .from(trips)
      .where(
        and(
          eq(trips.driverId, driverId),
          inArray(trips.status, ["created", "in_transit"]),
        ),
      );
  }

  async findAssignableDriver(id: string, vendorId: string) {
    const [driver] = await this.db
      .select({ id: drivers.id })
      .from(drivers)
      .where(
        and(
          eq(drivers.id, id),
          eq(drivers.vendorId, vendorId),
          eq(drivers.active, true),
        ),
      )
      .limit(1);
    return driver ?? null;
  }

  async updateDriver(
    id: string,
    currentVersion: number,
    driverId: string,
    now: Date,
  ): Promise<Trip | null> {
    const [updated] = await this.db
      .update(trips)
      .set({
        driverId,
        version: currentVersion + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(trips.id, id),
          eq(trips.version, currentVersion),
          eq(trips.status, "created"),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async updateStatus(
    id: string,
    currentVersion: number,
    status: TripStatus,
    now: Date,
  ): Promise<Trip | null> {
    const lifecycleTimestamp =
      status === "in_transit"
        ? { startedAt: now }
        : status === "completed"
          ? { completedAt: now }
          : status === "cancelled"
            ? { cancelledAt: now }
            : {};

    const [updated] = await this.db
      .update(trips)
      .set({
        status,
        version: currentVersion + 1,
        updatedAt: now,
        ...lifecycleTimestamp,
      })
      .where(and(eq(trips.id, id), eq(trips.version, currentVersion)))
      .returning();

    return updated ?? null;
  }
}
