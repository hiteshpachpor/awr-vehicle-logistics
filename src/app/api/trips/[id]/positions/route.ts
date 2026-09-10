import { listTripPositionsHandler } from "@/http/trip-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  return listTripPositionsHandler(id, getContainer());
}
