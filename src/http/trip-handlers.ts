import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createTripSchema,
  ingestLocationSchema,
  listTripsQuerySchema,
  simulationRequestSchema,
  updateTripSchema,
} from "@/domain/contracts";
import { NotFoundError } from "@/domain/errors";
import type { AppContainer } from "@/lib/container";
import { errorResponse } from "./responses";

const idSchema = z.uuid();

export async function createTripHandler(
  request: Request,
  container: AppContainer,
) {
  try {
    const input = createTripSchema.parse(await request.json());
    const trip = await container.tripService.create(input);
    return NextResponse.json(trip, {
      status: 201,
      headers: { Location: `/api/trips/${trip.trip.id}` },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function listTripsHandler(
  request: NextRequest,
  container: AppContainer,
) {
  try {
    const query = listTripsQuerySchema.parse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    });
    const trips = await container.tripService.list(query.status);
    return NextResponse.json({ data: trips });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function getTripHandler(id: string, container: AppContainer) {
  try {
    const trip = await container.tripService.get(idSchema.parse(id));
    return NextResponse.json(trip);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function updateTripHandler(
  id: string,
  request: Request,
  container: AppContainer,
) {
  try {
    const tripId = idSchema.parse(id);
    const input = updateTripSchema.parse(await request.json());
    const trip = await container.tripService.transition(tripId, input.status);
    return NextResponse.json(trip);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function ingestLocationHandler(
  id: string,
  request: Request,
  container: AppContainer,
) {
  try {
    const tripId = idSchema.parse(id);
    const input = ingestLocationSchema.parse(await request.json());
    const result = await container.locationService.ingest(tripId, input);
    return NextResponse.json(
      { data: result.position, duplicate: !result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function startSimulationHandler(
  id: string,
  request: Request,
  container: AppContainer,
) {
  try {
    const tripId = idSchema.parse(id);
    const input = simulationRequestSchema.parse(await request.json());
    const simulation = await container.simulatorService.start(
      tripId,
      input.intervalMs,
    );
    return NextResponse.json({ data: simulation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function stopSimulationHandler(
  id: string,
  container: AppContainer,
) {
  try {
    const tripId = idSchema.parse(id);
    if (!container.simulatorService.stop(tripId)) {
      throw new NotFoundError("Simulation");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
