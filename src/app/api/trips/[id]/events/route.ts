import { tripEventsHandler } from "@/http/sse-handler";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return tripEventsHandler(id, request, getContainer());
}
