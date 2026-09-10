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
