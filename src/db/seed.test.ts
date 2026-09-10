import { describe, expect, it } from "vitest";
import {
  seededCustomers,
  seededDrivers,
  seededVehicles,
  seededVendors,
} from "./seed";

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
});
