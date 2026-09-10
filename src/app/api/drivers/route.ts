import type { NextRequest } from "next/server";
import { listDriversHandler } from "@/http/operations-handlers";
import { getContainer } from "@/lib/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return listDriversHandler(request, getContainer());
}
