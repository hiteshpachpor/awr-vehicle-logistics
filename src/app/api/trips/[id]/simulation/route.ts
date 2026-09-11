import {
  getSimulationHandler,
  startSimulationHandler,
  stopSimulationHandler,
} from "@/http/trip-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return getSimulationHandler(id, getContainer());
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return startSimulationHandler(id, request, getContainer());
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  return stopSimulationHandler(id, getContainer());
}
