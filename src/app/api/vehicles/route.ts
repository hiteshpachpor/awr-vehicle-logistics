import type { NextRequest } from "next/server";
import { listVehiclesHandler } from "@/http/operations-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return listVehiclesHandler(request, getContainer());
}
