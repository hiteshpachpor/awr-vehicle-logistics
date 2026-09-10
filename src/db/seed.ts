import { sql } from "drizzle-orm";
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

function deterministicId(namespace: string, index: number) {
  return `00000000-0000-4000-${namespace}-${String(index).padStart(12, "0")}`;
}

const ownerProfiles = [
  ["Omar Al Mansoori", "omar.almansoori"],
  ["Aisha Al Suwaidi", "aisha.alsuwaidi"],
  ["Khalid Al Mazrouei", "khalid.almazrouei"],
  ["Maryam Al Falasi", "maryam.alfalasi"],
  ["Saeed Al Nuaimi", "saeed.alnuaimi"],
  ["Fatima Al Hammadi", "fatima.alhammadi"],
  ["Ahmed Al Shamsi", "ahmed.alshamsi"],
  ["Noura Al Ketbi", "noura.alketbi"],
  ["Rashid Al Marri", "rashid.almarri"],
  ["Layla Al Zaabi", "layla.alzaabi"],
  ["Arjun Mehta", "arjun.mehta"],
  ["Priya Nair", "priya.nair"],
  ["Rohan Kapoor", "rohan.kapoor"],
  ["Ananya Iyer", "ananya.iyer"],
  ["Faisal Khan", "faisal.khan"],
  ["Sara Ahmed", "sara.ahmed"],
  ["Miguel Santos", "miguel.santos"],
  ["Isabella Reyes", "isabella.reyes"],
  ["Daniel Cruz", "daniel.cruz"],
  ["Maria Garcia", "maria.garcia"],
  ["Youssef Haddad", "youssef.haddad"],
  ["Lina Khoury", "lina.khoury"],
  ["Karim Mansour", "karim.mansour"],
  ["Hana Saleh", "hana.saleh"],
  ["James Wilson", "james.wilson"],
  ["Sophie Martin", "sophie.martin"],
  ["Chen Wei", "chen.wei"],
  ["Mei Lin", "mei.lin"],
  ["Noah Williams", "noah.williams"],
  ["Elena Petrova", "elena.petrova"],
] as const;

const vehicleProfiles = [
  ["Nissan", "Patrol", "White", "DUBAI-A-48291"],
  ["Nissan", "X-Trail", "Silver", "DUBAI-B-73104"],
  ["Nissan", "Pathfinder", "Black", "AUH-1-56321"],
  ["Nissan", "Sunny", "White", "SHJ-3-28417"],
  ["Nissan", "Altima", "Grey", "DUBAI-C-91042"],
  ["Nissan", "Kicks", "Blue", "AJM-B-17482"],
  ["Nissan", "Patrol", "Black", "AUH-2-63815"],
  ["Nissan", "X-Terra", "Bronze", "RAK-C-52904"],
  ["Nissan", "Magnite", "Red", "DUBAI-D-41863"],
  ["Nissan", "Maxima", "Pearl White", "SHJ-1-76025"],
  ["Nissan", "Patrol", "Gold", "DUBAI-E-29571"],
  ["Nissan", "X-Trail", "Dark Grey", "AUH-7-84136"],
  ["INFINITI", "QX80", "Black", "DUBAI-F-37195"],
  ["INFINITI", "QX60", "White", "AUH-4-60284"],
  ["INFINITI", "QX50", "Graphite", "DUBAI-G-15937"],
  ["INFINITI", "Q50", "Blue", "SHJ-2-49381"],
  ["INFINITI", "QX55", "Red", "DUBAI-H-82504"],
  ["INFINITI", "QX80", "Champagne", "AUH-5-31769"],
  ["INFINITI", "QX60", "Silver", "DUBAI-J-64028"],
  ["Renault", "Duster", "White", "AJM-C-58214"],
  ["Renault", "Koleos", "Black", "DUBAI-K-93617"],
  ["Renault", "Megane", "Grey", "SHJ-4-25093"],
  ["Renault", "Captur", "Orange", "DUBAI-L-71426"],
  ["Renault", "Arkana", "White", "AUH-6-48935"],
  ["Chery", "Tiggo 8 Pro Max", "Black", "DUBAI-M-36281"],
  ["Chery", "Tiggo 7 Pro", "Silver", "SHJ-5-81740"],
  ["Chery", "Arrizo 8", "Blue", "DUBAI-N-59124"],
  ["Chery", "Tiggo 4 Pro", "White", "RAK-D-43816"],
  ["Zeekr", "001", "Electric Blue", "DUBAI-P-27549"],
  ["Zeekr", "X", "Pearl White", "AUH-8-70431"],
] as const;

