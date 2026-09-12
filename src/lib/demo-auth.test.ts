import { describe, expect, it } from "vitest";
import {
  canAccessTrip,
  getSessionHome,
  isController,
  parseDemoSession,
  type DemoSession,
} from "./demo-auth";

const controller: DemoSession = {
  role: "controller",
  vendorId: "vendor-1",
  vendorName: "Vendor One",
};
const driver: DemoSession = {
  role: "driver",
  vendorId: "vendor-1",
  vendorName: "Vendor One",
  driverId: "driver-1",
  driverName: "Driver One",
};

describe("demo auth", () => {
  it("returns the correct home for every role", () => {
    expect(getSessionHome({ role: "operations" })).toBe("/ops/trips");
    expect(getSessionHome(controller)).toBe("/vendor/vendor-1/trips");
    expect(getSessionHome(driver)).toBe(
      "/vendor/vendor-1/driver/driver-1/trips",
    );
  });

  it("narrows controller sessions", () => {
    expect(isController({ role: "operations" })).toBe(false);
    expect(isController(controller)).toBe(true);
    expect(isController(driver)).toBe(false);
    expect(isController(null)).toBe(false);
  });

  it("scopes controller and driver trip access", () => {
    const assignedTrip = {
      vendor: { id: "vendor-1" },
      driver: { id: "driver-1" },
    };
    expect(canAccessTrip(controller, assignedTrip)).toBe(true);
    expect(canAccessTrip(driver, assignedTrip)).toBe(true);
    expect(
      canAccessTrip(driver, {
        vendor: { id: "vendor-1" },
        driver: { id: "driver-2" },
      }),
    ).toBe(false);
    expect(
      canAccessTrip(controller, {
        vendor: { id: "vendor-2" },
        driver: null,
      }),
    ).toBe(false);
  });

  it("rejects malformed persisted sessions", () => {
    expect(parseDemoSession('{"role":"driver"}')).toBeNull();
    expect(parseDemoSession("not-json")).toBeNull();
    expect(parseDemoSession('{"role":"operations"}')).toEqual({
      role: "operations",
    });
  });
});
