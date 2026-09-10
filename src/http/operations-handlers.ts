import { NextResponse } from "next/server";
import type { AppContainer } from "@/lib/container";
import { errorResponse } from "./responses";

export async function listVehiclesHandler(container: AppContainer) {
  try {
    const vehicles = await container.operationsService.listVehicles();
    return NextResponse.json({ data: vehicles });
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
