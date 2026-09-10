import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/domain/errors";

type PostgreSqlError = Error & { code?: string };

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

  const databaseError = error as PostgreSqlError;
  if (databaseError?.code === "23505") {
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
