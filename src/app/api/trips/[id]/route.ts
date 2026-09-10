import { getContainer } from "@/lib/container";
import {
  getTripHandler,
  updateTripHandler,
} from "@/http/trip-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return getTripHandler(id, getContainer());
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return updateTripHandler(id, request, getContainer());
}
