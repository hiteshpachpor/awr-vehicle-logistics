import type { Database } from "./client";
import {
  customers,
  drivers,
  logisticsVendors,
  trips,
  vehicles,
} from "./schema";

export const LOAD_TRIPS_DEFAULT = 200;
export const LOAD_TRIPS_MAX = 10_000;
export const LOAD_INSERT_CHUNK_SIZE = 500;

export const LOAD_NAMESPACES = {
  customer: "9100",
  vehicle: "9200",
  vendor: "9300",
  driver: "9400",
  trip: "9500",
} as const;

export const LOAD_ROUTE = {
  pickupAddress: "AWR Showroom, Sheikh Zayed Road, Dubai",
  pickupLatitude: 25.1774,
  pickupLongitude: 55.2407,
  dropoffAddress: "Al Zahia, Sharjah",
  dropoffLatitude: 25.3188,
  dropoffLongitude: 55.4581,
} as const;

export function loadEntityId(
  namespace: (typeof LOAD_NAMESPACES)[keyof typeof LOAD_NAMESPACES],
  index: number,
) {
  return `00000000-0000-4000-${namespace}-${String(index).padStart(12, "0")}`;
}

export function loadTripId(index: number) {
  return loadEntityId(LOAD_NAMESPACES.trip, index);
}

export function parseLoadTripCount(args: string[]) {
  const index = args.findIndex(
    (arg) => arg === "--load-trips" || arg.startsWith("--load-trips="),
  );
  if (index === -1) {
    return 0;
  }

  const current = args[index]!;
  let raw: string | undefined;
  if (current.startsWith("--load-trips=")) {
    raw = current.slice("--load-trips=".length);
  } else {
    const next = args[index + 1];
    if (next && !next.startsWith("-")) {
      raw = next;
    }
  }

  if (raw === undefined || raw === "") {
    return LOAD_TRIPS_DEFAULT;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `--load-trips must be an integer between 0 and ${LOAD_TRIPS_MAX}`,
    );
  }

  const count = Number(raw);
  if (count > LOAD_TRIPS_MAX) {
    throw new Error(`--load-trips cannot exceed ${LOAD_TRIPS_MAX}`);
  }

  return count;
}

export type LoadFleet = ReturnType<typeof buildLoadFleet>;

export function buildLoadFleet(count: number, seedTime = new Date()) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      `--load-trips must be an integer between 0 and ${LOAD_TRIPS_MAX}`,
    );
  }
  if (count > LOAD_TRIPS_MAX) {
    throw new Error(`--load-trips cannot exceed ${LOAD_TRIPS_MAX}`);
  }

  if (count === 0) {
    return {
      customer: null,
      vendor: null,
      vehicles: [],
      drivers: [],
      trips: [],
    };
  }

  const customer = {
    id: loadEntityId(LOAD_NAMESPACES.customer, 1),
    name: "Load Harness Fleet",
    email: "fleet@load.example.com",
    phone: "+971500000000",
  };

  const vendor = {
    id: loadEntityId(LOAD_NAMESPACES.vendor, 1),
    name: "Load Harness Logistics LLC",
    contactEmail: "dispatch@load.example.com",
    contactPhone: "+971500000001",
    active: false,
  };

  const loadVehicles = Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    return {
      id: loadEntityId(LOAD_NAMESPACES.vehicle, index),
      customerId: customer.id,
      registrationNumber: `LOAD ${String(index).padStart(6, "0")}`,
      vin: `AWRLOAD${String(index).padStart(10, "0")}`,
      make: "Nissan",
      model: "Patrol",
      color: "White",
    };
  });

  const loadDrivers = Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    return {
      id: loadEntityId(LOAD_NAMESPACES.driver, index),
      vendorId: vendor.id,
      name: `Load Driver ${String(index).padStart(6, "0")}`,
      phone: `+97155${String(7_000_000 + index)}`,
      externalReference: `LOAD-DRV-${String(index).padStart(6, "0")}`,
      active: false,
    };
  });

  const loadTrips = Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const driver = loadDrivers[offset]!;
    const vehicle = loadVehicles[offset]!;

    return {
      id: loadTripId(index),
      referenceNumber: `TRIP-LOAD-${String(index).padStart(6, "0")}`,
      vehicleId: vehicle.id,
      vendorId: vendor.id,
      driverId: driver.id,
      status: "in_transit" as const,
      ...LOAD_ROUTE,
      scheduledAt: null,
      startedAt: seedTime,
    };
  });

  return {
    customer,
    vendor,
    vehicles: loadVehicles,
    drivers: loadDrivers,
    trips: loadTrips,
  };
}

export async function insertLoadFleet(db: Database, fleet: LoadFleet) {
  if (!fleet.customer || !fleet.vendor) {
    return;
  }

  await db.insert(customers).values(fleet.customer).onConflictDoNothing();
  await db
    .insert(logisticsVendors)
    .values(fleet.vendor)
    .onConflictDoNothing();
  await insertChunks(fleet.vehicles, (chunk) =>
    db.insert(vehicles).values(chunk).onConflictDoNothing(),
  );
  await insertChunks(fleet.drivers, (chunk) =>
    db.insert(drivers).values(chunk).onConflictDoNothing(),
  );
  await insertChunks(fleet.trips, (chunk) =>
    db.insert(trips).values(chunk).onConflictDoNothing(),
  );
}

async function insertChunks<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (
    let offset = 0;
    offset < rows.length;
    offset += LOAD_INSERT_CHUNK_SIZE
  ) {
    await insert(rows.slice(offset, offset + LOAD_INSERT_CHUNK_SIZE));
  }
}
