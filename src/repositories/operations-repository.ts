import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  customers,
  drivers,
  logisticsVendors,
  vehicles,
} from "@/db/schema";

export type OperationsVehicle = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  color: string | null;
  customer: {
    id: string;
    name: string;
  };
};

export type OperationsDriver = {
  id: string;
  name: string;
  phone: string | null;
  externalReference: string | null;
  vendor: {
    id: string;
    name: string;
  };
};

export class OperationsRepository {
  constructor(private readonly db: Database) {}

  listVehicles(): Promise<OperationsVehicle[]> {
    return this.db
      .select({
        id: vehicles.id,
        registrationNumber: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
        color: vehicles.color,
        customer: {
          id: customers.id,
          name: customers.name,
        },
      })
      .from(vehicles)
      .innerJoin(customers, eq(vehicles.customerId, customers.id))
      .orderBy(asc(vehicles.registrationNumber));
  }

  listActiveDrivers(): Promise<OperationsDriver[]> {
    return this.db
      .select({
        id: drivers.id,
        name: drivers.name,
        phone: drivers.phone,
        externalReference: drivers.externalReference,
        vendor: {
          id: logisticsVendors.id,
          name: logisticsVendors.name,
        },
      })
      .from(drivers)
      .innerJoin(
        logisticsVendors,
        eq(drivers.vendorId, logisticsVendors.id),
      )
      .where(eq(drivers.active, true))
      .orderBy(asc(drivers.name));
  }
}
