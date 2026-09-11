import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { AppContainer } from "@/lib/container";
import {
  listCustomersHandler,
  listDriversHandler,
  listVendorsHandler,
  listVehiclesHandler,
} from "./operations-handlers";

function container() {
  return {
    operationsService: {
      listCustomers: vi.fn(),
      listVehicles: vi.fn(),
      listVendors: vi.fn(),
      listDrivers: vi.fn(),
    },
  } as unknown as AppContainer;
}

describe("operations HTTP handlers", () => {
  it("returns vehicles for operations selectors", async () => {
    const app = container();
    vi.mocked(app.operationsService.listVehicles).mockResolvedValue([
      {
        id: "vehicle-id",
        registrationNumber: "Dubai A 48291",
        make: "Nissan",
        model: "Patrol",
        color: "White",
        customer: { id: "customer-id", name: "Omar Al Mansoori" },
      },
    ]);

    const response = await listVehiclesHandler(
      new NextRequest(
        "http://localhost/api/vehicles?customerId=00000000-0000-4000-8000-000000000001",
      ),
      app,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [{ registrationNumber: "Dubai A 48291" }],
    });
    expect(app.operationsService.listVehicles).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("returns customer and active vendor options", async () => {
    const app = container();
    vi.mocked(app.operationsService.listCustomers).mockResolvedValue([
      { id: "customer-id", name: "Omar Al Mansoori" },
    ]);
    vi.mocked(app.operationsService.listVendors).mockResolvedValue([
      { id: "vendor-id", name: "Crescent Dune Logistics" },
    ]);

    const customersResponse = await listCustomersHandler(app);
    const vendorsResponse = await listVendorsHandler(app);

    expect(await customersResponse.json()).toEqual({
      data: [{ id: "customer-id", name: "Omar Al Mansoori" }],
    });
    expect(await vendorsResponse.json()).toEqual({
      data: [{ id: "vendor-id", name: "Crescent Dune Logistics" }],
    });
  });

  it("returns active drivers for operations selectors", async () => {
    const app = container();
    vi.mocked(app.operationsService.listDrivers).mockResolvedValue([
      {
        id: "driver-id",
        name: "Bilal Rahman",
        phone: "+971556100001",
        externalReference: "DRV-001",
        vendor: { id: "vendor-id", name: "Crescent Dune Logistics" },
      },
    ]);

    const response = await listDriversHandler(
      new NextRequest(
        "http://localhost/api/drivers?vendorId=00000000-0000-4000-8000-000000000001",
      ),
      app,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [{ name: "Bilal Rahman" }],
    });
    expect(app.operationsService.listDrivers).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
    );
  });
});
