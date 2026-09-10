import type { NextRequest } from "next/server";
import { getContainer } from "@/lib/container";
import {
  createTripHandler,
  listTripsHandler,
} from "@/http/trip-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return listTripsHandler(request, getContainer());
}

export function POST(request: Request) {
  return createTripHandler(request, getContainer());
}
