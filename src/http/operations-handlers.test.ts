import { describe, expect, it, vi } from "vitest";
import type { AppContainer } from "@/lib/container";
import {
  listDriversHandler,
  listVehiclesHandler,
} from "./operations-handlers";

function container() {
  return {
    operationsService: {
      listVehicles: vi.fn(),
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
        registrationNumber: "DUBAI-A-48291",
        make: "Nissan",
        model: "Patrol",
        color: "White",
        customer: { id: "customer-id", name: "Omar Al Mansoori" },
      },
    ]);

    const response = await listVehiclesHandler(app);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [{ registrationNumber: "DUBAI-A-48291" }],
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

    const response = await listDriversHandler(app);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [{ name: "Bilal Rahman" }],
    });
  });
});
