import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/domain/errors";

type PostgreSqlError = Error & { code?: string; constraint?: string };

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must contain valid JSON",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  const wrappedError = error as Error & { cause?: PostgreSqlError };
  const databaseError = wrappedError.cause ?? (error as PostgreSqlError);
  if (databaseError?.code === "23505") {
    if (databaseError.constraint === "trips_vehicle_active_unique") {
      return NextResponse.json(
        {
          error: {
            code: "VEHICLE_ACTIVE_TRIP_EXISTS",
            message: "This vehicle already has an active trip",
          },
        },
        { status: 409 },
      );
    }
    if (databaseError.constraint === "trips_driver_active_unique") {
      return NextResponse.json(
        {
          error: {
            code: "DRIVER_IN_TRANSIT_TRIP_EXISTS",
            message: "This driver already has an in-transit trip",
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "DUPLICATE_RESOURCE",
          message: "A resource with these identifiers already exists",
        },
      },
      { status: 409 },
    );
  }
  if (databaseError?.code === "23503") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REFERENCE",
          message: "A referenced resource does not exist",
        },
      },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 },
  );
}
