import { and, asc, eq } from "drizzle-orm";
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

export type OperationsCustomer = {
  id: string;
  name: string;
};

export type OperationsVendor = {
  id: string;
  name: string;
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

  listCustomers(): Promise<OperationsCustomer[]> {
    return this.db
      .select({
        id: customers.id,
        name: customers.name,
      })
      .from(customers)
      .orderBy(asc(customers.name));
  }

  listVehicles(customerId?: string): Promise<OperationsVehicle[]> {
    const query = this.db
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
      .$dynamic();

    return query
      .where(customerId ? eq(vehicles.customerId, customerId) : undefined)
      .orderBy(asc(vehicles.registrationNumber));
  }

  listActiveVendors(): Promise<OperationsVendor[]> {
    return this.db
      .select({
        id: logisticsVendors.id,
        name: logisticsVendors.name,
      })
      .from(logisticsVendors)
      .where(eq(logisticsVendors.active, true))
      .orderBy(asc(logisticsVendors.name));
  }

  listActiveDrivers(vendorId?: string): Promise<OperationsDriver[]> {
    const query = this.db
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
      .$dynamic();

    return query
      .where(
        vendorId
          ? and(eq(drivers.active, true), eq(drivers.vendorId, vendorId))
          : eq(drivers.active, true),
      )
      .orderBy(asc(drivers.name));
  }
}
