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
import {
  buildLoadFleet,
  insertLoadFleet,
  parseLoadTripCount,
} from "./seed-load";

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
  ["Nissan", "Patrol", "White", "Dubai A 48291"],
  ["Nissan", "X-Trail", "Silver", "Dubai B 73104"],
  ["Nissan", "Pathfinder", "Black", "Abu Dhabi 1 56321"],
  ["Nissan", "Sunny", "White", "Sharjah 1 28417"],
  ["Nissan", "Altima", "Grey", "Dubai C 91042"],
  ["Nissan", "Kicks", "Blue", "Ajman B 17482"],
  ["Nissan", "Patrol", "Black", "Abu Dhabi 4 63815"],
  ["Nissan", "X-Terra", "Bronze", "RAK C 52904"],
  ["Nissan", "Magnite", "Red", "Dubai D 41863"],
  ["Nissan", "Maxima", "Pearl White", "Sharjah 1 76025"],
  ["Nissan", "Patrol", "Gold", "Dubai E 29571"],
  ["Nissan", "X-Trail", "Dark Grey", "Abu Dhabi 17 84136"],
  ["INFINITI", "QX80", "Black", "Dubai F 37195"],
  ["INFINITI", "QX60", "White", "Abu Dhabi 5 60284"],
  ["INFINITI", "QX50", "Graphite", "Dubai G 15937"],
  ["INFINITI", "Q50", "Blue", "Sharjah 1 49381"],
  ["INFINITI", "QX55", "Red", "Dubai H 82504"],
  ["INFINITI", "QX80", "Champagne", "Abu Dhabi 8 31769"],
  ["INFINITI", "QX60", "Silver", "Dubai J 64028"],
  ["Renault", "Duster", "White", "Ajman C 58214"],
  ["Renault", "Koleos", "Black", "Dubai K 93617"],
  ["Renault", "Megane", "Grey", "Sharjah 4 25093"],
  ["Renault", "Captur", "Orange", "Dubai L 71426"],
  ["Renault", "Arkana", "White", "Abu Dhabi 6 48935"],
  ["Chery", "Tiggo 8 Pro Max", "Black", "Dubai M 36281"],
  ["Chery", "Tiggo 7 Pro", "Silver", "Sharjah 5 81740"],
  ["Chery", "Arrizo 8", "Blue", "Dubai N 59124"],
  ["Chery", "Tiggo 4 Pro", "White", "RAK D 43816"],
  ["Zeekr", "001", "Electric Blue", "Dubai P 27549"],
  ["Zeekr", "X", "Pearl White", "Abu Dhabi 7 70431"],
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

