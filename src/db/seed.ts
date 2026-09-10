import { getEnvironment } from "@/config/env";
import { createDatabase, type Database } from "./client";
import {
  customers,
  drivers,
  logisticsVendors,
  trips,
  vehicles,
} from "./schema";

export const seedIds = {
  customer: "00000000-0000-4000-8000-000000000001",
  vehicle: "00000000-0000-4000-8000-000000000002",
  vendor: "00000000-0000-4000-8000-000000000003",
  driver: "00000000-0000-4000-8000-000000000004",
  trip: "00000000-0000-4000-8000-000000000005",
} as const;

export async function seedDatabase(db: Database) {
  await db
    .insert(customers)
    .values({
      id: seedIds.customer,
      name: "Demo Customer",
      email: "customer@example.com",
      phone: "+971500000001",
    })
    .onConflictDoNothing();

  await db
    .insert(vehicles)
    .values({
      id: seedIds.vehicle,
      customerId: seedIds.customer,
      registrationNumber: "DUBAI-A-12345",
      vin: "AWRDEMO0000000001",
      make: "Nissan",
      model: "Patrol",
      color: "White",
    })
    .onConflictDoNothing();

  await db
    .insert(logisticsVendors)
    .values({
      id: seedIds.vendor,
      name: "Demo Logistics",
      contactEmail: "operations@demo-logistics.example",
      contactPhone: "+971500000002",
    })
    .onConflictDoNothing();

  await db
    .insert(drivers)
    .values({
      id: seedIds.driver,
      vendorId: seedIds.vendor,
      name: "Demo Driver",
      phone: "+971500000003",
      externalReference: "DRV-001",
    })
    .onConflictDoNothing();

  await db
    .insert(trips)
    .values({
      id: seedIds.trip,
      referenceNumber: "TRIP-DEMO-001",
      vehicleId: seedIds.vehicle,
      driverId: seedIds.driver,
      status: "created",
      pickupAddress: "AWR Showroom, Dubai",
      pickupLatitude: 25.2048,
      pickupLongitude: 55.2708,
      dropoffAddress: "Customer Address, Sharjah",
      dropoffLatitude: 25.3463,
      dropoffLongitude: 55.4209,
    })
    .onConflictDoNothing();
}

async function main() {
  const { db, pool } = createDatabase(getEnvironment().DATABASE_URL);

  try {
    await seedDatabase(db);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error("Database seed failed", error);
    process.exitCode = 1;
  });
}
