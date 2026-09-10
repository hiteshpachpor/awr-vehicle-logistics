export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} was not found`, "NOT_FOUND", 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = "CONFLICT") {
    super(message, code, 409);
  }
}

export class InvalidStateTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super(
      `Trip cannot transition from ${from} to ${to}`,
      "INVALID_STATE_TRANSITION",
    );
  }
}

export class InvalidGoogleMapsLinkError extends DomainError {
  constructor(message = "A valid Google Maps link is required") {
    super(message, "INVALID_GOOGLE_MAPS_LINK", 400);
  }
}

export class GoogleMapsLocationNotFoundError extends DomainError {
  constructor(
    message = "The Google Maps link does not contain an extractable place name and coordinates",
  ) {
    super(message, "GOOGLE_MAPS_LOCATION_NOT_FOUND", 422);
  }
}

export class GoogleMapsResolutionError extends DomainError {
  constructor(message = "The Google Maps link could not be resolved") {
    super(message, "GOOGLE_MAPS_RESOLUTION_FAILED", 502);
  }
}