const tripRoutes = [
  {
    pickupAddress: "AWR Showroom, Sheikh Zayed Road, Dubai",
    pickupLatitude: 25.1774,
    pickupLongitude: 55.2407,
    dropoffAddress: "Al Zahia, Sharjah",
    dropoffLatitude: 25.3188,
    dropoffLongitude: 55.4581,
  },
  {
    pickupAddress: "Dubai Mall, Downtown Dubai",
    pickupLatitude: 25.1972,
    pickupLongitude: 55.2794,
    dropoffAddress: "Corniche Road, Abu Dhabi",
    dropoffLatitude: 24.4764,
    dropoffLongitude: 54.321,
  },
  {
    pickupAddress: "Al Ain Oasis, Al Ain",
    pickupLatitude: 24.2075,
    pickupLongitude: 55.7447,
    dropoffAddress: "Dubai Marina Walk, Dubai",
    dropoffLatitude: 25.0805,
    dropoffLongitude: 55.1403,
  },
  {
    pickupAddress: "City Centre Sharjah",
    pickupLatitude: 25.3238,
    pickupLongitude: 55.3928,
    dropoffAddress: "Al Hamra Village, Ras Al Khaimah",
    dropoffLatitude: 25.6842,
    dropoffLongitude: 55.7781,
  },
  {
    pickupAddress: "Ajman Corniche",
    pickupLatitude: 25.4111,
    pickupLongitude: 55.4352,
    dropoffAddress: "Fujairah Port",
    dropoffLatitude: 25.1356,
    dropoffLongitude: 56.358,
  },
  {
    pickupAddress: "Palm Jumeirah, Dubai",
    pickupLatitude: 25.1124,
    pickupLongitude: 55.139,
    dropoffAddress: "Expo City Dubai",
    dropoffLatitude: 24.963,
    dropoffLongitude: 55.1482,
  },
  {
    pickupAddress: "Yas Island, Abu Dhabi",
    pickupLatitude: 24.4957,
    pickupLongitude: 54.6073,
    dropoffAddress: "Burj Khalifa Boulevard, Dubai",
    dropoffLatitude: 25.197,
    dropoffLongitude: 55.2744,
  },
  {
    pickupAddress: "Al Quoz Industrial Area, Dubai",
    pickupLatitude: 25.1388,
    pickupLongitude: 55.2285,
    dropoffAddress: "Jebel Ali Port, Dubai",
    dropoffLatitude: 24.9857,
    dropoffLongitude: 55.0273,
  },
  {
    pickupAddress: "Motor City, Dubai",
    pickupLatitude: 25.0456,
    pickupLongitude: 55.2378,
    dropoffAddress: "Al Nahda, Sharjah",
    dropoffLatitude: 25.3053,
    dropoffLongitude: 55.3789,
  },
  {
    pickupAddress: "Khalifa City, Abu Dhabi",
    pickupLatitude: 24.4195,
    pickupLongitude: 54.5781,
    dropoffAddress: "Dubai International Airport",
    dropoffLatitude: 25.2532,
    dropoffLongitude: 55.3657,
  },
  {
    pickupAddress: "Dubai Investment Park",
    pickupLatitude: 24.9772,
    pickupLongitude: 55.1624,
    dropoffAddress: "Mussafah, Abu Dhabi",
    dropoffLatitude: 24.3635,
    dropoffLongitude: 54.516,
  },
  {
    pickupAddress: "Al Barsha, Dubai",
    pickupLatitude: 25.1112,
    pickupLongitude: 55.2033,
    dropoffAddress: "Umm Al Quwain Corniche",
    dropoffLatitude: 25.5647,
    dropoffLongitude: 55.5552,
  },
  {
    pickupAddress: "Business Bay, Dubai",
    pickupLatitude: 25.185,
    pickupLongitude: 55.2655,
    dropoffAddress: "Al Ain Mall, Al Ain",
    dropoffLatitude: 24.2165,
    dropoffLongitude: 55.7811,
  },
  {
    pickupAddress: "Deira City Centre, Dubai",
    pickupLatitude: 25.2522,
    pickupLongitude: 55.3326,
    dropoffAddress: "Kalba Corniche, Sharjah",
    dropoffLatitude: 25.0693,
    dropoffLongitude: 56.3553,
  },
  {
    pickupAddress: "Dubai Silicon Oasis",
    pickupLatitude: 25.1209,
    pickupLongitude: 55.3773,
    dropoffAddress: "Dubai Creek Harbour",
    dropoffLatitude: 25.2038,
    dropoffLongitude: 55.3456,
  },
  {
    pickupAddress: "Al Reem Island, Abu Dhabi",
    pickupLatitude: 24.4986,
    pickupLongitude: 54.407,
    dropoffAddress: "Saadiyat Island, Abu Dhabi",
    dropoffLatitude: 24.5415,
    dropoffLongitude: 54.436,
  },
  {
    pickupAddress: "Jumeirah Lakes Towers, Dubai",
    pickupLatitude: 25.0693,
    pickupLongitude: 55.1417,
    dropoffAddress: "Mirdif City Centre, Dubai",
    dropoffLatitude: 25.2194,
    dropoffLongitude: 55.4194,
  },
  {
    pickupAddress: "Ras Al Khaimah International Airport",
    pickupLatitude: 25.6134,
    pickupLongitude: 55.9388,
    dropoffAddress: "Dubai South",
    dropoffLatitude: 24.888,
    dropoffLongitude: 55.1614,
  },
  {
    pickupAddress: "Hatta, Dubai",
    pickupLatitude: 24.7969,
    pickupLongitude: 56.1269,
    dropoffAddress: "Al Faqa, Abu Dhabi",
    dropoffLatitude: 24.7167,
    dropoffLongitude: 55.6167,
  },
  {
    pickupAddress: "Al Khan, Sharjah",
    pickupLatitude: 25.3311,
    pickupLongitude: 55.3683,
    dropoffAddress: "Dubai Hills Estate",
    dropoffLatitude: 25.1098,
    dropoffLongitude: 55.2448,
  },
] as const;

export const SEED_TRIP_SCHEDULE_OFFSET_MS = 5 * 60 * 1_000;
export const SEED_TRIP_SCHEDULE_SLOT_MS = 71 * 60 * 1_000;

export function buildSeededTrips(seedTime = new Date()) {
  return tripRoutes.map((route, index) => {
    const driver = seededDrivers[index % seededDrivers.length]!;
    const vehicle = seededVehicles[index]!;

    return {
      id: index === 0 ? seedIds.trip : deterministicId("8500", index + 1),
      referenceNumber: `TRIP-DEMO-${String(index + 1).padStart(3, "0")}`,
      vehicleId: vehicle.id,
      vendorId: driver.vendorId,
      driverId: driver.id,
      status: "created" as const,
      ...route,
      scheduledAt: new Date(
        seedTime.getTime() +
          SEED_TRIP_SCHEDULE_OFFSET_MS +
          index * SEED_TRIP_SCHEDULE_SLOT_MS,
      ),
    };
  });
}

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

export async function seedDatabase(
  db: Database,
  seedTime = new Date(),
  loadTripCount = 0,
) {
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
    .values(buildSeededTrips(seedTime))
    .onConflictDoNothing();

  await insertLoadFleet(db, buildLoadFleet(loadTripCount, seedTime));
}

async function main() {
  const args = process.argv.slice(2);
  const { db, pool } = createDatabase(getEnvironment().DATABASE_URL);

  try {
    if (shouldResetDatabase(args)) {
      await resetDatabase(db);
    }
    await seedDatabase(db, new Date(), parseLoadTripCount(args));
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
