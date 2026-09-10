import { describe, expect, it } from "vitest";
import {
  createTripSchema,
  ingestLocationSchema,
  simulationRequestSchema,
} from "./contracts";

describe("API contracts", () => {
  it("accepts a valid trip", () => {
    const result = createTripSchema.safeParse({
      vehicleId: "00000000-0000-4000-8000-000000000001",
      vendorId: "00000000-0000-4000-8000-000000000002",
      pickup: { address: "Dubai", lat: 25.2, lng: 55.3 },
      dropoff: { address: "Sharjah", lat: 25.35, lng: 55.42 },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid location coordinates", () => {
    const result = ingestLocationSchema.safeParse({
      lat: 91,
      lng: 55,
      timestamp: "2026-09-10T10:00:00Z",
    });

    expect(result.success).toBe(false);
  });

  it("applies the default simulator interval", () => {
    expect(simulationRequestSchema.parse({}).intervalMs).toBe(1_000);
  });
});
