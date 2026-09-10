import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppContainer } from "@/lib/container";
import { errorResponse } from "./responses";

const vehicleQuerySchema = z.object({
  customerId: z.uuid().optional(),
});

export async function listCustomersHandler(container: AppContainer) {
  try {
    const customers = await container.operationsService.listCustomers();
    return NextResponse.json({ data: customers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function listVehiclesHandler(
  request: NextRequest,
  container: AppContainer,
) {
  try {
    const query = vehicleQuerySchema.parse({
      customerId:
        request.nextUrl.searchParams.get("customerId") ?? undefined,
    });
    const vehicles = await container.operationsService.listVehicles(
      query.customerId,
    );
    return NextResponse.json({ data: vehicles });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function listVendorsHandler(container: AppContainer) {
  try {
    const vendors = await container.operationsService.listVendors();
    return NextResponse.json({ data: vendors });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function listDriversHandler(container: AppContainer) {
  try {
    const drivers = await container.operationsService.listDrivers();
    return NextResponse.json({ data: drivers });
  } catch (error) {
    return errorResponse(error);
  }
}
