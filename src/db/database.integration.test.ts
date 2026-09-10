import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "./client";
import { runMigrations } from "./migrate";
import { resetDatabase, seedDatabase, seedIds } from "./seed";
import {
  customers,
  drivers,
  logisticsVendors,
  tripPositions,
  trips,
  vehicles,
} from "./schema";
import { PositionRepository } from "@/repositories/position-repository";
import { TripRepository } from "@/repositories/trip-repository";
import {
  PostgresPositionEventSource,
  PostgresPositionPublisher,
} from "@/services/position-events";

describe("database schema", () => {
  let container: StartedPostgreSqlContainer;
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17.6-alpine").start();
    await runMigrations(container.getConnectionUri());
    database = createDatabase(container.getConnectionUri());
    await seedDatabase(database.db);
  }, 120_000);

  afterAll(async () => {
    await database?.pool.end();
    await container?.stop();
  });

  it("applies the migration and seeds idempotently", async () => {
    await seedDatabase(database.db);

    const customerCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers);
    const tripCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(trips);
    const vehicleCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles);
    const vendorCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(logisticsVendors);
    const driverCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(drivers);

    expect(customerCount[0]?.count).toBe(30);
    expect(vehicleCount[0]?.count).toBe(30);
    expect(vendorCount[0]?.count).toBe(5);
    expect(driverCount[0]?.count).toBe(10);
    expect(tripCount[0]?.count).toBe(1);
  });

  it("resets every application table before reseeding", async () => {
    await database.db.insert(customers).values({
      name: "Temporary Owner",
      email: "temporary@example.com",
    });
    await database.db.insert(tripPositions).values({
      tripId: seedIds.trip,
      latitude: 25.2,
      longitude: 55.3,
      recordedAt: new Date(),
      source: "vendor",
    });

    await resetDatabase(database.db);
    await seedDatabase(database.db);

    const customerCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers);
    const positionCount = await database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tripPositions);

    expect(customerCount[0]?.count).toBe(30);
    expect(positionCount[0]?.count).toBe(0);
  });

  it("enforces coordinate constraints", async () => {
    await expect(
      database.db.insert(tripPositions).values({
        tripId: "00000000-0000-4000-8000-000000000005",
        latitude: 91,
        longitude: 55,
        recordedAt: new Date(),
        source: "vendor",
      }),
    ).rejects.toThrow();
  });

  it("deduplicates source events per trip", async () => {
    const position = {
      tripId: "00000000-0000-4000-8000-000000000005",
      latitude: 25.2,
      longitude: 55.3,
      recordedAt: new Date(),
      source: "vendor" as const,
      sourceEventId: "vendor-event-1",
    };

    await database.db.insert(tripPositions).values(position);
    await expect(
      database.db.insert(tripPositions).values(position),
    ).rejects.toThrow();
  });

  it("reads joined trips and ordered positions through repositories", async () => {
    const tripRepository = new TripRepository(database.db);
    const positionRepository = new PositionRepository(database.db);
    const details = await tripRepository.findById(seedIds.trip);
    const listed = await tripRepository.list("created");

    expect(details).toMatchObject({
      trip: { id: seedIds.trip },
      customer: { id: seedIds.customer },
      vehicle: { id: seedIds.vehicle },
      driver: { id: seedIds.driver },
      vendor: { id: seedIds.vendor },
    });
    expect(listed.map(({ trip }) => trip.id)).toContain(seedIds.trip);

    const input = {
      tripId: seedIds.trip,
      latitude: 25.25,
      longitude: 55.35,
      recordedAt: new Date("2030-09-10T12:00:00Z"),
      source: "vendor" as const,
      sourceEventId: "repository-event",
    };
    const inserted = await positionRepository.create(input);
    const duplicate = await positionRepository.create(input);
    const latest = await positionRepository.latestForTrips([seedIds.trip]);
    const replay = await positionRepository.listAfter(seedIds.trip, 0);

    expect(inserted.created).toBe(true);
    expect(duplicate).toEqual({ position: inserted.position, created: false });
    expect(latest.get(seedIds.trip)?.id).toBe(inserted.position.id);
    expect(replay.map(({ id }) => id)).toContain(inserted.position.id);
  });

  it("delivers position notifications through PostgreSQL", async () => {
    const eventSource = new PostgresPositionEventSource(
      container.getConnectionUri(),
    );
    const publisher = new PostgresPositionPublisher(database.pool);
    let resolveNotification:
      | ((value: { tripId: string; positionId: number }) => void)
      | undefined;
    const received = new Promise<{ tripId: string; positionId: number }>(
      (resolve) => {
        resolveNotification = resolve;
      },
    );
    await eventSource.subscribe(
      "00000000-0000-4000-8000-000000000005",
      (notification) => resolveNotification?.(notification),
    );

    await publisher.publish({
      tripId: "00000000-0000-4000-8000-000000000005",
      positionId: 99,
    });

    await expect(received).resolves.toEqual({
      tripId: "00000000-0000-4000-8000-000000000005",
      positionId: 99,
    });
    await eventSource.close();
  });
});