const brandCodes: Record<(typeof vehicleProfiles)[number][0], string> = {
  Nissan: "NIS",
  INFINITI: "INF",
  Renault: "REN",
  Chery: "CHR",
  Zeekr: "ZKR",
};

export const seededCustomers = ownerProfiles.map(([name, email], index) => ({
  id:
    index === 0
      ? seedIds.customer
      : deterministicId("8100", index + 1),
  name,
  email: `${email}@owners.example.com`,
  phone: `+97150${String(7_000_001 + index)}`,
}));

export const seededVehicles = vehicleProfiles.map(
  ([make, model, color, registrationNumber], index) => ({
    id:
      index === 0
        ? seedIds.vehicle
        : deterministicId("8200", index + 1),
    customerId: seededCustomers[index]!.id,
    registrationNumber,
    vin: `AWRUAE${brandCodes[make]}${String(index + 1).padStart(8, "0")}`,
    make,
    model,
    color,
  }),
);

export const seededVendors = [
  {
    id: seedIds.vendor,
    name: "Crescent Dune Vehicle Logistics LLC",
    contactEmail: "dispatch@crescent-dune.example.com",
    contactPhone: "+971502100001",
  },
  {
    id: deterministicId("8300", 2),
    name: "Palm Route Auto Transit LLC",
    contactEmail: "operations@palm-route.example.com",
    contactPhone: "+971502100002",
  },
  {
    id: deterministicId("8300", 3),
    name: "Hajar Link Automotive Carriers LLC",
    contactEmail: "control@hajar-link.example.com",
    contactPhone: "+971502100003",
  },
  {
    id: deterministicId("8300", 4),
    name: "Blue Gulf Vehicle Movements LLC",
    contactEmail: "fleet@blue-gulf.example.com",
    contactPhone: "+971502100004",
  },
  {
    id: deterministicId("8300", 5),
    name: "Sandstone Mile Transport Services LLC",
    contactEmail: "dispatch@sandstone-mile.example.com",
    contactPhone: "+971502100005",
  },
];

const driverNames = [
  "Bilal Rahman",
  "Imran Qureshi",
  "Joseph Mendoza",
  "Nadeem Farooq",
  "Ramesh Gurung",
  "Tariq Mahmoud",
  "Samuel Dsouza",
  "Wael Hassan",
  "Prakash Thapa",
  "Adnan Mirza",
] as const;

export const seededDrivers = driverNames.map((name, index) => ({
  id: index === 0 ? seedIds.driver : deterministicId("8400", index + 1),
  vendorId: seededVendors[index % seededVendors.length]!.id,
  name,
  phone: `+97155${String(6_100_001 + index)}`,
  externalReference: `DRV-${String(index + 1).padStart(3, "0")}`,
}));

export function shouldResetDatabase(args: string[]) {
  return args.includes("--reset-db");
}

export async function resetDatabase(db: Database) {
  await db.execute(sql`
    truncate table
      trip_positions,
      trips,
      drivers,
      logistics_vendors,
      vehicles,
      customers
    restart identity cascade
  `);
}

export async function seedDatabase(db: Database) {
  await db
    .insert(customers)
    .values(seededCustomers)
    .onConflictDoNothing();

  await db
    .insert(vehicles)
    .values(seededVehicles)
    .onConflictDoNothing();

  await db
    .insert(logisticsVendors)
    .values(seededVendors)
    .onConflictDoNothing();

  await db
    .insert(drivers)
    .values(seededDrivers)
    .onConflictDoNothing();

  await db
    .insert(trips)
    .values({
      id: seedIds.trip,
      referenceNumber: "TRIP-DEMO-001",
      vehicleId: seedIds.vehicle,
      driverId: seedIds.driver,
      status: "created",
      pickupAddress: "AWR Showroom, Sheikh Zayed Road, Dubai",
      pickupLatitude: 25.1774,
      pickupLongitude: 55.2407,
      dropoffAddress: "Al Zahia, Sharjah",
      dropoffLatitude: 25.3188,
      dropoffLongitude: 55.4581,
    })
    .onConflictDoNothing();
}

async function main() {
  const { db, pool } = createDatabase(getEnvironment().DATABASE_URL);

  try {
    if (shouldResetDatabase(process.argv.slice(2))) {
      await resetDatabase(db);
    }
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
