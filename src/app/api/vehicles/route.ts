import { listVehiclesHandler } from "@/http/operations-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return listVehiclesHandler(getContainer());
}
