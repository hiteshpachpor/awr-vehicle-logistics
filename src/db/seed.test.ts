import { describe, expect, it } from "vitest";
import { DRIVER_SCHEDULE_GAP_MS } from "@/domain/driver-availability";
import {
  buildSeededTrips,
  SEED_TRIP_SCHEDULE_OFFSET_MS,
  seededCustomers,
  seededDrivers,
  seededVehicles,
  seededVendors,
  seedIds,
  shouldResetDatabase,
} from "./seed";

const DAY_MS = 24 * 60 * 60 * 1_000;

describe("realistic UAE seed data", () => {
  it("creates thirty owners with one vehicle each", () => {
    expect(seededCustomers).toHaveLength(30);
    expect(seededVehicles).toHaveLength(30);
    expect(new Set(seededCustomers.map(({ id }) => id)).size).toBe(30);
    expect(new Set(seededVehicles.map(({ customerId }) => customerId))).toEqual(
      new Set(seededCustomers.map(({ id }) => id)),
    );
  });

  it("uses only the requested brands in descending volume", () => {
    const volumes = seededVehicles.reduce<Record<string, number>>(
      (counts, vehicle) => ({
        ...counts,
        [vehicle.make]: (counts[vehicle.make] ?? 0) + 1,
      }),
      {},
    );

    expect(volumes).toEqual({
      Nissan: 12,
      INFINITI: 7,
      Renault: 5,
      Chery: 4,
      Zeekr: 2,
    });
  });

  it("uses synthetic contact details and unique vehicle identifiers", () => {
    expect(
      seededCustomers.every(({ email }) =>
        email.endsWith("@owners.example.com"),
      ),
    ).toBe(true);
    expect(new Set(seededVehicles.map(({ vin }) => vin)).size).toBe(30);
    expect(
      seededVehicles.every(({ vin }) => vin.length === 17),
    ).toBe(true);
  });

  it("uses realistic UAE registration plates", () => {
    const uaePlate =
      /^(Dubai [A-HJ-NP-Z] \d{1,5}|Abu Dhabi (?:[1-9]|1[0-8]|50) \d{1,5}|Sharjah [145-9] \d{1,5}|Ajman [A-Z] \d{1,5}|RAK [A-Z] \d{1,5})$/;

    expect(
      new Set(seededVehicles.map(({ registrationNumber }) => registrationNumber))
        .size,
    ).toBe(30);
    expect(
      seededVehicles.every(({ registrationNumber }) =>
        uaePlate.test(registrationNumber),
      ),
    ).toBe(true);
  });

  it("assigns drivers across imaginary logistics vendors", () => {
    expect(seededVendors).toHaveLength(5);
    expect(seededDrivers).toHaveLength(10);
    expect(
      seededVendors.every(({ name }) => name.endsWith("LLC")),
    ).toBe(true);
    expect(
      seededDrivers.every(({ vendorId }) =>
        seededVendors.some(({ id }) => id === vendorId),
      ),
    ).toBe(true);
  });

  it("recognizes the explicit database reset flag", () => {
    expect(shouldResetDatabase(["--reset-db"])).toBe(true);
    expect(shouldResetDatabase(["--other-option"])).toBe(false);
  });

  it("schedules twenty trips across vendors without overlapping driver or vehicle work", () => {
    const seedTime = new Date("2026-09-11T08:00:00.000Z");
    const seededTrips = buildSeededTrips(seedTime);
    const vendorIds = new Set(seededTrips.map(({ vendorId }) => vendorId));
    const scheduleByDriver = new Map<string, number[]>();

    expect(seededTrips).toHaveLength(20);
    expect(seededTrips[0]).toMatchObject({
      id: seedIds.trip,
      vehicleId: seedIds.vehicle,
      vendorId: seedIds.vendor,
      driverId: seedIds.driver,
      referenceNumber: "TRIP-DEMO-001",
    });
    expect(new Set(seededTrips.map(({ id }) => id)).size).toBe(20);
    expect(
      new Set(seededTrips.map(({ referenceNumber }) => referenceNumber)).size,
    ).toBe(20);
    expect(new Set(seededTrips.map(({ vehicleId }) => vehicleId)).size).toBe(20);
    expect(
      new Set(seededTrips.map(({ scheduledAt }) => scheduledAt.getTime())).size,
    ).toBe(20);
    expect(vendorIds.size).toBe(seededVendors.length);
    expect(vendorIds).toEqual(new Set(seededVendors.map(({ id }) => id)));

    for (const trip of seededTrips) {
      const driver = seededDrivers.find(({ id }) => id === trip.driverId);
      const scheduledAt = trip.scheduledAt.getTime();

      expect(driver).toBeDefined();
      expect(trip.vendorId).toBe(driver!.vendorId);
      expect(scheduledAt).toBeGreaterThanOrEqual(
        seedTime.getTime() + SEED_TRIP_SCHEDULE_OFFSET_MS,
      );
      expect(scheduledAt).toBeLessThan(seedTime.getTime() + DAY_MS);

      const times = scheduleByDriver.get(trip.driverId) ?? [];
      times.push(scheduledAt);
      scheduleByDriver.set(trip.driverId, times);
    }

    for (const times of scheduleByDriver.values()) {
      const sorted = [...times].sort((left, right) => left - right);
      for (let index = 1; index < sorted.length; index += 1) {
        expect(sorted[index]! - sorted[index - 1]!).toBeGreaterThanOrEqual(
          DRIVER_SCHEDULE_GAP_MS,
        );
      }
    }
  });
});
