import { ingestLocationHandler } from "@/http/trip-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return ingestLocationHandler(id, request, getContainer());
}
