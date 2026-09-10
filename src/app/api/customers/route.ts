import { listCustomersHandler } from "@/http/operations-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return listCustomersHandler(getContainer());
}
