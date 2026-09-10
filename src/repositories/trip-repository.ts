import { and, desc, eq } from "drizzle-orm";
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
  };
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
      .innerJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(
        logisticsVendors,
        eq(drivers.vendorId, logisticsVendors.id),
      )
      .where(eq(trips.id, id))
      .limit(1);

    return result ?? null;
  }

  async list(status?: TripStatus): Promise<TripDetails[]> {
    const query = this.db
      .select(detailSelection)
      .from(trips)
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .innerJoin(customers, eq(vehicles.customerId, customers.id))
      .innerJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(
        logisticsVendors,
        eq(drivers.vendorId, logisticsVendors.id),
      )
      .$dynamic();

    return query
      .where(status ? eq(trips.status, status) : undefined)
      .orderBy(desc(trips.updatedAt));
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
