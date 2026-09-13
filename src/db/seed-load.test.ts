import { describe, expect, it } from "vitest";
import { seedIds } from "./seed";
import {
  LOAD_NAMESPACES,
  LOAD_ROUTE,
  LOAD_TRIPS_DEFAULT,
  LOAD_TRIPS_MAX,
  buildLoadFleet,
  loadTripId,
  parseLoadTripCount,
} from "./seed-load";

describe("load fleet seed", () => {
  it("builds an empty fleet when the count is zero", () => {
    const fleet = buildLoadFleet(0);

    expect(fleet.customer).toBeNull();
    expect(fleet.vendor).toBeNull();
    expect(fleet.vehicles).toEqual([]);
    expect(fleet.drivers).toEqual([]);
    expect(fleet.trips).toEqual([]);
  });

  it("builds two hundred isolated in-transit trips", () => {
    const seedTime = new Date("2026-09-13T08:00:00.000Z");
    const fleet = buildLoadFleet(200, seedTime);

    expect(fleet.customer).toMatchObject({
      id: `00000000-0000-4000-${LOAD_NAMESPACES.customer}-000000000001`,
      name: "Load Harness Fleet",
    });
    expect(fleet.vendor).toMatchObject({
      active: false,
      name: "Load Harness Logistics LLC",
    });
    expect(fleet.vehicles).toHaveLength(200);
    expect(fleet.drivers).toHaveLength(200);
    expect(fleet.trips).toHaveLength(200);
    expect(new Set(fleet.vehicles.map(({ id }) => id)).size).toBe(200);
    expect(new Set(fleet.drivers.map(({ id }) => id)).size).toBe(200);
    expect(new Set(fleet.trips.map(({ id }) => id)).size).toBe(200);
    expect(new Set(fleet.vehicles.map(({ vin }) => vin)).size).toBe(200);
    expect(
      new Set(fleet.trips.map(({ referenceNumber }) => referenceNumber)).size,
    ).toBe(200);
    expect(fleet.vehicles.every(({ vin }) => vin?.length === 17)).toBe(true);
    expect(fleet.drivers.every(({ active }) => active === false)).toBe(true);
    expect(fleet.trips.every(({ status }) => status === "in_transit")).toBe(
      true,
    );
    expect(
      fleet.trips.every(
        ({ pickupAddress, dropoffAddress }) =>
          pickupAddress === LOAD_ROUTE.pickupAddress &&
          dropoffAddress === LOAD_ROUTE.dropoffAddress,
      ),
    ).toBe(true);
    expect(fleet.trips[0]).toMatchObject({
      id: loadTripId(1),
      driverId: fleet.drivers[0]?.id,
      vehicleId: fleet.vehicles[0]?.id,
      vendorId: fleet.vendor?.id,
      scheduledAt: null,
      startedAt: seedTime,
    });
  });

  it("does not reuse demo seed ids", () => {
    const fleet = buildLoadFleet(200);
    const loadIds = [
      fleet.customer?.id,
      fleet.vendor?.id,
      ...fleet.vehicles.map(({ id }) => id),
      ...fleet.drivers.map(({ id }) => id),
      ...fleet.trips.map(({ id }) => id),
    ];

    expect(loadIds).not.toContain(seedIds.customer);
    expect(loadIds).not.toContain(seedIds.vehicle);
    expect(loadIds).not.toContain(seedIds.vendor);
    expect(loadIds).not.toContain(seedIds.driver);
    expect(loadIds).not.toContain(seedIds.trip);
  });

  it("parses the load trip flag", () => {
    expect(parseLoadTripCount([])).toBe(0);
    expect(parseLoadTripCount(["--reset-db"])).toBe(0);
    expect(parseLoadTripCount(["--load-trips"])).toBe(LOAD_TRIPS_DEFAULT);
    expect(parseLoadTripCount(["--load-trips="])).toBe(LOAD_TRIPS_DEFAULT);
    expect(parseLoadTripCount(["--load-trips=50"])).toBe(50);
    expect(parseLoadTripCount(["--load-trips", "50"])).toBe(50);
    expect(parseLoadTripCount(["--reset-db", "--load-trips=200"])).toBe(200);
  });

  it("rejects a load trip count above the safety cap", () => {
    expect(() => parseLoadTripCount([`--load-trips=${LOAD_TRIPS_MAX + 1}`])).toThrow(
      `--load-trips cannot exceed ${LOAD_TRIPS_MAX}`,
    );
    expect(() => buildLoadFleet(LOAD_TRIPS_MAX + 1)).toThrow(
      `--load-trips cannot exceed ${LOAD_TRIPS_MAX}`,
    );
    expect(() => parseLoadTripCount(["--load-trips=nope"])).toThrow(
      `--load-trips must be an integer between 0 and ${LOAD_TRIPS_MAX}`,
    );
  });
});
