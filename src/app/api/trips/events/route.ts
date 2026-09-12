import { tripListEventsHandler } from "@/http/sse-handler";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return tripListEventsHandler(request, getContainer());
}
